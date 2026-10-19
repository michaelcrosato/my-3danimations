// The intake's workflows (PLAN.md WP-9.1a): intake.yml runs the checker every 15 minutes and on demand, then the adopt
// bot, and with no hosted store linked (M3A_SUPABASE_URL or M3A_SUPABASE_SERVICE_ROLE_KEY unset) does nothing and says
// so: its first step, run here with each unset, and every other step conditioned on it. The service role key reaches
// only the steps that use it, the checkout keeps no token, the install runs no package's scripts, and the workflow's
// token reaches only the adopt bot.
// library-gates.yml runs `npm run gate -- library-pr` on every pull request that touches library/sets/. ci.yml's
// intake-contract job, by manual dispatch alone, runs the contract suite against O8's project, its secret on that step.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "../run/cli.ts";

const workflow = (name: string) => readFileSync(join(ROOT, ".github/workflows", name), "utf8");
/** A workflow's steps, each its own text, from `steps:` on. */
const steps = (text: string) => text.slice(text.indexOf("    steps:\n")).split(/\n(?= {6}- )/).slice(1);

describe("intake.yml", () => {
  const text = workflow("intake.yml");
  it("runs every 15 minutes and on demand: the checker, then the adopt bot with the workflow's token", () => {
    expect(text).toMatch(/schedule:\n {4}- cron: "\*\/15 \* \* \* \*"\n {2}workflow_dispatch:/);
    const runs = steps(text).map((s) => /run: (?:gh auth setup-git && )?(npm run .+)/.exec(s)?.[1]).filter(Boolean);
    expect(runs).toEqual(["npm run fixtures -- fetch", "npm run intake -- check --json", "npm run intake -- adopt --json"]);
  });
  it("gives the service role key only to the steps that use it, and the workflow's token only to the adopt bot; the checkout keeps none", () => {
    const all = steps(text), secret = /\$\{\{ secrets\.M3A_SUPABASE_SERVICE_ROLE_KEY \}\}/, using = (re: RegExp) => all.filter((s) => re.test(s)).map((s) => /id: (\w+)|run: (.+)/.exec(s)?.slice(1).find(Boolean));
    expect(text.slice(0, text.indexOf("    steps:\n"))).not.toMatch(/secrets\.|GH_TOKEN/);
    expect(using(secret)).toEqual(["store", "npm run intake -- check --json", "gh auth setup-git && npm run intake -- adopt --json"]);
    expect(using(/GH_TOKEN: \$\{\{ github\.token \}\}/)).toEqual(["gh auth setup-git && npm run intake -- adopt --json"]);
    expect([all.find((s) => s.includes("actions/checkout@"))!, all.some((s) => /run: npm ci --ignore-scripts\n/.test(`${s}\n`))]).toEqual([expect.stringMatching(/\n {10}persist-credentials: false/), true]);
  });
  it("does nothing and says so when no hosted store is linked: every step after the first waits on it", () => {
    const [first, ...rest] = steps(text), script = /run: \|\n((?: {10}.*\n)+)/.exec(`${first!}\n`)![1]!.replace(/^ {10}/gm, "");
    const dir = mkdtempSync(join(tmpdir(), "m3a-wf-")), out = join(dir, "output");
    const run = (env: Record<string, string>) => {
      rmSync(out, { force: true });
      const said = spawnSync("bash", ["-c", script], { env: { PATH: process.env.PATH!, GITHUB_OUTPUT: out, ...env }, encoding: "utf8" }).stdout;
      return [readFileSync(out, "utf8"), said];
    };
    try {
      expect(run({})).toEqual(["linked=false\n", expect.stringMatching(/^::notice title=intake::No hosted store is linked \(O8: M3A_SUPABASE_URL and M3A_SUPABASE_SERVICE_ROLE_KEY unset among the repository's Actions secrets\): nothing to check or adopt/)]);
      expect(run({ M3A_SUPABASE_URL: "https://x.supabase.co" })).toEqual(["linked=false\n", expect.stringMatching(/\(O8: M3A_SUPABASE_SERVICE_ROLE_KEY unset among/)]);
      expect(run({ M3A_SUPABASE_URL: "https://x.supabase.co", M3A_SUPABASE_SERVICE_ROLE_KEY: "s" })).toEqual(["linked=true\n", ""]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    for (const s of rest) expect(s, s).toMatch(/^ {6}- if: (always\(\) && )?steps\.store\.outputs\.linked == 'true'\n/);
  });
});

describe("library-gates.yml", () => {
  it("runs the library-pr gate set on every pull request that touches library/sets/", () => {
    const text = workflow("library-gates.yml");
    expect(text).toMatch(/on:\n {2}pull_request:\n {4}paths:\n {6}- "library\/sets\/\*\*"\n/);
    expect(steps(text).map((s) => /run: (.+)/.exec(s)?.[1]).filter(Boolean)).toEqual(["npm ci", "npm run fixtures -- fetch", "npm run gate -- library-pr --json"]);
  });
});

describe("ci.yml's hosted contract", () => {
  const text = workflow("ci.yml"), job = text.slice(text.indexOf("\n  intake-contract:\n"));
  it("runs only by manual dispatch with the gate intake-contract, failing unset, its secret on the step that runs the suite alone", () => {
    expect(job).toMatch(/\n {4}if: github\.event_name == 'workflow_dispatch' && inputs\.gate == 'intake-contract'\n/);
    expect(text).toMatch(/\n {4}if: github\.event_name == 'workflow_dispatch' && inputs\.gate != 'intake-contract'\n/);
    const all = steps(job), secret = all.filter((s) => s.includes("secrets."));
    expect([secret.length, secret[0]].map(String)).toEqual(["1", expect.stringContaining("npx vitest run packages/tools/test/intake-contract.test.ts")]);
    expect(secret[0]).toMatch(/\[ -n "\$M3A_INTAKE_SUPABASE" \] \|\| \{ echo "::error::[^"]+"; exit 1; \}/);
    expect([all.find((s) => s.includes("actions/checkout@"))!, all.some((s) => /run: npm ci --ignore-scripts\n/.test(`${s}\n`))]).toEqual([expect.stringMatching(/\n {10}persist-credentials: false/), true]);
    expect(text.slice(0, text.indexOf("\njobs:"))).not.toMatch(/secrets\./);
  });
});

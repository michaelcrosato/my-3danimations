// The intake's workflows (PLAN.md WP-9.1a): intake.yml runs the checker every 15 minutes and on demand, then the adopt
// bot, and with no hosted store linked does nothing and says so (its first step, run here with the secrets unset, and
// every other step conditioned on it); half linked, it goes on and the checker refuses, naming what is missing.
// library-gates.yml runs `npm run gate -- library-pr` on every pull request that touches library/sets/.
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
    const runs = steps(text).map((s) => /run: (npm run .+)/.exec(s)?.[1]).filter(Boolean);
    expect(runs).toEqual(["npm run fixtures -- fetch", "npm run intake -- check --json", "npm run intake -- adopt --json"]);
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
      expect(run({})).toEqual(["linked=false\n", expect.stringMatching(/^::notice title=intake::No hosted store is linked \(O8: the M3A_INTAKE_\* secrets are unset\): nothing to check or adopt/)]);
      expect(run({ M3A_INTAKE_URL: "https://x.supabase.co" })).toEqual(["linked=true\n", ""]);
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

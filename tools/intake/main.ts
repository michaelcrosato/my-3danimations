// `npm run intake -- check [--fixture all|<name>] | adopt --dry-run [--checkout <dir>] | gates [--base <ref>]
// [--fixture all]` (PLAN.md §5.9, WP-9.1a): the checker over the store's new submissions (the local store under
// .cache/intake/, or the hosted one when its environment links it), or over the fixtures in a scratch store, each
// expected outcome held; the adopt bot over the owner's adoptions (the real pull request is G9's deferred proof, so
// only a dry run against a scratch checkout runs here); and the library's gates on the clips a pull request adds or
// changes (library-gates.yml, `npm run gate -- library-pr`), or on a scratch copy with the fixtures' clips planted, the
// bad ones expected to fail. Prints verdict first, exits 0 ok, 1 findings, 2 usage.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localStore } from "../../packages/tools/src/intake/index.ts";
import { intakeFiles } from "../../packages/tools/src/node/intake.ts";
import { render } from "../../packages/tools/src/registry/reply.ts";
import { Registry } from "../../packages/tools/src/registry/registry.ts";
import { libraryTool } from "../../packages/tools/src/tools/library-submit.ts";
import { closest, finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";
import { adopt, dryRun, github } from "./adopt.ts";
import { check, openChecker, type Checked } from "./check.ts";
import { fixtures, type Fixture } from "./fixtures.ts";
import { libraryGates, plantedGates } from "./gates.ts";
import { checkerStore, hostedEnv, today } from "./host.ts";
import { scratchCheckout } from "./write.ts";

/** The fixtures' contributor in a scratch store. */
export const FIXTURE_CONTRIBUTOR = "fixtures";

/** Whether a fixture came out as it must: its state, and a bounce's gate and words. */
export function asExpected(f: Fixture, c: Checked | undefined): string | null {
  if (!c) return "the checker didn't take it";
  if (c.state !== f.expect) return `${c.state}${c.reason ? ` (${c.reason})` : ""}, not ${f.expect}`;
  if (f.gate && !c.reason?.startsWith(`${f.gate}: `)) return `bounced by ${c.reason?.split(":")[0]}, not ${f.gate}: ${c.reason}`;
  if (f.reason && !c.reason?.includes(f.reason)) return `its reason doesn't say "${f.reason}": ${c.reason}`;
  return null;
}

/** The fixtures (all, or the one named) through the checker in a scratch store, each held to its expectation; and the
 *  contributor's view of them, as `m3a library status` shows it. */
export async function checkFixtures(only: string, sets = join(ROOT, "library/sets")): Promise<{ steps: Step[]; status: string }> {
  const dir = mkdtempSync(join(tmpdir(), "m3a-intake-")), day = () => "2026-10-19";
  try {
    const c = await openChecker(sets), fx = fixtures(c.lib, only), who = localStore({ files: intakeFiles(dir), role: "contributor", id: FIXTURE_CONTRIBUTOR, today: day });
    const ids = new Map<string, Fixture>();
    for (const f of fx) ids.set((await who.submit({ kind: f.kind, text: f.text, improves: f.improves })).id, f);
    const t0 = performance.now(), done = await check(localStore({ files: intakeFiles(dir), role: "checker", today: day }), c, { sheets: dir }), ms = (performance.now() - t0) / Math.max(1, done.length);
    const steps = [...ids].map(([id, f]): Step => {
      const got = done.find((d) => d.id === id), off = asExpected(f, got);
      return { name: f.name, ok: off === null, ms, summary: off ?? `${got!.state}${got!.reason ? `: ${got!.reason.slice(0, 110)}` : ""}` };
    });
    const tool = new Registry([libraryTool(() => ({ store: who, today: day }))]), reply = await tool.call("library", { do: "status" });
    return { steps, status: render(reply, { verbose: true, more: "" }) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const specs = [
    { name: "fixture", takesValue: true, help: "check, gates: the fixtures (all, or one by name) in a scratch store or library copy" },
    { name: "dry-run", help: "adopt: write into a scratch checkout and print the pull request it would open" },
    { name: "checkout", takesValue: true, help: "adopt --dry-run: the scratch checkout to write into (a copy of the library under /tmp by default)" },
    { name: "base", takesValue: true, help: "gates: the ref the pull request is compared with (origin/main)" },
  ];
  const verbs = ["check", "adopt", "gates"];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    const v = parsed.positionals[0];
    if (!v || !verbs.includes(v)) throw new Error(`expected one of ${verbs.join(", ")}${v ? `, got "${v}"; did you mean ${closest(v, verbs)}?` : ""}`);
    if (parsed.flags["dry-run"] && v !== "adopt") throw new Error("--dry-run is adopt's");
  } catch (err) {
    usage("intake", err, specs);
  }
  const verb = parsed.positionals[0]!, f = parsed.flags, t0 = performance.now(), steps: Step[] = [], lines: string[] = [];
  let next = "";
  try {
    if (verb === "check" && typeof f.fixture === "string") {
      const r = await checkFixtures(f.fixture);
      steps.push(...r.steps);
      lines.push(r.status);
      next = steps.every((s) => s.ok) ? "every fixture is bounced or passed as it must: npm run gate -- library-pr --fixture all" : "a fixture came out otherwise: the gate that let it through (or bounced the clean one) is the bug";
    } else if (verb === "check") {
      const h = hostedEnv(), o = checkerStore({ cwd: ROOT }), c = await openChecker(join(ROOT, "library/sets"));
      const done = await check(o.store, c, { sheets: o.dir });
      for (const d of done) steps.push({ name: d.id, ok: true, ms: 0, summary: `${d.state}${d.reason ? `: ${d.reason.slice(0, 120)}` : ""}` });
      if (!done.length) steps.push({ name: "check", ok: true, ms: performance.now() - t0, summary: `nothing new in the ${h ? "hosted" : "local"} store` });
      next = "the owner decides what waits for review: m3a review";
    } else if (verb === "adopt") {
      // the real pull requests take the hosted store and the workflow's token (intake.yml once O8 is linked: G9)
      if (!f["dry-run"] && !(hostedEnv() && process.env.GH_TOKEN)) throw new Error("the adopt bot opens real pull requests only in intake.yml, with O8's store linked and the workflow's token (G9's deferred proof): run it here with --dry-run");
      const made = f["dry-run"] && typeof f.checkout !== "string", dir = f["dry-run"] ? (made ? scratchCheckout() : (f.checkout as string)) : ROOT, o = checkerStore({ cwd: ROOT });
      const done = await adopt({ store: o.store, owner: o.owner, checkout: dir, prs: f["dry-run"] ? dryRun((t: string) => void lines.push(t)) : github(ROOT), today });
      for (const d of done) steps.push({ name: d.id, ok: d.outcome !== "refused", ms: 0, summary: `${d.outcome}${d.why ? `: ${d.why.slice(0, 120)}` : ""}` });
      if (!done.length) steps.push({ name: "adopt", ok: true, ms: performance.now() - t0, summary: "no adoption by the owner to commit; nothing written" });
      if (made && !done.length) rmSync(dir, { recursive: true, force: true });
      next = !f["dry-run"] ? "each merged adoption is in main; a closed one waits for the owner's review again" : done.length ? `the dry run wrote into ${dir}; G9 opens the real pull request` : "the owner adopts with m3a review adopt <ref>";
    } else if (typeof f.fixture === "string") {
      const r = await plantedGates(f.fixture);
      steps.push(...r.steps);
      next = steps.every((s) => s.ok) ? "library-gates fails a pull request with a planted bad clip, and passes the clean one" : "library-gates let a planted bad clip through, or failed the clean one";
    } else {
      const r = libraryGates(ROOT, typeof f.base === "string" ? f.base : "origin/main");
      steps.push(...(await r).steps);
      next = steps.every((s) => s.ok) ? "the library gates pass" : "fix what each failed gate names, in the clip or through the library's writer";
    }
  } catch (err) {
    steps.push({ name: verb, ok: false, ms: performance.now() - t0, summary: (err as Error).message.slice(0, 200) });
    next ||= "fix what the message names and run it again";
  }
  const ms = performance.now() - t0, ok = steps.every((s) => s.ok);
  const report: Report = { tool: "intake", ok, verdict: `intake ${verb}${typeof f.fixture === "string" ? ` --fixture ${f.fixture}` : ""}: ${ok ? "PASS" : "FAIL"} in ${fmtMs(ms)} (${steps.filter((s) => s.ok).length}/${steps.length})`, steps, warnings: [], ms, next };
  if (lines.length) process.stdout.write(`${lines.join("\n")}\n`);
  finish(report, parsed);
}

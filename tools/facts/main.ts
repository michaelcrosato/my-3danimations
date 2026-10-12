// `npm run facts [-- --check]` (PLAN.md WP-5.4): every library clip's facts and contacts measured afresh against what
// is written, and every tag its facts don't bear out (a `loop` that doesn't close, a `run` that doesn't travel), each
// with its reason when library/baselines/tags.json accepts it. With --check it fails on stale facts, a conflict with
// no reason, or a reason whose conflict is gone. The facts are written by the importer and the migrator (`npm run
// import`, `npm run migrate`), so a stale clip is mended by running its writer.
import { finish, fmtMs, parseArgs, usage, type Report, type Step } from "../run/cli.ts";
import { checkFacts } from "./facts.ts";

if (import.meta.main) {
  const specs = [{ name: "check", help: "fail on stale facts, a tag conflict with no reason, or a reason whose conflict is gone" }];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
  } catch (err) {
    usage("facts", err, specs);
  }
  const t0 = performance.now(), r = checkFacts(), check = !!parsed.flags.check, steps: Step[] = [];
  const open = r.conflicts.filter((c) => !c.reason);
  steps.push({ name: "facts", ok: !check || r.stale.length === 0, ms: 0, summary: r.stale.length ? `${r.stale.length} of ${r.clips} clips' facts or contacts aren't what is measured: run their writer (npm run import, npm run migrate)` : `${r.clips} clips: every fact and contact as measured`, detail: r.stale.slice(0, 20) });
  steps.push({ name: "tags", ok: !check || (open.length === 0 && r.gone.length === 0), ms: 0, summary: `${r.conflicts.length} tag(s) the facts don't bear out: ${r.conflicts.length - open.length} baselined with a reason, ${open.length} not${r.gone.length ? `; ${r.gone.length} reason(s) whose conflict is gone` : ""}`, detail: [...open.map((c) => `${c.id} ${c.tag}: ${c.message}`), ...r.gone.map((g) => `${g}: baselined, but the facts bear the tag out now`)] });
  const ok = steps.every((s) => s.ok), ms = performance.now() - t0;
  const report: Report = { tool: "facts", ok, verdict: `facts: ${ok ? "PASS" : "FAIL"}${check ? " (--check)" : ""} in ${fmtMs(ms)}: ${r.clips} clips, ${r.stale.length} stale, ${r.conflicts.length} tag conflict(s), ${open.length} without a reason`, steps, warnings: [], ms, next: ok ? "npm test -- facts" : "resolve each conflict (fix the tag in its catalog) or give it a reason in library/baselines/tags.json" };
  finish(report, parsed);
}

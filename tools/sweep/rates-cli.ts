// `npm run sweep -- --rates [<rig ids>] [--sample N] [--clip ID] [--check] [--baseline] [--jobs N] [--out <file>]`
// (D123): the root-motion rate sweep (rates.ts) from the command line. Every locomotion loop with contacts (or N spread
// over them, or one) at each rate of RATES on each body named (the six of RATE_RIGS when none is), in worker threads;
// prints each body's rows by verdict and the rates' counts; writes every row to check-output/sweep/rates.json (or
// --out). --check fails on a failing row not in library/baselines/rates.json, naming each, and reports each baselined
// row that passes now; --baseline rewrites that file from a whole run (every loop, the six bodies, every rate), saying
// how many rows it adds and drops: a change lands in a commit that says why.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { libraryClips, sample } from "../qa/qa.ts";
import { finish, fmtMs, ROOT, type Parsed, type Report, type Step } from "../run/cli.ts";
import { againstRateBaseline, isRateLoop, RATE_BASELINE, RATE_RIGS, rateBaselineOf, rateBaselineText, RATES, readRateBaseline, rowKey, sweepRates, type RateBaseline, type RateRow } from "./rates.ts";

/** What `--rates` writes: every row the run played, and what it swept. */
export interface RateResults {
  about: string;
  rigs: string[];
  rates: number[];
  loops: number;
  rows: RateRow[];
}

/** The usage error of a --rates command line, or none: flags of the clip-by-skeleton sweep don't apply. */
export function ratesUsage(parsed: Parsed): string | null {
  const f = parsed.flags, off = ["min", "min-total", "heldout", "record", "commit", "name"].filter((k) => f[k] !== undefined);
  if (off.length) return `--rates sweeps rates, not clips on skeletons: drop ${off.map((k) => `--${k}`).join(", ")}`;
  if (f.baseline && (f.sample !== undefined || f.clip !== undefined || f.manifest !== undefined || (parsed.positionals.length && parsed.positionals.join(" ") !== RATE_RIGS.join(" ")))) return `--baseline records a whole run: every loop on the six bodies (${RATE_RIGS.join(" ")}); drop --sample, --clip, --manifest and the rig ids`;
  if (f.jobs !== undefined && !(Number.isInteger(Number(f.jobs)) && Number(f.jobs) >= 1)) return `--jobs takes a whole number of worker threads, 1 or more (not ${String(f.jobs)})`;
  return null;
}

/** Runs the rate sweep a command line asks for, prints its report and exits (1 when --check finds a failing row the
 *  baseline doesn't hold). */
export async function ratesCommand(parsed: Parsed): Promise<never> {
  const t0 = performance.now(), f = parsed.flags, rigs = parsed.positionals.length ? parsed.positionals : [...RATE_RIGS];
  let loops = libraryClips().filter((c) => isRateLoop(c.clip));
  if (typeof f.clip === "string") {
    loops = loops.filter((c) => c.clip.id === f.clip);
    if (!loops.length) finish({ tool: "sweep", ok: false, verdict: `sweep --rates: no locomotion loop with contacts "${f.clip}" (a loop tagged walk, run, sidestep, strafe or turn, its feet's contacts measured, that travels)`, steps: [], warnings: [], ms: 0, next: "npm run sweep -- --rates --sample 5, or a clip id from npm run m3a -- search" }, parsed, 2);
  }
  if (typeof f.sample === "string") loops = sample(loops, Math.max(1, Number(f.sample)));
  // the baseline read before the sweep: --check on a file it can't read fails at once; --baseline replaces it all the same
  let base: RateBaseline | null = null, unreadable: string | null = null;
  if (existsSync(RATE_BASELINE)) {
    try {
      base = readRateBaseline();
    } catch (err) {
      unreadable = err instanceof Error ? err.message : String(err);
    }
  }
  const rel = relative(ROOT, RATE_BASELINE);
  if (f.check && unreadable && !f.baseline) finish({ tool: "sweep", ok: false, verdict: `sweep --rates: can't read ${rel}: ${unreadable}`, steps: [], warnings: [], ms: 0, next: "npm run sweep -- --rates --baseline rewrites it from a whole run" }, parsed, 1);
  const ids = loops.map((c) => c.clip.id), rows = await sweepRates(ids, rigs, { ...(typeof f.jobs === "string" ? { jobs: Number(f.jobs) } : {}), ...(typeof f.manifest === "string" ? { manifest: resolve(f.manifest) } : {}) });
  const ms = performance.now() - t0, steps: Step[] = [], count = (rs: RateRow[], v: RateRow["verdict"]) => rs.filter((r) => r.verdict === v).length;
  const tally = (rs: RateRow[]) => `${count(rs, "pass")} pass, ${count(rs, "warn")} warn, ${count(rs, "fail")} fail`;
  for (const rig of rigs) {
    const mine = rows.filter((r) => r.rig === rig);
    steps.push({ name: rig, ok: true, ms: 0, summary: `${tally(mine)} of ${mine.length} rows (${ids.length} loops × ${RATES.length} rates)` });
  }
  steps.push({ name: "by rate", ok: true, ms, summary: RATES.map((rate) => `${rate}: ${count(rows.filter((r) => r.rate === rate), "fail")} fail, ${count(rows.filter((r) => r.rate === rate), "warn")} warn`).join("; ") });
  let failing = count(rows, "fail");
  const warnings: string[] = [];
  if (f.check) {
    if (!base) steps.push({ name: "baseline", ok: false, ms: 0, summary: unreadable ? `can't read ${rel}: ${unreadable}` : `no ${rel} yet: npm run sweep -- --rates --baseline` });
    else {
      const { failures, better } = againstRateBaseline(base, rows), played = new Set(rows.map(rowKey));
      // a whole run plays every baselined row: one it didn't play is a clip or body gone
      const whole = rigs.join(" ") === base.rigs.join(" ") && ids.length === libraryClips().filter((c) => isRateLoop(c.clip)).length, gone = whole ? Object.keys(base.failing).filter((k) => !played.has(k)) : [];
      steps.push({
        name: "baseline", ok: failures.length === 0, ms: 0,
        summary: `${failures.length} failing rows not in ${rel}, ${failing - failures.length} failing as it holds; ${better.length} it holds pass or warn now${gone.length ? `, ${gone.length} weren't played (gone)` : ""}${better.length || gone.length ? ": rewrite it with --baseline" : ""}`,
        detail: failures.map((r) => `${rowKey(r)}: ${r.why.join("; ")}`),
      });
      failing = failures.length;
      // the rows the baseline holds that pass now, reported (the step passes): the first few here, all in the results
      const shown = [...better.map((r) => `${rowKey(r)} ${r.verdict}s now (baselined as failing)`), ...gone.map((k) => `${k} is baselined but wasn't played (gone)`)];
      warnings.push(...shown.slice(0, 5), ...(shown.length > 5 ? [`and ${shown.length - 5} more: rewrite ${rel} with --baseline`] : []));
    }
  }
  if (f.baseline) {
    const now = rateBaselineOf(rows, ids.length), was = base?.failing ?? {}, added = Object.keys(now.failing).filter((k) => !was[k]).length, dropped = Object.keys(was).filter((k) => !now.failing[k]).length;
    writeFileSync(RATE_BASELINE, rateBaselineText(now));
    steps.push({ name: "baseline written", ok: true, ms: 0, summary: `wrote ${rel}: ${Object.keys(now.failing).length} failing rows (${unreadable ? "the old one unreadable, replaced" : `${added} added, ${dropped} dropped`}; a change lands in a commit that says why)` });
  }
  const out = typeof f.out === "string" ? resolve(f.out) : join(ROOT, "check-output/sweep/rates.json"), results: RateResults = { about: "npm run sweep -- --rates: each locomotion loop with contacts at each rate on each body, moved by its root's travel; a row fails on slide or skate past its fail level or no foot that stands still, warns past a warn level (tools/sweep/rates.ts, D123)", rigs, rates: [...RATES], loops: ids.length, rows };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(results, null, 1));
  const ok = steps.every((s) => s.ok);
  const report: Report = { tool: "sweep", ok, verdict: `sweep --rates: ${ok ? "PASS" : "FAIL"}, ${rows.length} rows (${ids.length} loops × ${RATES.length} rates × ${rigs.length} ${rigs.length === 1 ? "body" : "bodies"}) in ${fmtMs(ms)}: ${tally(rows)}${f.check && base ? `, ${failing} of them not baselined` : ""}`, steps, warnings, ms, next: ok ? `read ${relative(ROOT, out)} for every row` : `each failing row not baselined is named above and in ${relative(ROOT, out)}: fix the loop (its contacts, its root), or baseline it with --baseline in a commit that says why` };
  finish(report, parsed);
}

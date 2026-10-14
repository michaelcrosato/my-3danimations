// A gate's sweep record (bench/results/gates/G<n>-run-<k>/sweep.json), derived from the sweep's raw results
// (check-output/sweep/results.json, as `npm run sweep` writes them) by `npm run sweep -- --record`: per skeleton and the
// counted ones together, every failing pair with its reasons and every warn the skeleton added to it, and every pair
// that passes with a warn the skeleton added (D80: "no fail finding added, every warn the skeleton adds listed"). Kept
// apart from the sweep so a record can be re-derived from a gate's raw results without running the sweep again (D88).
import type { SweepRow } from "./sweep.ts";

/** The raw results `npm run sweep` writes: each clip on each skeleton, the held-out rigs named apart. */
export interface SweepResults {
  about: string;
  rigs: string[];
  /** The gate's held-out run (--heldout): its rigs count toward neither bar. */
  heldout?: { run: string; manifest: string; rigs: string[] };
  clips: number;
  /** Every pair that passes with a warn the skeleton added. */
  warned: { clip: string; rig: string; warns: string[] }[];
  rows: SweepRow[];
}

/** A gate's sweep record: the counts, every failing pair with its reasons and added warns, every passing pair warned. */
export interface SweepRecord {
  about: string;
  /** The commit the raw results were written at. */
  commit: string;
  rigs: string[];
  heldout?: SweepResults["heldout"];
  clips: number;
  /** The counted skeletons (all but the held-out ones) together, the bar's reading (pct to 0.01). */
  together: { pass: number; of: number; pct: number };
  /** Each skeleton: pairs passing, of how many, how many pass with a warn it added, held out or not, pct to 0.1. */
  perRig: Record<string, { pass: number; of: number; warned: number; heldOut: boolean; pct: number }>;
  /** Every failing pair: why it fails (each fail finding the skeleton added) and each warn the skeleton added ([] when none). */
  failures: { clip: string; rig: string; why: string[]; warns: string[] }[];
  /** Every pair that passes with a warn the skeleton added. */
  warned: SweepResults["warned"];
}

/**
 * The record of a sweep's raw results at `commit`; `name` opens its about text ("G4 run 2's sweep step"). Every row
 * lands once: failing in `failures` with its reasons and warns, passing with a warn in `warned`, passing clean in
 * neither; the held-out rigs are counted per skeleton only.
 */
export function sweepRecord(res: SweepResults, commit: string, name = "The sweep"): SweepRecord {
  const held = res.heldout?.rigs ?? [], counted = res.rigs.filter((r) => !held.includes(r)), rows = res.rows;
  const pct = (pass: number, of: number, d: number) => Math.round((10 ** d * 100 * pass) / Math.max(1, of)) / 10 ** d;
  const perRig: SweepRecord["perRig"] = {};
  for (const rig of res.rigs) {
    const mine = rows.filter((r) => r.rig === rig), pass = mine.filter((r) => r.ok).length;
    perRig[rig] = { pass, of: mine.length, warned: mine.filter((r) => r.ok && r.warns.length).length, heldOut: held.includes(rig), pct: pct(pass, mine.length, 1) };
  }
  const tally = rows.filter((r) => counted.includes(r.rig)), pass = tally.filter((r) => r.ok).length;
  const about = `${name} (npm run sweep, D80), recorded from its raw results by npm run sweep -- --record: ${res.clips} library clips on ${counted.length} skeletons${held.length ? `, the held-out ${held.join(", ")} apart (in neither together nor a bar)` : ""}; a pair fails on a fail finding the skeleton adds; every failing pair is listed in failures with its reasons (why) and every warn the skeleton added (warns, [] when none); every pair that passes with a warn the skeleton added is listed in warned; a pair in neither list passes clean`;
  return {
    about,
    commit,
    rigs: res.rigs,
    ...(res.heldout ? { heldout: res.heldout } : {}),
    clips: res.clips,
    together: { pass, of: tally.length, pct: pct(pass, tally.length, 2) },
    perRig,
    failures: rows.filter((r) => !r.ok).map((r) => ({ clip: r.clip, rig: r.rig, why: r.why, warns: r.warns })),
    warned: rows.filter((r) => r.ok && r.warns.length).map((r) => ({ clip: r.clip, rig: r.rig, warns: r.warns })),
  };
}

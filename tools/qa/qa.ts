// The QA run's work (PLAN.md WP-3.3): the migrated library's clips, each measured by the sensors on its own rest, and
// the distributions of their values per metric, overall and per set, that the thresholds are read from.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseClip, type Clip, type Rest } from "@m3a/core";
import { checks, metrics } from "@m3a/sensors";
import { ROOT } from "../run/cli.ts";

/** A library clip with its set and rest. */
export interface LibraryClip {
  set: string;
  clip: Clip;
  rest: Rest;
}

/** Every migrated clip, sorted by id (a set's rests from its manifest). */
export function libraryClips(dir = join(ROOT, "library/sets")): LibraryClip[] {
  const out: LibraryClip[] = [];
  for (const set of readdirSync(dir).sort()) {
    const manifest = JSON.parse(readFileSync(join(dir, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> };
    for (const f of readdirSync(join(dir, set)).filter((x) => x.endsWith(".json") && !x.startsWith("_")).sort()) {
      const clip = parseClip(readFileSync(join(dir, set, f), "utf8"));
      out.push({ set, clip, rest: manifest.sources[clip.restSrc]!.rest });
    }
  }
  return out;
}

/** Every k-th clip so that `n` are taken, spread over the sorted library (the same sample every run). */
export function sample<T>(all: readonly T[], n: number): T[] {
  if (n >= all.length) return [...all];
  return Array.from({ length: n }, (_, i) => all[Math.floor((i * all.length) / n)]!);
}

/**
 * One clip's QA row: its verdict and the verdict's text, values, the metrics its profile turned off, its findings
 * (each with its times, value and repair) and their count by metric and level.
 */
export interface QaRow {
  clip: string;
  set: string;
  verdict: "pass" | "warn" | "fail";
  text: string;
  values: Record<string, number>;
  off: string[];
  findings: checks.Finding[];
  counts: Record<string, number>;
}

/** Measures clips. */
export function qa(clips: readonly LibraryClip[]): QaRow[] {
  return clips.map(({ set, clip, rest }) => {
    const r = metrics(clip, rest), counts: Record<string, number> = {};
    for (const f of r.findings) counts[`${f.metric}:${f.level}`] = (counts[`${f.metric}:${f.level}`] ?? 0) + 1;
    return { clip: r.clip, set, verdict: r.verdict, text: r.text, values: r.values, off: r.off, findings: r.findings, counts };
  });
}

/** The sets of real capture, which the thresholds are checked against. */
export const CAPTURE = ["CMU_CURATED", "STYLE100"];

/** A value's percentiles: 50, 90, 95, 99 and the most. */
export function percentiles(values: number[]): { p50: number; p90: number; p95: number; p99: number; max: number; n: number } {
  const v = [...values].sort((a, b) => a - b), q = (p: number) => (v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))]! : 0);
  return { p50: q(0.5), p90: q(0.9), p95: q(0.95), p99: q(0.99), max: v.length ? v[v.length - 1]! : 0, n: v.length };
}

/**
 * Each metric's distribution of per-clip worst values (clips whose profile turns it off left out): in all, in real
 * capture (CAPTURE's sets) and per set.
 */
export function distributions(rows: readonly QaRow[]): Record<string, Record<checks.MetricName | "skateMean", ReturnType<typeof percentiles>>> {
  const groups = ["all", "capture", ...new Set(rows.map((r) => r.set))], out: Record<string, Record<string, ReturnType<typeof percentiles>>> = {};
  for (const g of groups) {
    const rs = rows.filter((r) => g === "all" || (g === "capture" ? CAPTURE.includes(r.set) : r.set === g));
    out[g] = Object.fromEntries([...checks.METRICS, "skateMean" as const].map((m) => [m, percentiles(rs.filter((r) => !r.off.includes(m === "skateMean" ? "skate" : m)).map((r) => r.values[m]!))]));
  }
  return out as never;
}

// The library's QA as a whole (PLAN.md WP-5.8, `npm run qa -- library`): every clip's recorded verdict (its quality's
// `qa`, `qaVersion` and the head of its `baseline`) against what the sensors give it now; the reasons in
// library/baselines/qa.json whose finding is gone; the census (unique motions and G5's category floors, census.ts);
// each metric's distribution over the library and the verdicts' counts against the ones recorded in
// library/baselines/distributions.json, which may only improve; and docs/LIBRARY.md, generated from all of it.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checks } from "@m3a/sensors";
import { ROOT } from "../run/cli.ts";
import { CATEGORIES, OTHER, type Census } from "./census.ts";
import { CAPTURE, distributions, type LibraryClip, type QaRow } from "./qa.ts";
import type { Report } from "@m3a/sensors";
import { pastLevel, readReasons, reasonHead, reasonOf, type QaContext, type QaReasons } from "./verdict.ts";

/** The recorded distributions. */
export const DISTRIBUTIONS = join(ROOT, "library/baselines/distributions.json");
/** The generated summary. */
export const LIBRARY_DOC = join(ROOT, "docs/LIBRARY.md");
/** G5's least count of unique motions. */
export const UNIQUE_FLOOR = 1000;

/** A set's manifest, as far as the summary reads it. */
interface SetInfo {
  title: string;
  tier: string;
  licenses: string[];
}
/** Every set's title, tier and its sources' licenses. */
export function setInfo(dir = join(ROOT, "library/sets")): Record<string, SetInfo> {
  const out: Record<string, SetInfo> = {};
  for (const set of readdirSync(dir).sort()) {
    const m = JSON.parse(readFileSync(join(dir, set, "_set.json"), "utf8")) as { title: string; tier: string; sources: Record<string, { license: string }> };
    out[set] = { title: m.title, tier: m.tier, licenses: [...new Set(Object.values(m.sources).map((s) => s.license))].sort() };
  }
  return out;
}

/** What each clip's writer knew of how it stands to its source, from the sets' `_import.json` (none for a set the
 *  migrator writes): the steps it was repaired with, why it wasn't, or why the migrated version was kept. */
export function contextsOf(dir = join(ROOT, "library/sets")): Map<string, QaContext> {
  const out = new Map<string, QaContext>();
  for (const set of readdirSync(dir).sort()) {
    const f = join(dir, set, "_import.json");
    if (!existsSync(f)) continue;
    const rec = JSON.parse(readFileSync(f, "utf8")) as { clips: Record<string, { kept: string; why: string; repaired?: string[]; unrepaired?: string }> };
    for (const [slug, c] of Object.entries(rec.clips)) out.set(`${set}/${slug}`, c.kept === "migrated" ? { migrated: c.why.split(";")[0]! } : { ...(c.repaired ? { repaired: c.repaired } : {}), ...(c.unrepaired ? { unrepaired: c.unrepaired } : {}) });
  }
  return out;
}

/** What the verdicts check found. */
export interface VerdictCheck {
  /** Clips whose recorded quality isn't what the sensors give now. */
  problems: string[];
  /** Reasons in qa.json whose clip or finding is gone, or whose set has no clip that fails. */
  gone: string[];
}
/**
 * Every clip's recorded verdict against the sensors' (`rows`, in the clips' order): its revision, pass or baselined,
 * and a baselined clip's whole reason as the reasons file and its writer's context (`contexts`) give it now.
 */
export function checkVerdicts(lib: readonly LibraryClip[], rows: readonly QaRow[], reasons: QaReasons = readReasons(), contexts: ReadonlyMap<string, QaContext> = contextsOf()): VerdictCheck {
  const problems: string[] = [], past = new Map<string, string[]>(), failing = new Set<string>();
  lib.forEach(({ set, clip }, i) => {
    const r = rows[i]!, q = clip.quality as { qa: string; qaVersion: string; baseline?: string }, want = r.verdict === "pass" ? "pass" : "baselined";
    past.set(clip.id, pastLevel(r));
    if (r.verdict === "fail") failing.add(set);
    if (q.qaVersion !== checks.QA_VERSION) problems.push(`${clip.id}: its verdict was read with ${q.qaVersion}, not ${checks.QA_VERSION}`);
    else if (q.qa !== want) problems.push(`${clip.id}: recorded ${q.qa}, the sensors give ${r.verdict}`);
    else if (want === "baselined" && !q.baseline?.startsWith(reasonHead(r))) problems.push(`${clip.id}: its reason doesn't start "${reasonHead(r)}"`);
    else if (want === "baselined" && q.baseline !== reasonOf(clip, r as unknown as Report, reasons, contexts.get(clip.id))) problems.push(`${clip.id}: its reason isn't what library/baselines/qa.json and its writer give now`);
  });
  const gone = [
    ...Object.entries(reasons.clips).flatMap(([id, by]) => Object.keys(by).filter((m) => !past.get(id)?.includes(m)).map((m) => `${id} ${m}`)),
    ...Object.keys(reasons.sets).filter((set) => !failing.has(set)).map((set) => `${set} (no clip in it fails)`),
  ];
  return { problems, gone };
}

/** One metric's recorded spread: p50, p95 and the most of each clip's worst value. */
type Spread = { p50: number; p95: number; max: number };
/** The recorded distributions: the sensors' verdicts' counts and each metric's spread over the library. */
export interface Recorded {
  about?: string;
  verdicts: { pass: number; warn: number; fail: number };
  metrics: Record<string, Spread>;
}
/** Three significant digits: what a spread is compared at. */
const sig = (x: number) => (x === 0 ? 0 : Number(x.toPrecision(3)));
/** This run's distributions. */
export function recordOf(rows: readonly QaRow[]): Recorded {
  const all = distributions(rows).all, count = (v: string) => rows.filter((r) => r.verdict === v).length;
  return { verdicts: { pass: count("pass"), warn: count("warn"), fail: count("fail") }, metrics: Object.fromEntries(Object.entries(all).map(([m, p]) => [m, { p50: sig(p.p50), p95: sig(p.p95), max: sig(p.max) }])) };
}
/** Where this run is worse than the record (more warns or fails, a metric's spread higher), and where it is better. */
export function againstRecord(was: Recorded, now: Recorded): { worse: string[]; better: string[] } {
  const worse: string[] = [], better: string[] = [];
  if (now.verdicts.fail > was.verdicts.fail) worse.push(`${now.verdicts.fail} clips fail, ${was.verdicts.fail} recorded`);
  else if (now.verdicts.fail < was.verdicts.fail) better.push(`fails ${was.verdicts.fail} → ${now.verdicts.fail}`);
  if (now.verdicts.warn + now.verdicts.fail > was.verdicts.warn + was.verdicts.fail) worse.push(`${now.verdicts.warn + now.verdicts.fail} clips flagged, ${was.verdicts.warn + was.verdicts.fail} recorded`);
  for (const [m, s] of Object.entries(now.metrics)) {
    const w = was.metrics[m];
    if (!w) continue;
    for (const k of ["p50", "p95", "max"] as const) {
      if (s[k] > w[k]) worse.push(`${m} ${k} ${w[k]} → ${s[k]}`);
      else if (s[k] < w[k]) better.push(`${m} ${k} ${w[k]} → ${s[k]}`);
    }
  }
  return { worse, better };
}
/** What is wrong with a record's shape (tools/qa/distributions.schema.json), none when it is right. */
export function recordProblems(r: unknown): string[] {
  const n = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0, obj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
  if (!obj(r)) return ["the record is a JSON object"];
  const out: string[] = [];
  for (const k of Object.keys(r)) if (!["about", "verdicts", "metrics"].includes(k)) out.push(`"${k}" is not a field of the record (about, verdicts, metrics)`);
  if (!obj(r.verdicts) || !["pass", "warn", "fail"].every((k) => Number.isInteger((r.verdicts as Record<string, unknown>)[k]) && n((r.verdicts as Record<string, unknown>)[k]))) out.push("verdicts counts pass, warn and fail");
  if (!obj(r.metrics) || !Object.values(r.metrics).every((m) => obj(m) && ["p50", "p95", "max"].every((k) => n(m[k])))) out.push("metrics gives each metric's p50, p95 and max");
  return out;
}
/** The record (checked: a bad file throws, naming what is wrong), or none yet. */
export function readRecord(file = DISTRIBUTIONS): Recorded | null {
  if (!existsSync(file)) return null;
  const r = JSON.parse(readFileSync(file, "utf8")) as unknown, bad = recordProblems(r);
  if (bad.length) throw new Error(`${file}: ${bad.join("; ")}`);
  return r as Recorded;
}
/** The record's text. */
export function recordText(r: Recorded): string {
  const about = "The library's QA distributions (npm run qa -- library --baseline): the sensors' verdicts' counts and each metric's p50, p95 and most of each clip's worst value, three significant digits. npm run qa -- library --check fails on any that gets worse; a change lands in a commit that says why (PLAN.md WP-5.8).";
  const lines = Object.entries(r.metrics).map(([m, s]) => `  ${JSON.stringify(m)}: ${JSON.stringify(s)}`);
  return `{\n "about": ${JSON.stringify(about)},\n "verdicts": ${JSON.stringify(r.verdicts)},\n "metrics": {\n${lines.join(",\n")}\n }\n}\n`;
}

/** Whether the census meets G5: the unique motions and every category's floor; what falls short. */
export function floorsMissed(c: Census): string[] {
  const out: string[] = [];
  if (c.unique < UNIQUE_FLOOR) out.push(`${c.unique} unique motions, G5 asks ${UNIQUE_FLOOR}`);
  for (const cat of CATEGORIES) if (c.categories[cat.name]!.unique < cat.floor) out.push(`${cat.label}: ${c.categories[cat.name]!.unique} unique, its floor ${cat.floor}`);
  return out;
}

/** docs/LIBRARY.md: sets, counts (raw and unique), categories, licenses, fit and the QA distributions. */
export function libraryDoc(lib: readonly LibraryClip[], rows: readonly QaRow[], c: Census, sets: Record<string, SetInfo>): string {
  const bySet = new Map<string, number[]>();
  lib.forEach(({ set }, i) => bySet.set(set, [...(bySet.get(set) ?? []), i]));
  const n = (x: number) => x.toLocaleString("en-US"), cc0 = lib.filter((x) => sets[x.set]!.tier === "cc0").length;
  const kinds = { orig: 0, export: 0, pose: 0 };
  for (const s of Object.values(c.same)) kinds[s.kind]++;
  const verdicts = (ix: number[]) => ["pass", "warn", "fail"].map((v) => ix.filter((i) => rows[i]!.verdict === v).length).join(" / ");
  const out = [
    "# The library",
    "",
    "Generated by `npm run qa -- library` (PLAN.md WP-5.8) from `library/sets/`: do not edit it by hand.",
    "",
    `${n(c.clips)} clips in ${bySet.size} sets: **${n(c.unique)} unique motions** after the minimal dedup, ${n(c.clips - c.unique)} counted with another (${kinds.orig} copies by \`orig\`, ${kinds.export} re-exports of one source's animation, ${kinds.pose} near-duplicates by pose; \`tools/qa/census.ts\`). The CC0 default pack: ${n(cc0)} clips, ${n(c.cc0)} unique motions.`,
    "",
    "## Sets",
    "",
    "| Set | Title | Tier | License | Clips | Unique | Fit, mean mm | QA pass / warn / fail |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | --- |",
    ...[...bySet].map(([set, ix]) => {
      const fit = ix.reduce((a, i) => a + (lib[i]!.clip.quality.fit as number[])[0]!, 0) / ix.length, unique = ix.filter((i) => !c.same[lib[i]!.clip.id]).length;
      return `| ${set} | ${sets[set]!.title} | ${sets[set]!.tier} | ${sets[set]!.licenses.join(", ")} | ${ix.length} | ${unique} | ${fit.toFixed(1)} | ${verdicts(ix)} |`;
    }),
    "",
    "## Categories",
    "",
    "Each clip's category is read from its tags, the first of these that takes it (`CATEGORIES`); a unique motion counts in its kept clip's. G5's floors:",
    "",
    "| Category | Floor | Clips | Unique | Unique with a CC0 clip | |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...[...CATEGORIES, { name: OTHER, label: "other (reference poses)", floor: 0 }].map((k) => {
      const x = c.categories[k.name]!;
      return `| ${k.label} | ${k.floor || ""} | ${x.clips} | ${x.unique} | ${x.cc0} | ${k.floor ? (x.unique >= k.floor ? "met" : "**short**") : ""} |`;
    }),
    "",
    "## QA",
    "",
    `Every clip carries the sensors' verdict (${checks.QA_VERSION}) in its \`quality\`: ${["pass", "warn", "fail"].map((v) => `${n(rows.filter((r) => r.verdict === v).length)} ${v}`).join(", ")}, every flagged clip baselined with its reason in \`quality.baseline\` (\`library/baselines/qa.json\` gives the reasons by set and by clip; \`tools/qa/verdict.ts\` the rest). Each metric's distribution of the clips' worst values, the clips its profile turns it off for left out; real capture (${CAPTURE.join(", ")}) beside the whole library:`,
    "",
    "| Metric | Warn | Fail | Unit | Capture p50 / p95 / most | Library p50 / p95 / most | Clips past fail |",
    "| --- | ---: | ---: | --- | --- | --- | ---: |",
    ...(() => {
      const d = distributions(rows), fmt = (p: { p50: number; p95: number; max: number }) => [p.p50, p.p95, p.max].map((x) => sig(x)).join(" / ");
      return checks.METRICS.filter((m) => d.all[m]!.n > 0).map((m) => {
        const t = checks.THRESHOLDS[m], failing = rows.filter((r) => r.counts[`${m}:fail`]).length;
        return `| ${m} | ${t.warn} | ${t.fail} | ${t.unit} | ${fmt(d.capture![m]!)} | ${fmt(d.all[m]!)} | ${failing} |`;
      });
    })(),
    "",
    "`library/baselines/distributions.json` records the verdicts' counts and each metric's spread; `npm run qa -- library --check` fails on any that gets worse.",
    "",
  ];
  return out.join("\n");
}

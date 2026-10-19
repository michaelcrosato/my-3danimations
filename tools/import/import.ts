// The re-import's work (PLAN.md WP-5.3): every set in tools/import/sets.ts read from its sources with @m3a/io, fitted
// with format 2's hands, spine curl and root yaw, and each clip compared with its migrated version (the migrator's own
// output, rebuilt from the pins, so the comparison doesn't depend on what is on disk): the fit against the source, and
// each sensor metric, separately. A clip keeps whichever is better (the re-import, unless it fits its source worse or
// the sensors judge it worse), with the reason on record in the set's `_import.json`; a migrated clip kept decodes on
// the rest it was made on (a `<source>_MIGRATED` record when the re-import measures its source's anew). The files come
// out as the migrator writes them (core's `serialize`, `_set.json`, `catalog.tsv`, `_baseline.json`), deterministic,
// each clip's facts and contacts measured (@m3a/library's `withFacts`, WP-5.4), the importer's revision in every clip's
// provenance and the sources' edition in the manifest. Fit limits: a set's mean at most 20 mm, a clip's mean at most 40
// mm and its worst at most 300 mm. WP-5.8: a re-import the sensors flag is repaired by their fix where that makes it
// better within CLOSE mm of its source on average and WORST mm at its worst point, a re-import the sensors judge better
// is kept over its migrated version within the same, and every clip records its QA verdict (tools/qa/verdict.ts).
// WP-9.1: a clip the owner adopted from the intake queue is kept over the version its source gives, on the rest it was
// made on, its record saying so (`kept: "adopted"`, the source's measures kept beside it), and a clip's review is
// carried over the rewrite while its motion hash matches (tools/migrate/adopted.ts); `withAdoption` writes the record
// as the adopt bot leaves it, so the next import finds what it would write.
import { format, math, serialize, validate, type Clip, type Rest } from "@m3a/core";

const { fromFormat1 } = format, { PORTABLE } = math;
import { importSet, type Catalog } from "@m3a/io";
import { withFacts } from "@m3a/library";
import { fix, metrics } from "@m3a/sensors";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogRow, contentId, legendLines, migrate, setText } from "../migrate/migrate.ts";
import { adoptedWhy, adoptionOf, baselineOn, carryReview, onDisk, type Adoption } from "../migrate/adopted.ts";
import { baselineReason } from "../migrate/sets.ts";
import { readReasons, withQuality, type QaReasons } from "../qa/verdict.ts";
import { ROOT } from "../run/cli.ts";
import { CATALOGS, IMPORTS, type ImportSpec } from "./sets.ts";

/** The importer's own revision: it goes in every clip it writes, so a change to its output is a change to this. */
export const IMPORTER = { tool: "m3a-import", version: "1" };
/** Format 2's degrees of freedom every re-imported clip is fitted with, a steady twist on nearly straight limbs, and a
 *  loop whose capture closes ending on its first key. */
export const ENCODE = { hands: true, spine: true, yaw: true, steadyTwist: true, closeLoop: true } as const;
/** The fit limits (mm): a set's mean, a clip's mean, a clip's worst. */
export const LIMITS = { setMean: 20, clipMean: 40, clipWorst: 300 } as const;
/** How much further from its source a clip may go for a better QA verdict, a repair or a re-import kept over its
 *  migrated version (WP-5.8, D66): mm on average, and mm at its worst point. */
export const CLOSE = 2, WORST = 30;

/** What happened to one clip: which version it keeps and why, the two fits, the two QA verdicts, the metrics that moved. */
export interface ClipChoice {
  kept: "import" | "migrated" | "new" | "adopted";
  why: string;
  fit: { import: [number, number]; migrated?: [number, number] };
  qa: { import: string; migrated?: string };
  /** Each sensor metric that changed, [migrated, import] at three significant digits. */
  moved?: Record<string, [number, number]>;
  /** The hands' points (wrist, knuckle, fist) against the capture, mean mm: [migrated, import], or [import]. */
  hands: number[];
  /** The sensors' fix steps the re-import was repaired with (WP-5.8). */
  repaired?: string[];
  /** The re-import's fit before its repair (mean, worst mm). */
  unrepairedFit?: [number, number];
  /** Why a re-import the sensors flag wasn't repaired: no step of the fix makes it better, or the repair would take it
   *  this many mm further from its source on average (or past the fit limits). */
  unrepaired?: string;
}
/** One set's re-import: its files, every clip's choice, what its catalog skips, and what fails. */
export interface SetImport {
  set: string;
  files: Map<string, string>;
  choices: Record<string, ClipChoice>;
  skipped: { name: string; why: string }[];
  /** Clips the migrated set had that the re-import doesn't (a skip), by slug. */
  dropped: string[];
  /** Problems: validator errors, fit limits passed, a warning no baseline reason covers. */
  errors: string[];
  warnings: string[];
  /** The set's mean fit over the clips it keeps (mm). */
  mean: number;
  /** Over the clips that hold a prop and have a migrated version: how many, and their hands' mean error before and
   *  after (mm). */
  props: { clips: number; migrated: number; import: number } | null;
}

/** The words that name something held in the hands, and the tags that say a clip holds something ("bow" only as a
 *  tag: the library's means archery, a description's may be a curtsey's). */
const PROP_WORDS = new Set("sword swords axe hammer pickaxe shovel rake broom spear shield gun guns pistol rifle torch lantern mug cup bottle bottlecap soda bucket box suitcase basket umbrella phone laptop book violin drum drums guitar knife bread onions sandwich fork saw wrench screwdriver nail bat frisbee glass".split(" "));
const PROP_TAGS = new Set(["prop", "item", "carry", "fish", "gun", "sword", "shield", "bow", "eat"]);
/** Whether a clip holds something in its hands, by the words of its name and description (camelCase and `_` split)
 *  and its tags. */
export function holdsProp(name: string, tags: readonly string[], desc = ""): boolean {
  const words = `${name} ${desc}`.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z]+/);
  return tags.some((t) => PROP_TAGS.has(t)) || words.some((w) => PROP_WORDS.has(w));
}

const RANK: Record<string, number> = { pass: 0, warn: 1, fail: 2 };
const HANDS = ["wristL", "knuckL", "fistL", "wristR", "knuckR", "fistR"].map((n) => format.POINTS.indexOf(n)), PELVIS = format.POINTS.indexOf("pelvis");

/** How near a clip puts the hands' points to the capture's, from the pelvis, frame by frame (mean mm, one decimal): the
 *  hands themselves, not where the body stands (a take stood on its own floor moves the whole capture). */
function handError(clip: Clip, rest: Rest, cap: format.Capture): number {
  const X = new Float32Array(format.P * 3), Y = new Float32Array(format.P * 3), o = PELVIS * 3;
  let sum = 0;
  for (let f = 0; f < cap.n; f++) {
    format.capSample(cap, f / cap.fps, X);
    format.pose(rest, clip, f / cap.fps, Y);
    for (const i of HANDS) sum += PORTABLE.hypot(X[i * 3]! - X[o]! - Y[i * 3]! + Y[o]!, X[i * 3 + 1]! - X[o + 1]! - Y[i * 3 + 1]! + Y[o + 1]!, X[i * 3 + 2]! - X[o + 2]! - Y[i * 3 + 2]! + Y[o + 2]!);
  }
  return Math.round((sum / (cap.n * HANDS.length)) * 10) / 10;
}
const sig = (x: number) => (x === 0 ? 0 : Number(x.toPrecision(3)));
/** A value as JSON with every object's fields in order (a rest's fields come in either order). */
const canon = (v: unknown): string => JSON.stringify(v, (_, x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

/** A clip's fit against its capture as the fitter reports it: the mean of each frame's mean point error, and the worst
 *  point error of any frame (whole mm). */
export function fitOf(clip: Clip, rest: Rest, cap: format.Capture): [number, number] {
  const X = new Float32Array(format.P * 3), Y = new Float32Array(format.P * 3);
  let max = 0, sum = 0;
  for (let f = 0; f < cap.n; f++) {
    format.capSample(cap, f / cap.fps, X);
    format.pose(rest, clip, f / cap.fps, Y);
    max = Math.max(max, format.error(X, Y));
    sum += format.meanError(X, Y);
  }
  return [Math.round(sum / cap.n), Math.round(max)];
}
/**
 * A clip repaired by the sensors' fix (WP-3.5) where it comes out better (a better verdict, or as good with fewer
 * findings), still valid, and no further from its capture than CLOSE mm on average and the fit limits; its facts measured
 * again and its fit against the capture with them. Otherwise the clip as it was.
 */
function repaired(clip: Clip, rest: Rest, cap: format.Capture): { clip: Clip; fit: [number, number]; repairs: string[]; unrepaired?: string; was?: [number, number] } {
  const was = clip.quality.fit as [number, number], out = fix(clip, rest), b = out.before, a = out.after;
  if (b.verdict === "pass") return { clip, fit: was, repairs: [] };
  const better = RANK[a.verdict]! < RANK[b.verdict]! || (a.verdict === b.verdict && a.findings.length < b.findings.length);
  const repairs = out.steps.filter((s) => !s.rejected && !s.skipped && s.changes.length && s.op !== "facts").map((s) => s.op);
  if (!better || !repairs.length || validate(out.clip, { mode: "read" }).errors.length) return { clip, fit: was, repairs: [], unrepaired: "no step makes it better" };
  const next = withFacts(out.clip, rest), fit = fitOf(next, rest, cap);
  const held = repairGuard(was, fit, repairs);
  if (held) return { clip, fit: was, repairs: [], unrepaired: held };
  return { clip: { ...next, quality: { ...next.quality, fit } }, fit, repairs, was };
}

/** Why a repair is held back, or null to keep it: it takes the clip more than CLOSE mm further from its source on
 *  average or past the fit limits, or moves a point more than WORST mm further at its worst (`was` and `fit` the clip's
 *  fit before and after, mean and worst mm). */
export function repairGuard(was: readonly number[], fit: readonly number[], repairs: readonly string[]): string | null {
  if (fit[0]! > was[0]! + CLOSE || fit[0]! > LIMITS.clipMean || fit[1]! > LIMITS.clipWorst) return `${repairs.join(", ")} would take it ${fit[0]! - was[0]!} mm further from its source on average${fit[1]! > LIMITS.clipWorst ? `, ${fit[1]} mm at worst` : ""}`;
  if (fit[1]! > was[1]! + WORST) return `${repairs.join(", ")} would move a point ${fit[1]! - was[1]!} mm further from its source at worst`;
  return null;
}

/**
 * Which version a clip keeps, and why: the re-import, unless it fits its source worse on average or the sensors judge
 * it worse. A re-import the sensors judge better may fit up to CLOSE mm worse on average, and then WORST mm at its worst.
 */
export function choose(now: string, was: string, fit: readonly number[], fitWas: readonly number[]): ["import" | "migrated", string] {
  const better = RANK[now]! < RANK[was]!;
  if (fit[0]! > fitWas[0]! + (better ? CLOSE : 0)) return ["migrated", `the re-import fits its source worse (${fit[0]} mm on average against ${fitWas[0]}${better ? `, more than ${CLOSE} mm worse though the sensors judge it better` : ""})`];
  if (fit[0]! > fitWas[0]! && fit[1]! > fitWas[1]! + WORST) return ["migrated", `the re-import fits its source worse (${fit[0]} mm on average against ${fitWas[0]}, ${fit[1]} mm at worst against ${fitWas[1]})`];
  if (RANK[now]! > RANK[was]!) return ["migrated", `the sensors judge the re-import worse (${was} → ${now})`];
  return ["import", `fits its source ${fit[0]! < fitWas[0]! ? `closer (${fitWas[0]} → ${fit[0]} mm on average)` : fit[0] === fitWas[0] ? `as closely (${fit[0]} mm on average)` : `within ${CLOSE} mm (${fitWas[0]} → ${fit[0]} mm on average)`}${fit[1]! > fitWas[1]! ? `, though further at its worst (${fitWas[1]} → ${fit[1]} mm)` : ""}, and the sensors judge it ${now === was ? "the same" : "better"} (${now})`];
}

/** A clip's QA verdict and metric values on its rest. */
function measured(clip: Clip, rest: Rest): { verdict: string; values: Record<string, number> } {
  const r = metrics(clip, rest);
  return { verdict: r.verdict, values: r.values };
}

/** Re-imports the sets (all of IMPORTS by default). The migrated library is rebuilt once to compare against. */
export function importLibrary(specs: readonly ImportSpec[] = IMPORTS, root = ROOT): SetImport[] {
  const mig = migrate(root), legend = legendLines(root), reasons = readReasons();
  return specs.map((spec) => importOne(spec, mig, legend, reasons, join(root, "library/sets", spec.set)));
}

/** The importer's line in a set's manifest (`content.importer`), with how many clips it keeps as migrated. */
export const importerLine = (migrated: number): string => `${IMPORTER.tool} ${IMPORTER.version}, from the sources (WP-5.3)${migrated ? `; ${migrated} clip(s) kept as m3a-migrate 1 made them (_import.json says why)` : ""}`;

/** A set's mean fit (mm): the mean of its clips' recorded mean fits. */
export const meanFit = (fits: readonly number[]): number => (fits.length ? fits.reduce((a, x) => a + x, 0) / fits.length : 0);

/** A re-imported set's record (its `_import.json` text) and manifest line with its clip `slug` adopted (`a`), as the
 *  next `npm run import` writes them: the clip's choice kept as adopted with why, its source's measures as they were;
 *  the mean over `fits`, the set's clips' recorded mean fits as written. */
export function withAdoption(text: string, slug: string, a: Adoption, fits: readonly number[]): { record: string; importer: string } {
  const r = JSON.parse(text) as { mean: number; clips: Record<string, ClipChoice> };
  if (!r.clips[slug]) throw new Error(`${slug} has no choice in its set's _import.json: only a clip the import made is adopted over it`);
  r.clips[slug] = { ...r.clips[slug], kept: "adopted", why: adoptedWhy(a) };
  r.mean = Number(meanFit(fits).toFixed(1));
  return { record: `${JSON.stringify(r, null, 1)}\n`, importer: importerLine(Object.values(r.clips).filter((c) => c.kept === "migrated").length) };
}

/** The keys a JSON text gives twice in one object (JSON.parse keeps the last and says nothing), each as its path. */
export function duplicateKeys(text: string): string[] {
  const out: string[] = [], stack: { keys: Set<string>; path: string; key?: string }[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      const name = JSON.parse(text.slice(i, j + 1)) as string;
      i = j;
      let k = j + 1;
      while (/\s/.test(text[k] ?? "")) k++;
      const top = stack[stack.length - 1];
      if (text[k] === ":" && top) {
        if (top.keys.has(name)) out.push(`${top.path}${name}`);
        top.keys.add(name);
        top.key = name;
      }
    } else if (ch === "{") stack.push({ keys: new Set(), path: stack.length ? `${stack[stack.length - 1]!.path}${stack[stack.length - 1]!.key ?? ""}.` : "" });
    else if (ch === "}") stack.pop();
  }
  return out;
}

/** One set's re-import against its migrated version (`mig`, the migrator's output; empty for a new set) and its files on
 *  disk in `dir` (adopted clips kept, reviews carried). */
function importOne(spec: ImportSpec, mig: ReturnType<typeof migrate>, legend: string[], reasons: QaReasons, dir: string): SetImport {
  const text = readFileSync(join(CATALOGS, spec.catalog), "utf8"), twice = duplicateKeys(text);
  if (twice.length) throw new Error(`library/catalogs/${spec.catalog} names ${twice.join(", ")} twice: JSON keeps only the last`);
  const cat = JSON.parse(text) as Catalog, libs = spec.read(cat);
  const out = importSet(libs, cat, { name: spec.set, title: spec.title, credit: spec.credit, encode: ENCODE });
  const capOf = (name: string) => libs.find((l) => l.clips[name])?.clips[name];
  // a catalog of picks may skip what it never picks (a style no loop plays in place): on record, not a missing clip
  const picked = cat.$pick ? new Set(Object.keys(cat.$pick)) : null, unpicked = (w: string) => /^\$skip names (\S+), which no library has$/.exec(w)?.[1];
  for (const w of out.report.warnings) {
    const n = unpicked(w);
    if (n && picked && !picked.has(n)) out.report.skipped.push({ name: n, why: cat.$skip![n]! });
  }
  const errors: string[] = [], warnings = out.report.warnings.filter((w) => !(picked && unpicked(w) && !picked.has(unpicked(w)!))), choices: Record<string, ClipChoice> = {};
  // the migrated set: its clips by name, its files, its manifest
  const prefix = `${spec.set}/`, migClips = new Map<string, Clip>(), migFiles = new Map<string, string>();
  for (const [id, { clip }] of mig.clips) if (id.startsWith(prefix)) migClips.set(clip.name, clip);
  for (const [p, t] of mig.files) if (p.startsWith(prefix)) migFiles.set(p.slice(prefix.length), t);
  const migManifest = migFiles.has("_set.json") ? (JSON.parse(migFiles.get("_set.json")!) as { sources: Record<string, { rest: Rest }> }) : null;
  const migBaseline = migFiles.has("_baseline.json") ? (JSON.parse(migFiles.get("_baseline.json")!) as { clips: Record<string, { code: string; at: string; reason: string }[]> }).clips : {};
  // slugs: a clip the migrated set has keeps its; a new one takes its own, unique within the set
  const taken = new Set([...migClips.values()].map((c) => c.id.slice(prefix.length))), names = Object.keys(out.set.clips), slugOf = new Map<string, string>();
  const fresh = format.slugs(names);
  names.forEach((n, i) => {
    const old = migClips.get(n);
    if (old) slugOf.set(n, old.id.slice(prefix.length));
    else {
      let s = fresh[i]!, k = 2;
      while (taken.has(s)) s = `${fresh[i]!}_${k++}`;
      taken.add(s);
      slugOf.set(n, s);
    }
  });
  // the sources: the re-import's records, the rule's license; a migrated clip kept needs its rest unchanged
  const srcRecords: Record<string, Record<string, unknown>> = {};
  for (const [id, s] of Object.entries(out.set.sources)) {
    const rule = spec.sources(id), { label, origin, url, file, rig, rest } = s as Record<string, unknown>;
    srcRecords[id] = { label, origin, license: rule.license, terms: rule.terms ?? (s as { license?: string }).license, url, ...(rule.credit ? { credit: rule.credit } : {}), file, rig, rest };
  }
  const clipFiles = new Map<string, string>(), rows: string[] = [], baseline: Record<string, { code: string; at: string; reason: string }[]> = {};
  const fits: number[] = [], candidate = new Map<string, ClipChoice["kept"]>(), onBase = baselineOn(dir);
  const diskSources = existsSync(join(dir, "_set.json")) ? (JSON.parse(readFileSync(join(dir, "_set.json"), "utf8")) as { sources: Record<string, Record<string, unknown>> }).sources : {};
  for (const name of names) {
    const c1 = out.set.clips[name]!, slug = slugOf.get(name)!, src = c1.src, rule = spec.sources(src), rest = out.set.sources[src]!.rest, cap = capOf(name)!;
    const before = migClips.get(name), orig = before?.provenance.orig ?? c1.orig;
    // its facts and contacts measured on its rest (WP-5.4), the capture's speed kept; then repaired where the sensors'
    // fix makes it better without taking it from its source (WP-5.8)
    const made = withFacts(fromFormat1({ ...(c1 as unknown as format.Clip1), src, ...(orig ? { orig } : {}) }, { set: spec.set, slug, name, fps: out.set.fps, restSrc: src, method: rule.method, license: rule.license, ...(rule.credit ? { credit: rule.credit } : {}), fit: out.set.fit[name]!, producer: IMPORTER, qaVersion: "none" }), rest);
    const { clip, fit, repairs, unrepaired, was: unrepairedFit } = repaired(made, rest, cap);
    const now = measured(clip, rest), hands = handError(clip, rest, cap);
    let kept: ClipChoice["kept"] = before ? "import" : "new", why = before ? "" : "new in the re-import";
    const choice: ClipChoice = { kept, why, fit: { import: fit }, qa: { import: now.verdict }, hands: [hands], ...(repairs.length ? { repaired: repairs, unrepairedFit: unrepairedFit! } : {}), ...(unrepaired ? { unrepaired } : {}) };
    if (before) {
      const migRest = migManifest!.sources[before.restSrc]!.rest, was = measured(before, migRest), fitWas = before.quality.fit as [number, number];
      choice.fit.migrated = fitWas;
      choice.qa.migrated = was.verdict;
      choice.hands = [handError(before, migRest, cap), hands];
      const moved: Record<string, [number, number]> = {};
      for (const k of new Set([...Object.keys(was.values), ...Object.keys(now.values)])) if (sig(was.values[k] ?? 0) !== sig(now.values[k] ?? 0)) moved[k] = [sig(was.values[k] ?? 0), sig(now.values[k] ?? 0)];
      if (Object.keys(moved).length) choice.moved = moved;
      [kept, why] = choose(now.verdict, was.verdict, fit, fitWas);
      choice.kept = kept;
      choice.why = why;
    }
    choices[slug] = choice;
    candidate.set(slug, kept);
    // a clip the owner adopted is kept as adopted, on the rest it was made on, its source's measures beside it
    const was = onDisk(dir, slug), adoption = was && adoptionOf(was);
    if (adoption) [choice.kept, choice.why] = ["adopted", adoptedWhy(adoption)];
    let chosen = adoption ? was! : kept === "migrated" ? before! : clip;
    if (adoption) {
      const own = diskSources[chosen.restSrc];
      if (!own) errors.push(`${slug}: adopted on the rest ${chosen.restSrc}, which its set's manifest hasn't`);
      else if (!srcRecords[chosen.restSrc]) srcRecords[chosen.restSrc] = own;
      else if (canon(srcRecords[chosen.restSrc]!.rest) !== canon(own.rest)) errors.push(`${slug}: adopted on ${chosen.restSrc}'s rest as its set had it, which the re-import measures anew: the owner adopts it again on the new rest`);
    }
    // a migrated clip kept decodes on the rest it was made on; the re-import measures its source's rest anew (another
    // pick from the same performer moves the spine's shares), so where they differ the old rest stays as a record of
    // its own (`<source>_MIGRATED`) and the clip names it
    if (!adoption && kept === "migrated" && canon(migManifest!.sources[before!.restSrc]!.rest) !== canon(srcRecords[before!.restSrc]?.rest)) {
      const own = srcRecords[before!.restSrc];
      if (!own) errors.push(`${slug}: kept as migrated, but its source ${before!.restSrc} is gone from the re-import`);
      else {
        const id = `${before!.restSrc}_MIGRATED`;
        srcRecords[id] ??= { ...own, rest: migManifest!.sources[before!.restSrc]!.rest };
        chosen = { ...before!, restSrc: id };
        choice.why += `; on the rest it was made on (${id}: the re-import measures ${before!.restSrc}'s anew)`;
      }
    }
    const f = chosen.quality.fit;
    fits.push(f[0]!);
    if (f[0]! > LIMITS.clipMean || f[1]! > LIMITS.clipWorst) errors.push(`${slug}: fits its source within ${f[0]} mm on average, ${f[1]} mm at worst (limits ${LIMITS.clipMean} and ${LIMITS.clipWorst}): leave it out with a reason ($skip), or fix it`);
    // its QA verdict, with why the clip is kept so when the sensors flag it (WP-5.8)
    const decodes = adoption ? ((srcRecords[chosen.restSrc]?.rest ?? diskSources[chosen.restSrc]?.rest ?? rest) as Rest) : kept === "migrated" ? ((srcRecords[chosen.restSrc]?.rest as Rest | undefined) ?? migManifest!.sources[chosen.restSrc]!.rest) : rest;
    chosen = withQuality(chosen, decodes, reasons, adoption ? {} : kept === "migrated" ? { migrated: choice.why.split(";")[0]! } : { repaired: repairs, ...(unrepaired ? { unrepaired } : {}) });
    if (!adoption) chosen = carryReview(chosen, was);
    const r = validate(chosen, { mode: "read" });
    for (const e of r.errors) errors.push(`${slug}: ${e.code} ${e.message}`);
    if (adoption) {
      if (onBase[slug]) baseline[slug] = onBase[slug]!;
    } else if (kept === "migrated") {
      if (migBaseline[slug]) baseline[slug] = migBaseline[slug]!;
    } else if (r.warnings.length) {
      try {
        baseline[slug] = r.warnings.map((w) => ({ code: w.code, at: `${w.key !== undefined ? `key ${w.key} (t ${w.t}) ` : ""}${w.field ?? ""}${w.index !== undefined ? `[${w.index}]` : ""}`, reason: baselineReason(w, r.warnings, chosen.keys as unknown as Record<string, unknown>[]) }));
      } catch (err) {
        errors.push(`${slug}: ${(err as Error).message}`);
      }
    }
    clipFiles.set(`${slug}.json`, serialize(chosen));
    rows.push(catalogRow(chosen));
  }
  const mean = meanFit(fits);
  // the hands on clips that hold a prop: before (migrated) and after (as kept)
  const withProps = names.map((n) => ({ n, c: choices[slugOf.get(n)!]!, clip: out.set.clips[n]! })).filter(({ n, c, clip }) => c.hands.length === 2 && holdsProp(n, clip.tags ?? [], clip.desc));
  const avg = (xs: number[]) => Math.round((xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length)) * 10) / 10;
  // (an adopted clip counted as the version its source gives: the record measures the sources)
  const props = withProps.length ? { clips: withProps.length, migrated: avg(withProps.map(({ c }) => c.hands[0]!)), import: avg(withProps.map(({ n, c }) => (candidate.get(slugOf.get(n)!) === "migrated" ? c.hands[0]! : c.hands[1]!))) } : null;
  if (mean > LIMITS.setMean) errors.push(`the set fits its sources within ${mean.toFixed(1)} mm on average (limit ${LIMITS.setMean})`);
  const dropped = [...migClips.values()].map((c) => c.id.slice(prefix.length)).filter((s) => !clipFiles.has(`${s}.json`));
  const kept = Object.values(choices), migratedKept = kept.filter((c) => c.kept === "migrated").length;
  const manifest: Record<string, unknown> = {
    set: spec.set,
    title: spec.title,
    format: "2.0",
    tier: spec.tier,
    content: { edition: spec.edition, importer: importerLine(migratedKept), sha256: contentId(clipFiles) },
    credit: spec.credit,
    producer: IMPORTER,
    sources: srcRecords,
    ...(out.set.body ? { body: out.set.body } : {}),
    legend: { version: "2.0", text: legend },
  };
  const v = validate(manifest, { kind: "set" });
  for (const e of v.errors) errors.push(`_set.json: ${e.code} ${e.message}`);
  const files = new Map<string, string>();
  for (const [f, t] of clipFiles) files.set(f, t);
  files.set("_set.json", setText(manifest));
  files.set("catalog.tsv", `${rows.join("\n")}\n`);
  files.set("_baseline.json", `${JSON.stringify({ about: "Validator warnings accepted per clip, each with its reason (WP-1.5, WP-5.3). A new warning, or one gone, fails library/migrated's test.", clips: baseline }, null, 1)}\n`);
  files.set("_import.json", `${JSON.stringify({ about: `The re-import (WP-5.3) by ${IMPORTER.tool} ${IMPORTER.version}: each clip's choice between its re-import and its migrated version, with why; both fits (mean, worst mm against the source); both QA verdicts; the sensor metrics that moved ([migrated, re-import]); the hands' mean error against the capture ([migrated, re-import] mm; props: over the clips that hold something); what the catalog skips; the clips the migrated set had that are gone.`, mean: Number(mean.toFixed(1)), props, clips: choices, skipped: out.report.skipped, dropped }, null, 1)}\n`);
  return { set: spec.set, files, choices, skipped: out.report.skipped, dropped, errors, warnings, mean, props };
}

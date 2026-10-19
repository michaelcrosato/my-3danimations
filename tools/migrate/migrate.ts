// Builds the migrated library in memory (WP-1.5): every seed set's clips as format-2 files written by core's
// `serialize`, each with its facts and contacts measured (@m3a/library's `withFacts`, WP-5.4) and its QA verdict
// (tools/qa/verdict.ts, WP-5.8), with `_set.json` (sources, rests, tier, content id), `catalog.tsv` (both by
// @m3a/library's set writer, which moved there from here, D93) and `_baseline.json` (the validator's warnings, accepted
// per clip with a reason). Deterministic: the same pins give the same bytes and content ids. Read against the library on
// disk (`disk`, as `npm run migrate` does), a clip the owner adopted is kept over its source's, on the rest its set
// recorded (a source that measures that rest otherwise since is an error: the owner adopts it again on the new rest),
// its accepted warnings as its set's baseline gives them, and a clip's review is carried while its motion hash matches
// (./adopted.ts).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format, validate, type Clip, type Rest } from "@m3a/core";
import { catalogRow as libraryRow, contentId as libraryContentId, setFiles, setText, withFacts } from "@m3a/library";

const { fromFormat1, slugs } = format;
type Clip1 = format.Clip1;
import { encode as tokens } from "gpt-tokenizer/encoding/cl100k_base";
import { loadSet, type Set1 } from "../vectors/oracle.ts";
import { readReasons, withQuality } from "../qa/verdict.ts";
import { adoptedWhy, adoptionOf, baselineOn, carryReview, onDisk, restOn, sameRest } from "./adopted.ts";
import { baselineReason, SETS, type SetSpec } from "./sets.ts";

/** The migrator's own revision: it goes in every file it writes, so a change to its output is a change to this. */
export const MIGRATOR = { tool: "m3a-migrate", version: "1" };

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** A format-1 set, read from the pins cache as its repository stores it. */
export function readSource(root: string, spec: SetSpec): Set1 {
  if (spec.from.repo === "my-3d2dge") return loadSet(root, spec.from.file.replace(/^src\/mocap\/sets\/|\.js$/g, ""));
  const text = readFileSync(join(root, ".cache/src/shardfall", spec.from.file), "utf8");
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, "")) as Set1;
}

/** The legend's text lines (spec/LEGEND.md without its heading). */
export function legendLines(root: string): string[] {
  return readFileSync(join(root, "spec/LEGEND.md"), "utf8").split("\n").filter((l, i) => !(i === 0 && l.startsWith("#")) && l.trim() !== "");
}

/** cl100k tokens of a text, as the doctrine's budgets count them. */
const cl100k = (t: string): number => tokens(t).length;

/** A set manifest as text: @m3a/library's writer (moved there, D93). */
export { setText };

/** One catalog row (spec/MOTION.md §9.3) within its 40 cl100k tokens: @m3a/library's writer, given the tokenizer. */
export const catalogRow = (c: Clip): string => libraryRow(c, cl100k);

/** The SHA-256 content id of a set's clip files (spec/MOTION.md §9.2), from their texts. */
export const contentId = (files: Map<string, string>): string => libraryContentId(Object.fromEntries([...files].map(([n, t]) => [n, sha256(t)])), sha256);

/** What the migration found besides the files: per set, clip counts, warnings and unresolved references. */
export interface MigrationReport {
  sets: { set: string; clips: number; warnings: number; errors: string[]; unresolvedOrig: string[]; adopted: { id: string; why: string }[] }[];
}

/** How to migrate: the sets read against the library on disk (`disk.dir`, its library/sets/; the sets the build writes
 *  there, `disk.sets`: adopted clips kept, reviews carried; none by default, the pins alone), and only the sets named in
 *  `sets` (all by default). */
export interface MigrateOptions {
  disk?: { dir: string; sets: readonly string[] };
  sets?: readonly string[];
}

/** Build every migrated file, keyed by its path under library/sets/; `adopted` in the report names each clip kept as
 *  the owner adopted it, with why. */
export function migrate(root: string, opts: MigrateOptions = {}): { files: Map<string, string>; report: MigrationReport; clips: Map<string, { source: Clip1; clip: Clip }> } {
  const files = new Map<string, string>();
  const report: MigrationReport = { sets: [] };
  const all = new Map<string, { source: Clip1; clip: Clip }>();
  const legend = legendLines(root), reasons = readReasons();
  const sources = SETS.filter((s) => !opts.sets || opts.sets.includes(s.set)).map((s) => ({ spec: s, data: readSource(root, s) }));
  // a Mesh2Motion clip's orig names the Quaternius clip it was made from: point it at the import that has it
  const quaternius = sources.filter((s) => s.spec.set.startsWith("QUATERNIUS")).map((s) => ({ set: s.spec.set, slugs: new Map(Object.keys(s.data.clips).map((n, i) => [n, slugs(Object.keys(s.data.clips))[i]!])) }));
  const resolveOrig = (orig: string): string | null => {
    const [, name] = orig.split("/");
    for (const q of [...quaternius].reverse()) if (name && q.slugs.has(name)) return `${q.set}/${q.slugs.get(name)}`;
    return null;
  };
  for (const { spec, data } of sources) {
    const names = Object.keys(data.clips);
    const slugList = slugs(names);
    const ids = Object.keys(data.sources);
    const made: Clip[] = [];
    const baseline: Record<string, { code: string; at: string; reason: string }[]> = {};
    const errors: string[] = [];
    const unresolved: string[] = [], adopted: { id: string; why: string }[] = [], onSets = opts.disk?.sets.includes(spec.set) ? join(opts.disk.dir, spec.set) : null, onBase = onSets ? baselineOn(onSets) : {};
    let warnings = 0;
    names.forEach((name, i) => {
      const c1 = data.clips[name] as unknown as Clip1;
      const src = c1.src && data.sources[c1.src] ? c1.src : ids[0]!;
      const rule = spec.sources(src);
      const fit = data.fit?.[name] as [number, number] | undefined;
      let orig = c1.orig;
      if (orig) {
        const r = resolveOrig(orig);
        if (r) orig = r;
        else unresolved.push(`${name}: ${orig}`);
      }
      // its facts and contacts measured on its rest (WP-5.4), the origin's speed kept as captured; its QA verdict (WP-5.8)
      const rest = (data.sources[src] as unknown as { rest: Rest }).rest;
      const fresh = withQuality(withFacts(fromFormat1({ ...c1, src, ...(orig ? { orig } : {}) }, { set: spec.set, slug: slugList[i]!, name, fps: (data.fps as number) ?? 30, restSrc: src, method: rule.method, license: rule.license, ...(rule.credit ? { credit: rule.credit } : {}), ...(fit ? { fit } : {}), producer: MIGRATOR, qaVersion: "none" }), rest), rest, reasons);
      // an adopted clip kept as the owner adopted it, on the rest its set recorded then (the motion hash names the rest's
      // source, not its numbers: a source measured otherwise since would play the approved keys on another body), its
      // verdict recorded on that rest
      const was = onSets ? onDisk(onSets, slugList[i]!) : null, adoption = was && adoptionOf(was), on = was && (data.sources[was.restSrc] as unknown as { rest: Rest } | undefined)?.rest;
      const had = adoption ? restOn(onSets!, was!.restSrc) : undefined, keep = !!(adoption && on && had && sameRest(on, had));
      if (adoption && !on) errors.push(`${name}: adopted on the rest ${was!.restSrc}, which its source no longer has`);
      else if (adoption && !had) errors.push(`${name}: adopted on the rest ${was!.restSrc}, which its set's manifest hasn't`);
      else if (adoption && !keep) errors.push(`${name}: adopted on ${was!.restSrc}'s rest as its set had it, which its source now measures otherwise: the owner adopts it again on the new rest`);
      const clip = keep ? withQuality(was!, on!, reasons) : carryReview(fresh, was);
      if (keep) adopted.push({ id: clip.id, why: adoptedWhy(adoption!) });
      const r = validate(clip, { mode: "read" });
      for (const e of r.errors) errors.push(`${name}: ${e.code} ${e.message}`);
      if (keep) {
        if (onBase[slugList[i]!]) baseline[slugList[i]!] = onBase[slugList[i]!]!;
        warnings += r.warnings.length;
      } else if (r.warnings.length) {
        warnings += r.warnings.length;
        baseline[slugList[i]!] = r.warnings.map((w) => ({ code: w.code, at: `${w.key !== undefined ? `key ${w.key} (t ${w.t}) ` : ""}${w.field ?? ""}${w.index !== undefined ? `[${w.index}]` : ""}`, reason: baselineReason(w, r.warnings, clip.keys as unknown as Record<string, unknown>[]) }));
      }
      made.push(clip);
      all.set(clip.id, { source: c1, clip });
    });
    const srcRecords: Record<string, unknown> = {};
    for (const id of ids) {
      const s = data.sources[id] as Record<string, unknown>;
      const rule = spec.sources(id);
      srcRecords[id] = { label: s.label, origin: s.origin, license: rule.license, terms: rule.terms ?? s.license, url: s.url, ...(rule.credit ? { credit: rule.credit } : {}), ...(rule.audit ? { audit: rule.audit } : {}), file: s.file, rig: s.rig, rest: s.rest };
    }
    const manifest: Record<string, unknown> = {
      set: spec.set,
      title: spec.title,
      format: "2.0",
      tier: spec.tier,
      content: { edition: spec.edition, importer: `${MIGRATOR.tool} ${MIGRATOR.version}, from format 1 (${spec.from.repo} ${spec.from.file})` },
      credit: spec.credit,
      producer: MIGRATOR,
      sources: srcRecords,
      ...(data.body ? { body: data.body } : {}),
      legend: { version: "2.0", text: legend },
    };
    // the clips, catalog.tsv and _set.json (its content id filled in) as @m3a/library's writer writes them
    const dir = spec.set, out = setFiles(manifest as typeof manifest & { content: Record<string, unknown> }, made, { sha256, tokens: cl100k });
    const v = validate(JSON.parse(out.get("_set.json")!), { kind: "set" });
    for (const e of v.errors) errors.push(`_set.json: ${e.code} ${e.message}`);
    for (const [f, t] of out) files.set(`${dir}/${f}`, t);
    files.set(`${dir}/_baseline.json`, JSON.stringify({ about: "Validator warnings accepted per clip at migration, each with its reason (WP-1.5). A new warning, or one gone, fails library/migrated's test.", clips: baseline }, null, 1) + "\n");
    report.sets.push({ set: spec.set, clips: names.length, warnings, errors, unresolvedOrig: unresolved, adopted });
  }
  return { files, report, clips: all };
}

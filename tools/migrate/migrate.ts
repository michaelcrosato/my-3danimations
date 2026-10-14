// Builds the migrated library in memory (WP-1.5): every seed set's clips as format-2 files written by core's
// `serialize`, each with its facts and contacts measured (@m3a/library's `withFacts`, WP-5.4) and its QA verdict
// (tools/qa/verdict.ts, WP-5.8), with `_set.json` (sources, rests, tier, content id), `catalog.tsv` and
// `_baseline.json` (the validator's warnings, accepted per clip with a reason). Deterministic: the same pins give the
// same bytes and content ids.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format, serialize, validate, type Clip, type Rest } from "@m3a/core";
import { withFacts } from "@m3a/library";

const { fromFormat1, slugs } = format;
type Clip1 = format.Clip1;
import { encode as tokens } from "gpt-tokenizer/encoding/cl100k_base";
import { loadSet, type Set1 } from "../vectors/oracle.ts";
import { readReasons, withQuality } from "../qa/verdict.ts";
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

/** A set manifest as text: one field per line, each source on a line of its own, the legend one line per line. */
export function setText(m: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(m)) {
    if (k === "sources") {
      const s = Object.entries(v as Record<string, unknown>).map(([id, src]) => `  ${JSON.stringify(id)}: ${JSON.stringify(src)}`);
      lines.push(`"sources": {\n${s.join(",\n")}\n}`);
    } else if (k === "legend") {
      const l = v as { version: string; text: string[] };
      lines.push(`"legend": {"version": ${JSON.stringify(l.version)}, "text": [\n${l.text.map((t) => `  ${JSON.stringify(t)}`).join(",\n")}\n]}`);
    } else lines.push(`${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  }
  return `{\n${lines.join(",\n")}\n}\n`;
}

/** A catalog row's token budget (DOCTRINE.md principle 1). */
export const ROW_BUDGET = 40;

/** A description cut to fit `room` tokens: its first sentence, then the last clause that fits, then whole words and "…". */
export function shorten(what: string, room: number): string {
  const fits = (t: string) => tokens(t).length <= room;
  if (fits(what)) return what;
  const first = what.split(/(?<=\.) /)[0]!.replace(/\.$/, "");
  if (fits(first)) return first;
  const cuts = [...first.matchAll(/[,:;]/g)].map((m) => m.index!).reverse();
  for (const i of cuts) if (fits(first.slice(0, i))) return first.slice(0, i);
  const words = first.split(" ");
  while (words.length > 1 && !fits(words.join(" ") + "…")) words.pop();
  return words.join(" ") + "…";
}

/** One catalog row: id, seconds, loop or once, speed, tags, what the body does, source (spec/MOTION.md §9.3), within 40 tokens. */
export function catalogRow(c: Clip): string {
  const speed = c.facts && typeof c.facts.speed === "number" ? String(c.facts.speed) : "";
  const cols = [c.id, String(c.dur), c.loop ? "loop" : "once", speed, c.tags.join(" "), "", c.provenance.src];
  const room = ROW_BUDGET - tokens(cols.join("\t")).length;
  cols[5] = shorten(c.desc || c.name.replace(/_/g, " "), room);
  return cols.join("\t");
}

/** The SHA-256 content id of a set's clip files (spec/MOTION.md §9.2). */
export function contentId(files: Map<string, string>): string {
  const names = [...files.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sha256(names.map((n) => `${n}\n${sha256(files.get(n)!)}\n`).join(""));
}

/** What the migration found besides the files: per set, clip counts, warnings and unresolved references. */
export interface MigrationReport {
  sets: { set: string; clips: number; warnings: number; errors: string[]; unresolvedOrig: string[] }[];
}

/** Build every migrated file, keyed by its path under library/sets/. */
export function migrate(root: string): { files: Map<string, string>; report: MigrationReport; clips: Map<string, { source: Clip1; clip: Clip }> } {
  const files = new Map<string, string>();
  const report: MigrationReport = { sets: [] };
  const all = new Map<string, { source: Clip1; clip: Clip }>();
  const legend = legendLines(root), reasons = readReasons();
  const sources = SETS.map((s) => ({ spec: s, data: readSource(root, s) }));
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
    const clipFiles = new Map<string, string>();
    const rows: string[] = [];
    const baseline: Record<string, { code: string; at: string; reason: string }[]> = {};
    const errors: string[] = [];
    const unresolved: string[] = [];
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
      const clip = withQuality(withFacts(fromFormat1({ ...c1, src, ...(orig ? { orig } : {}) }, { set: spec.set, slug: slugList[i]!, name, fps: (data.fps as number) ?? 30, restSrc: src, method: rule.method, license: rule.license, ...(rule.credit ? { credit: rule.credit } : {}), ...(fit ? { fit } : {}), producer: MIGRATOR, qaVersion: "none" }), rest), rest, reasons);
      const r = validate(clip, { mode: "read" });
      for (const e of r.errors) errors.push(`${name}: ${e.code} ${e.message}`);
      if (r.warnings.length) {
        warnings += r.warnings.length;
        baseline[slugList[i]!] = r.warnings.map((w) => ({ code: w.code, at: `${w.key !== undefined ? `key ${w.key} (t ${w.t}) ` : ""}${w.field ?? ""}${w.index !== undefined ? `[${w.index}]` : ""}`, reason: baselineReason(w, r.warnings, clip.keys as unknown as Record<string, unknown>[]) }));
      }
      const text = serialize(clip);
      clipFiles.set(`${slugList[i]}.json`, text);
      rows.push(catalogRow(clip));
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
      content: { edition: spec.edition, importer: `${MIGRATOR.tool} ${MIGRATOR.version}, from format 1 (${spec.from.repo} ${spec.from.file})`, sha256: contentId(clipFiles) },
      credit: spec.credit,
      producer: MIGRATOR,
      sources: srcRecords,
      ...(data.body ? { body: data.body } : {}),
      legend: { version: "2.0", text: legend },
    };
    const v = validate(manifest, { kind: "set" });
    for (const e of v.errors) errors.push(`_set.json: ${e.code} ${e.message}`);
    const dir = spec.set;
    for (const [f, t] of clipFiles) files.set(`${dir}/${f}`, t);
    files.set(`${dir}/_set.json`, setText(manifest));
    files.set(`${dir}/catalog.tsv`, rows.join("\n") + "\n");
    files.set(`${dir}/_baseline.json`, JSON.stringify({ about: "Validator warnings accepted per clip at migration, each with its reason (WP-1.5). A new warning, or one gone, fails library/migrated's test.", clips: baseline }, null, 1) + "\n");
    report.sets.push({ set: spec.set, clips: names.length, warnings, errors, unresolvedOrig: unresolved });
  }
  return { files, report, clips: all };
}

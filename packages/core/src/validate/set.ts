// Validates a set manifest (`_set.json`) and catalog rows (`catalog.tsv`), spec/MOTION.md §9.
import { FORMAT, TIERS } from "../format/types.ts";
import { Findings, nearest, type Result } from "./issues.ts";
import type { ValidateOptions } from "./clip.ts";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const SET_FIELDS = ["set", "title", "format", "legend", "tier", "content", "sources", "credit", "producer", "body"];

/** Validate a parsed `_set.json`. */
export function validateSet(data: unknown, opts: ValidateOptions = {}): Result {
  const f = new Findings();
  if (!isObj(data)) {
    f.add("M2-E101", {}, "a set manifest is a JSON object");
    return f.result();
  }
  const clip = typeof data.set === "string" ? data.set : "set";
  const at = (field: string) => ({ clip, field });
  const need = (name: string, type: "string" | "object") => {
    const v = data[name];
    const ok = type === "object" ? isObj(v) : typeof v === "string";
    if (!ok) f.add("M2-E101", at(name), `"${name}" is ${v === undefined ? "missing" : `not ${type === "object" ? "an object" : "a string"}`}`, "spec/MOTION.md §9.1 lists the fields");
    return ok;
  };
  if (need("set", "string") && !/^[A-Z0-9_]+$/.test(data.set as string)) f.add("M2-E102", at("set"), `set ${JSON.stringify(data.set)} is not upper case A-Z, 0-9 and _`);
  need("title", "string");
  if (need("format", "string") && data.format !== FORMAT) f.add("M2-E102", at("format"), `format ${JSON.stringify(data.format)} is not "${FORMAT}"`);
  if (need("legend", "object")) {
    const l = data.legend as Record<string, unknown>;
    if (typeof l.version !== "string" || !Array.isArray(l.text) || !l.text.every((x) => typeof x === "string")) f.add("M2-E101", at("legend"), "legend is { version, text: [lines] }");
  }
  if (need("tier", "string") && !(TIERS as readonly string[]).includes(data.tier as string)) f.add("M2-E102", at("tier"), `tier ${JSON.stringify(data.tier)} is not one of ${TIERS.join(", ")}`);
  if (need("content", "object")) {
    const c = data.content as Record<string, unknown>;
    if (typeof c.edition !== "string" || typeof c.importer !== "string") f.add("M2-E101", at("content"), "content is { edition, importer, sha256 }");
    if (typeof c.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(c.sha256)) f.add("M2-E102", at("content.sha256"), "content.sha256 is 64 lower-case hex digits (spec/MOTION.md §9.2)");
  }
  if (need("sources", "object")) {
    const s = data.sources as Record<string, unknown>;
    if (!Object.keys(s).length) f.add("M2-E101", at("sources"), "a set has at least one source");
    for (const [id, src] of Object.entries(s)) {
      if (!isObj(src)) {
        f.add("M2-E101", at(`sources.${id}`), "a source is an object");
        continue;
      }
      for (const k of ["label", "origin", "license", "url"]) if (typeof src[k] !== "string") f.add("M2-E101", at(`sources.${id}.${k}`), `sources.${id}.${k} is ${src[k] === undefined ? "missing" : "not a string"}`);
      for (const k of ["terms", "credit", "audit", "file", "rig"]) if (src[k] !== undefined && typeof src[k] !== "string") f.add("M2-E101", at(`sources.${id}.${k}`), `sources.${id}.${k} is not a string`);
      if (!isObj(src.rest) || typeof src.rest.H0 !== "number") f.add("M2-E101", at(`sources.${id}.rest`), "a source carries its measured rest body (H0, the frames, the lengths, the shares)", "spec/MOTION.md §3.2");
      else if (!(src.rest.H0 > 0) || !Number.isFinite(src.rest.H0)) f.add("M2-E101", at(`sources.${id}.rest.H0`), `rest.H0 ${src.rest.H0} is not a positive height`, "H0 is the pelvis's standing height in millimetres (spec/MOTION.md §3.2)");
    }
  }
  need("credit", "string");
  if (need("producer", "object")) {
    const p = data.producer as Record<string, unknown>;
    if (typeof p.tool !== "string" || typeof p.version !== "string") f.add("M2-E101", at("producer"), "producer is { tool, version }");
  }
  if (opts.mode === "lint") for (const k of Object.keys(data)) if (!SET_FIELDS.includes(k)) f.add("M2-W001", at(k), `unknown field "${k}"`, nearest(k, SET_FIELDS) ? `did you mean "${nearest(k, SET_FIELDS)}"?` : "readers ignore it");
  return f.result();
}

/** Validate one catalog row: `id`, seconds, `loop`|`once`, speed (or empty), tags, what the body does, source. */
export function validateCatalogRow(row: string, line?: number): Result {
  const f = new Findings();
  const cols = row.split("\t");
  const where = (field: string) => ({ clip: cols[0] || `row ${line ?? "?"}`, field });
  if (cols.length !== 7) {
    f.add("M2-E110", where("row"), `${cols.length} columns; a row has 7: id, seconds, loop|once, speed, tags, what, source`);
    return f.result();
  }
  const [id, secs, loop, speed, , what] = cols as [string, string, string, string, string, string, string];
  if (!/^[A-Z0-9_]+\/[A-Za-z0-9_-]+$/.test(id)) f.add("M2-E111", where("id"), `id "${id}" is not SET/Slug`);
  if (!/^\d+(\.\d+)?$/.test(secs)) f.add("M2-E111", where("seconds"), `seconds "${secs}" is not a number`);
  if (loop !== "loop" && loop !== "once") f.add("M2-E111", where("loop"), `"${loop}" is not loop or once`);
  if (speed !== "" && !/^-?\d+(\.\d+)?$/.test(speed)) f.add("M2-E111", where("speed"), `speed "${speed}" is not a number or empty`);
  if (!what.trim()) f.add("M2-E111", where("what"), "says nothing about what the body does", "a few plain words: walks forward, relaxed");
  return f.result();
}

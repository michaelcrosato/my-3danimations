// The text lenses and mirroring (spec/MOTION.md §14): format 1's `text` and `parse` exactly as my-3d2dge writes and
// reads them (readable.js:303-335; tier 2 hashes their output), the format-2 key lens (three short lines per key, the
// new fields in their groups), and `mirror`, which swaps L and R and flips turns and tilts.
import { KEY_FIELDS } from "./types.ts";
import type { KeyLike } from "./pose.ts";

/** Format 1's field groups, one line each: torso, arms, legs. */
export const GROUPS_1 = [["hips", "body", "chest", "head", "root"], ["shL", "shR", "armL", "armR", "blade"], ["legL", "legR", "footL", "footR"]] as const;
/** Format 2's field groups: format 1's with the new optional fields in place. */
export const GROUPS_2 = [["hips", "body", "chest", "head", "root", "yaw", "spine"], ["shL", "shR", "armL", "armR", "handL", "handR", "fingersL", "fingersR", "blade"], ["legL", "legR", "footL", "footR"]] as const;
const FORMAT1_FIELDS = ["hips", "body", "chest", "head", "shL", "shR", "armL", "armR", "legL", "legR", "footL", "footR", "blade", "root"];
const REQUIRED = ["hips", "body", "chest", "head", "armL", "armR", "legL", "legR"];

/** A clip as the lenses see it: any header fields plus keys. */
export interface Lensed {
  keys: KeyLike[];
  [field: string]: unknown;
}

/** One key as the lens writes it: `{"t":…,` then one line per group, each field as compact JSON. */
export function keyLines(k: KeyLike, groups: readonly (readonly string[])[], indent = "  "): string {
  const line = (g: readonly string[]) => `${indent} ` + g.filter((f) => k[f] !== undefined).map((f) => `"${f}":${JSON.stringify(k[f])}`).join(", ");
  const known = new Set<string>(["t", ...groups.flat()]);
  const extra = Object.keys(k).filter((f) => !known.has(f)).sort();
  const lines = groups.map(line).filter((l) => l.trim() !== "");
  if (extra.length) lines.push(line(extra));
  return `${indent}{"t":${k.t},\n` + lines.join(",\n") + "}";
}

/** Format 1's text: the clip's header on one line, then each key as three short lines (bit for bit as the origin). */
export function text1(o: Lensed): string {
  const head = Object.entries(o).filter(([k]) => k !== "keys").map(([k, v]) => JSON.stringify(k) + ": " + JSON.stringify(v)).join(", ");
  const line = (k: KeyLike) => '  {"t":' + k.t + ",\n" + GROUPS_1.map((g) => "   " + g.filter((f) => k[f] !== undefined).map((f) => '"' + f + '":' + JSON.stringify(k[f])).join(", ")).join(",\n") + "}";
  return "{" + head + ', "keys": [\n' + o.keys.map(line).join(",\n") + "\n]}";
}

/** Format 1's parse: text (// comment lines allowed) or an object -> a clip, keys sorted, dur defaulted; errors name the key and field. */
export function parse1(txt: string | Lensed): Lensed & { dur: number } {
  const o = (typeof txt === "string" ? JSON.parse(txt.replace(/^\s*\/\/.*$/gm, "")) : txt) as Lensed & { dur: number };
  if (!o || !Array.isArray(o.keys) || !o.keys.length) throw new Error('a clip needs "keys": [ ... ] with at least one key pose');
  o.keys.forEach((k, i) => {
    if (typeof k.t !== "number") throw new Error("key " + (i + 1) + ' has no time "t"');
    for (const f of REQUIRED) if (!Array.isArray(k[f])) throw new Error("key " + (i + 1) + " (t " + k.t + ') has no "' + f + '"');
    for (const f of FORMAT1_FIELDS) if (k[f] && !(k[f] as number[]).every(Number.isFinite)) throw new Error("key " + (i + 1) + " (t " + k.t + '): "' + f + '" must hold numbers');
  });
  o.keys.sort((a, b) => (a.t as number) - (b.t as number));
  o.dur = o.dur || (o.keys[o.keys.length - 1]!.t as number);
  return o;
}

/** The format-2 key lens: a short header line, then three lines per key. Tools show it with the legend. */
export function keyLens(o: Lensed): string {
  const head = ["id", "name", "dur", "loop", "tags", "desc", "restSrc", "contacts", "events"].filter((f) => o[f] !== undefined).map((f) => `${JSON.stringify(f)}: ${JSON.stringify(o[f])}, `).join("");
  return `{${head}"keys": [\n` + o.keys.map((k) => keyLines(k, GROUPS_2)).join(",\n") + "\n]}";
}

/** The same clip on the other side: L and R swap, turns, tilts, twists and yaw change sign (key order as the origin's). */
export function mirror<T extends Lensed>(o: T): T {
  const neg = (v: number[] | undefined) => v && [-v[0]!, v[1]!, -v[2]!];
  const keys = o.keys.map((k) => {
    const m: KeyLike = { t: k.t, hips: [k.hips![0]!, -k.hips![1]!, k.hips![2]!], body: neg(k.body), chest: neg(k.chest), head: neg(k.head) };
    if (k.root) m.root = [k.root[0]!, -k.root[1]!];
    for (const [a, b] of [["L", "R"], ["R", "L"]] as const) {
      for (const limb of ["arm", "leg"]) {
        const v = k[limb + b] as number[];
        m[limb + a] = [v[0]!, v[1]!, v[2]!, v[3] || 0, -(v[4] || 0)];
      }
      for (const f of ["foot", "sh"]) if (k[f + b]) m[f + a] = (k[f + b] as number[]).slice();
    }
    if (k.blade) m.blade = [k.blade[0]!, -k.blade[1]!, k.blade[2]!];
    for (const [a, b] of [["L", "R"], ["R", "L"]] as const) for (const f of ["hand", "fingers"]) if (k[f + b]) m[f + a] = (k[f + b] as number[]).slice();
    if (k.spine) m.spine = k.spine.slice();
    if (typeof k.yaw === "number") m.yaw = -k.yaw;
    return m;
  });
  const out: Lensed = Object.assign({}, o, { keys });
  if ("clip" in o || !("name" in o)) out.clip = ((o.clip as string) || "clip") + "_Mirror";
  if (typeof o.name === "string") out.name = o.name + "_Mirror";
  if (typeof o.id === "string") out.id = o.id + "_Mirror";
  const c = o.contacts as Record<string, unknown> | undefined;
  if (c) out.contacts = Object.fromEntries(Object.entries(c).map(([e, v]) => [e.endsWith("L") ? e.slice(0, -1) + "R" : e.endsWith("R") ? e.slice(0, -1) + "L" : e, v]));
  const facts = o.facts as Record<string, unknown> | undefined;
  if (facts && Array.isArray(facts.travel)) out.facts = { ...facts, travel: [facts.travel[0], -(facts.travel[1] as number)] };
  const ev = o.events as Record<string, unknown>[] | undefined;
  if (ev) out.events = ev.map((e) => (e.side === "L" || e.side === "R" ? { ...e, side: e.side === "L" ? "R" : "L" } : { ...e }));
  return out as T;
}

/** The normalized lens: a copy with every angle folded into ±180 degrees for reading; never stored. */
export function normalized<T extends Lensed>(o: T): T {
  const fold = (v: number) => {
    const f = ((((v + 180) % 360) + 360) % 360) - 180;
    return f === -180 && v > 0 ? 180 : f;
  };
  const keys = o.keys.map((k) => {
    const m: KeyLike = { ...k };
    for (const [f, spec] of Object.entries(KEY_FIELDS)) {
      const v = k[f] as number[] | undefined;
      if (v && spec.angles.length) m[f] = v.map((x, i) => (spec.angles.includes(i) ? fold(x) : x));
    }
    if (typeof k.yaw === "number") m.yaw = fold(k.yaw);
    return m;
  });
  return { ...o, keys };
}

/** Every known key field's name, for lenses and readers. */
export const KEY_FIELD_NAMES: readonly string[] = ["t", ...Object.keys(KEY_FIELDS), "yaw"];

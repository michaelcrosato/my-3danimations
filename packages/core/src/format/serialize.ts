// The canonical clip file (spec/MOTION.md §4, §11): `serialize` writes a format-2 clip with its fields in the spec's
// order, nested objects in a fixed order, each key as the lens's three short lines, numbers as JSON writes them (so
// -0 becomes 0); `parseClip` reads one back. Slugs and ids, the motion hash's input, and reading format 1 live here too.
import { CLIP_FIELDS, FORMAT, IPTC, LEGEND_VERSION, METHODS, type Clip, type Key } from "./types.ts";
import { GROUPS_2, keyLines } from "./text.ts";
import type { KeyLike } from "./pose.ts";

const ORDER: Record<string, readonly string[]> = {
  provenance: ["src", "orig", "take", "method", "producer", "license", "credit", "ai"],
  producer: ["tool", "version", "model"],
  quality: ["fit", "qa", "qaVersion", "baseline"],
  review: ["state", "by", "date", "motion", "note"],
  contacts: ["by", "footL", "footR", "handL", "handR"],
  events: ["t", "name"],
  facts: ["by"],
};

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** An object's fields in a fixed order: the known ones as listed, then the rest sorted; nested objects sorted too. */
function ordered(o: Record<string, unknown>, known: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const put = (k: string) => {
    const v = o[k];
    if (v !== undefined) out[k] = isPlain(v) ? ordered(v) : Array.isArray(v) ? v.map((x) => (isPlain(x) ? ordered(x) : x)) : v;
  };
  for (const k of known) put(k);
  for (const k of Object.keys(o).filter((x) => !known.includes(x)).sort()) put(k);
  return out;
}

/** A header field's value in canonical order (nested objects included), as compact JSON. */
function headerValue(field: string, v: unknown): string {
  if (field === "events" && Array.isArray(v)) return JSON.stringify(v.map((e) => ordered(e as Record<string, unknown>, ORDER.events)));
  if (field === "provenance" && isPlain(v)) {
    const p = ordered(v, ORDER.provenance);
    if (isPlain(p.producer)) p.producer = ordered(p.producer, ORDER.producer);
    return JSON.stringify(p);
  }
  if (ORDER[field] && v && typeof v === "object" && !Array.isArray(v)) return JSON.stringify(ordered(v as Record<string, unknown>, ORDER[field]));
  return JSON.stringify(v);
}

/** The canonical text of a format-2 clip file (a trailing newline included). The same clip always gives the same bytes. */
export function serialize(clip: Clip | Record<string, unknown>): string {
  const c = clip as Record<string, unknown>;
  const fields = [...CLIP_FIELDS.filter((f) => f !== "keys" && c[f] !== undefined), ...Object.keys(c).filter((f) => !(CLIP_FIELDS as readonly string[]).includes(f) && c[f] !== undefined).sort()];
  const head = fields.map((f) => `${JSON.stringify(f)}: ${headerValue(f, c[f])}`);
  const keys = (c.keys as KeyLike[]).map((k) => keyLines(k, GROUPS_2));
  return `{\n${head.join(",\n")},\n"keys": [\n${keys.join(",\n")}\n]}\n`;
}

/** Read a clip file's text. It is plain JSON; validate it with `validate` before trusting it. */
export function parseClip(text: string): Clip {
  return JSON.parse(text) as Clip;
}

/** A clip's slug: runs of characters outside A–Z a–z 0–9 _ - become one _, trimmed of _ at the ends. */
export function slug(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "clip";
}

/** Slugs for clip names in a set, in their order: a slug taken already gets _2, _3 (spec/MOTION.md §11). */
export function slugs(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((n) => {
    const base = slug(n);
    let s = base;
    for (let i = 2; used.has(s); i++) s = `${base}_${i}`;
    used.add(s);
    return s;
  });
}

/** The motion hash's input (spec/MOTION.md §7.6): the canonical JSON of what plays, for the review's SHA-256. */
export function motionText(clip: Clip): string {
  const c = clip as unknown as Record<string, unknown>;
  const m: Record<string, unknown> = { dur: clip.dur, loop: clip.loop, fps: clip.fps, skeleton: clip.skeleton, restSrc: clip.restSrc, keys: clip.keys, contacts: clip.contacts, events: clip.events };
  for (const f of clip.requires ?? []) m[f] = c[f];
  return serialize({ ...m, keys: clip.keys });
}

/** A format-1 clip as my-3d2dge's and shardfall's set files hold it. */
export interface Clip1 {
  clip?: string;
  src?: string;
  take?: string;
  orig?: string;
  dur: number;
  loop?: boolean;
  tags?: string[];
  desc?: string;
  speed?: number;
  keys: KeyLike[];
}

/** What a format-1 clip doesn't say about itself, supplied by the migrator. */
export interface From1 {
  set: string;
  slug: string;
  name: string;
  fps: number;
  restSrc: string;
  /** How the source's motion was made: a capture (the default) or keyed by an animator. */
  method?: (typeof METHODS)[number];
  license: string;
  credit?: string;
  fit?: [number, number];
  producer: { tool: string; version: string };
  qaVersion: string;
}

/** The key fields in canonical order: t, then the lens's groups. */
const KEY_ORDER = ["t", ...GROUPS_2.flat()];

/** Read a format-1 clip as format 2 (spec/MOTION.md §10.1): same keys, the header filled from the migrator's facts. */
export function fromFormat1(c: Clip1, f: From1): Clip {
  const keys = c.keys.map((k) => ordered(Object.fromEntries(Object.entries(k).map(([f, v]) => [f, Array.isArray(v) ? v.slice() : v])), KEY_ORDER) as unknown as Key);
  const method = f.method ?? "captured";
  const clip: Clip = {
    format: FORMAT,
    id: `${f.set}/${f.slug}`,
    name: f.name,
    legend: LEGEND_VERSION,
    dur: c.dur,
    loop: Boolean(c.loop),
    fps: f.fps,
    tags: c.tags ?? [],
    desc: c.desc ?? "",
    skeleton: "humanoid",
    restSrc: f.restSrc,
    ...(c.speed !== undefined ? { facts: { by: `${f.producer.tool}@${f.producer.version}`, speed: c.speed } } : {}),
    provenance: {
      src: c.src ?? f.restSrc,
      ...(c.orig ? { orig: c.orig } : {}),
      ...(c.take ? { take: c.take } : {}),
      method,
      producer: f.producer,
      license: f.license,
      ...(f.credit ? { credit: f.credit } : {}),
      ai: IPTC[method],
    },
    quality: { fit: f.fit ?? [0, 0], qa: "unchecked", qaVersion: f.qaVersion },
    keys,
  };
  return clip;
}

// Compiling a recipe (spec/RECIPE.md §3): the recipe checked, each step run on the tracks it reads, and the last track
// written as a format-2 clip. Keys are chosen from the track's frames the way the fitter chooses them (Ramer–Douglas–
// Peucker over whole poses, then the frame the in-betweens miss most, until every frame is within the budget), each
// rounded as the format rounds (directions scaled to 100). The clip names the recipe's hash and its inputs' content
// ids in its provenance, carries the license its inputs force (D10), and validates; the same recipe and inputs give
// the same clip.
import { P, type Rest } from "../format/body.ts";
import { decodePose, type KeyLike } from "../format/pose.ts";
import { error, meanError, reduce } from "../format/fit.ts";
import { keyAt, type Capture } from "../format/sample.ts";
import type { Clip, ClipEvent, Contacts, Key } from "../format/types.ts";
import { CONTACT_ENDS, KEY_FIELDS } from "../format/types.ts";
import type { Pose } from "../ops/pose.ts";
import { validate } from "../validate/index.ts";
import { nearest } from "../validate/issues.ts";
import { VERSION } from "../version.ts";
import { look, pin } from "./ik.ts";
import { canonical, sha256 } from "./sha256.ts";
import { exaggerate, overshoot, smooth, stiffen } from "./style.ts";
import { addContacts, addEvents, blendTracks, layer, maskFrom, mirror, poseDeltas, retime, sequence, type Parts } from "./steps.ts";
import { cycleOf, ms, trackOfClip } from "./track.ts";
import type { Recipe, Resolved, Resolver, Root, Step, Track } from "./types.ts";
import { RecipeError, validateRecipe, type RecipeIssue } from "./validate.ts";

/** The compiler's own revision in a clip's provenance. */
export const RECIPE_PRODUCER = { tool: "m3a-recipe", version: VERSION };
/** The key budget: every frame within this many mm (worst body point) of the keys' in-betweens. */
export const KEY_BUDGET = 30;

/** What compiling gives: the clip, the rest it decodes on, and the track it was written from. */
export interface Compiled {
  clip: Clip;
  rest: Rest;
  track: Track;
}

/** The fields of a pose step that move parts. */
const SPAN = new Set(["op", "as", "in", "from", "to", "fade"]);

/** Runs one step on the tracks before it. */
function run(s: Step, at: number, named: Map<string, Track>, resolve: Resolver, fps: number, used: Map<string, Resolved>): Track {
  const get = (n: unknown) => named.get(n as string)!;
  const fail = (code: string, field: string, message: string, fix?: string): never => {
    throw new RecipeError([{ code, step: at, field, message, ...(fix ? { fix } : {}) } as RecipeIssue]);
  };
  const within = (t: Track, field: string, v: unknown) => {
    if (typeof v === "number" && v > t.dur + 1e-9) fail("R-E009", field, `${field} ${v} s is past the track's end (${t.dur} s)`, `a time from 0 to ${t.dur}`);
  };
  switch (s.op) {
    case "clip": {
      const r = resolve(s.id as string);
      if (!r) {
        const near = resolve.ids ? nearest(s.id as string, resolve.ids()) : undefined;
        return fail("R-E008", "id", `no clip ${s.id} in the library`, near ? `did you mean ${near}?` : "search the library for the clip's id");
      }
      used.set(s.id as string, r);
      for (const f of ["from", "to"]) if (typeof s[f] === "number" && (s[f] as number) > r.clip.dur + 1e-9) fail("R-E009", f, `${f} ${s[f]} s is past the clip's end (${r.clip.dur} s)`, `a time from 0 to ${r.clip.dur}`);
      return trackOfClip(r.clip, r.rest, fps, { ...(s.from !== undefined ? { from: s.from as number } : {}), ...(s.to !== undefined ? { to: s.to as number } : {}), ...(s.loop !== undefined ? { loop: s.loop as boolean | number } : {}) });
    }
    case "sequence":
      return sequence((s.items as string[]).map(get), (s.fade as number | undefined) ?? 0.2, s.sync === "contacts");
    case "blend":
      return blendTracks(get(s.a), get(s.b), s.w as number | [number, number][], s.warp !== false);
    case "layer":
      return layer(get(s.base), get(s.over), maskFrom(s.mask, (s.feather as number | undefined) ?? 0), (s.weight as number | undefined) ?? 1, s.additive === true);
    case "mirror":
      return mirror(get(s.in));
    case "retime":
      return retime(get(s.in), s as { speed?: number; dur?: number; ease?: "in" | "out" | "inOut" });
    case "pose": {
      const t = get(s.in), parts: Parts = {};
      within(t, "from", s.from);
      for (const [k, v] of Object.entries(s)) if (!SPAN.has(k)) parts[k] = v as Record<string, number> | number;
      return poseDeltas(t, parts, (s.from as number | undefined) ?? 0, (s.to as number | undefined) ?? t.dur, (s.fade as number | undefined) ?? 0);
    }
    case "look": {
      const t = get(s.in);
      within(t, "from", s.from);
      return look(t, s.at as [number, number, number], (s.from as number | undefined) ?? 0, (s.to as number | undefined) ?? t.dur, (s.fade as number | undefined) ?? 0, (s.weight as number | undefined) ?? 1);
    }
    case "pin": {
      const t = get(s.in), path = s.path as number[][];
      within(t, "path", path[0]![0]);
      return pin(t, s.end as "handL", path, (s.fade as number | undefined) ?? 0);
    }
    case "exaggerate":
      return exaggerate(get(s.in), s.amount as number, maskFrom(s.mask));
    case "smooth":
      return smooth(get(s.in), s.window as number, maskFrom(s.mask));
    case "overshoot":
      return overshoot(get(s.in), s.amount as number, maskFrom(s.mask));
    case "stiffen":
      return stiffen(get(s.in), s.amount as number, maskFrom(s.mask ?? "upper")!);
    case "events": {
      const t = get(s.in), add = s.add as ClipEvent[];
      for (const e of add) within(t, "add", e.t);
      return addEvents(t, add);
    }
    case "contacts": {
      const t = get(s.in), add = s.add as Record<string, [number, number][]>;
      for (const iv of Object.values(add)) for (const [, b] of iv) within(t, "add", b);
      return addContacts(t, add);
    }
  }
  return fail("R-E002", "op", `no operation ${s.op}`);
}

/** A pose rounded as the format rounds: whole numbers, a limb's or blade's direction scaled to 100 first. */
export function quantize(p: Pose): Pose {
  const out: Pose = {};
  for (const [f, v] of Object.entries(p)) {
    if (!Array.isArray(v)) continue;
    const spec = KEY_FIELDS[f];
    let x = v as number[];
    if (spec?.direction) {
      const l = Math.sqrt(x[0]! * x[0]! + x[1]! * x[1]! + x[2]! * x[2]!);
      if (l > 1e-9) x = [x[0]! * (100 / l), x[1]! * (100 / l), x[2]! * (100 / l), ...x.slice(3)];
    }
    out[f] = x.map((n, i) => {
      const r = spec?.ranges[i], c = r ? Math.min(r[1], Math.max(r[0], n)) : n;
      return Math.round(c) + 0;
    });
  }
  return out;
}

/** p with each angle moved by whole turns to lie nearest `ref`'s (MOTION.md §6.3's unwrapping). */
export function nearestTo(p: Pose, ref: Pose): Pose {
  const out: Pose = { ...p };
  for (const [f, v] of Object.entries(p)) {
    const spec = KEY_FIELDS[f], r = ref[f] as number[] | undefined;
    if (!spec || !Array.isArray(v) || !r) continue;
    out[f] = (v as number[]).map((x, i) => (spec.angles.includes(i) && r[i] !== undefined ? x + 360 * Math.round((r[i]! - x) / 360) : x));
  }
  return out;
}

/** The keys for a track: its frames rounded, as few as keep every frame within the budget. */
function keysOf(t: Track, budget: number): { keys: Key[]; fit: [number, number] } {
  const moves = t.roots.some((r) => Math.abs(r.forward) > 0.5 || Math.abs(r.right) > 0.5) || (t.loop && (Math.abs(cycleOf(t).forward) > 0.5 || Math.abs(cycleOf(t).right) > 0.5));
  const turns = t.roots.some((r) => Math.abs(r.yaw) > 0.5) || (t.loop && Math.abs(cycleOf(t).yaw) > 0.5);
  const withRoot = (p: Pose, r: Root, time: number): Key => ({ t: ms(time), ...p, ...(moves ? { root: [Math.round(r.forward) + 0, Math.round(r.right) + 0] } : {}), ...(turns ? { yaw: Math.round(r.yaw) + 0 } : {}) }) as unknown as Key;
  const all = t.poses.map((p, i) => withRoot(quantize(p), t.roots[i]!, t.times[i]!));
  // a loop closes on its first pose, each angle taken nearest the frame before it so the last in-between turns the
  // short way (a heading that crossed ±180 in the cycle doesn't swing back round)
  if (t.loop) all.push(withRoot(quantize(nearestTo(t.poses[0]!, t.poses[t.poses.length - 1]!)), cycleOf(t), t.dur));
  // the frames as points, for choosing keys and measuring them
  const n = all.length, data = new Float32Array(n * P * 3), X = new Float32Array(P * 3);
  t.poses.forEach((p, i) => data.set(decodePose(t.rest, p, X) as Float32Array, i * P * 3));
  if (t.loop) data.set(data.subarray(0, P * 3), (n - 1) * P * 3);
  const cap: Capture = { name: "recipe", n, dur: t.dur, loop: false, fps: (n - 1) / Math.max(t.dur, 1e-9), data, move: null };
  const chosen = new Set(n > 1 ? reduce(cap, budget) : [0]);
  chosen.add(0).add(n - 1);
  const measure = () => {
    const keys = [...chosen].sort((a, b) => a - b).map((i) => all[i]!), clip = { dur: t.dur, loop: false, keys }, Y = new Float32Array(P * 3);
    // the worst frame of all (a key's own rounding counts), and the worst one not yet a key
    let worst = 0, free = 0, at = -1, sum = 0;
    for (let i = 0; i < n; i++) {
      decodePose(t.rest, keyAt(clip, all[i]!.t) as KeyLike, Y);
      const e = error(data.subarray(i * P * 3, (i + 1) * P * 3), Y);
      sum += meanError(data.subarray(i * P * 3, (i + 1) * P * 3), Y);
      worst = Math.max(worst, e);
      if (e > free && !chosen.has(i)) [free, at] = [e, i];
    }
    return { keys, worst, free, at, mean: sum / n };
  };
  let m = measure();
  for (let guard = 0; m.free > budget && guard < n; guard++) {
    chosen.add(m.at);
    m = measure();
  }
  return { keys: m.keys, fit: [Math.round(m.mean), Math.round(m.worst)] };
}

/** Contacts kept within the clip, sorted, merged where they meet (the format's rule, §7.1). */
function tidyContacts(c: Contacts | undefined, dur: number): Contacts | undefined {
  if (!c) return undefined;
  const out: Contacts = { by: c.by };
  for (const end of CONTACT_ENDS) {
    const iv = (c[end] ?? []).map(([a, b]): [number, number] => [ms(Math.max(0, a)), ms(Math.min(dur, b))]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]), merged: [number, number][] = [];
    for (const [a, b] of iv) {
      const l = merged[merged.length - 1];
      if (l && a <= l[1]) l[1] = Math.max(l[1], b);
      else merged.push([a, b]);
    }
    if (merged.length) out[end] = merged;
  }
  return CONTACT_ENDS.some((e) => out[e]) ? out : undefined;
}

/** The license a clip made from these inputs carries (D10): CC0 when they all are, else each other one once. */
export function licenseOf(inputs: readonly Resolved[]): { license: string; credit?: string } {
  const others = [...new Set(inputs.map((r) => r.clip.provenance.license).filter((l) => l !== "CC0-1.0"))].sort();
  const credits = [...new Set(inputs.filter((r) => r.clip.provenance.license !== "CC0-1.0").map((r) => r.clip.provenance.credit).filter((c): c is string => Boolean(c)))];
  return others.length ? { license: others.join(" AND "), ...(credits.length ? { credit: credits.join("; ") } : {}) } : { license: "CC0-1.0" };
}

/**
 * Compiles a recipe into a format-2 clip: checked first (a RecipeError lists every issue), each `clip` step read
 * through `resolve`, the last step's track sampled at the recipe's rate and fitted to keys within `budget` mm.
 */
export function compile(recipe: Recipe, resolve: Resolver, opts: { budget?: number } = {}): Compiled {
  const issues = validateRecipe(recipe);
  if (issues.length) throw new RecipeError(issues);
  const fps = recipe.fps ?? 30, named = new Map<string, Track>(), used = new Map<string, Resolved>();
  let last: Track | undefined;
  recipe.steps.forEach((s, i) => {
    last = run(s, i + 1, named, resolve, fps, used);
    named.set(`s${i + 1}`, last);
    if (s.as) named.set(s.as, last);
  });
  const t = last!, first = used.values().next().value as Resolved, { keys, fit } = keysOf(t, opts.budget ?? KEY_BUDGET);
  const events = t.events.filter((e) => e.t >= 0 && e.t <= t.dur).sort((a, b) => a.t - b.t), contacts = tidyContacts(t.contacts, t.dur);
  const inputs = Object.fromEntries([...used.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, r]) => [id, r.contentId]));
  const clip: Clip = {
    format: "2.0",
    id: recipe.id,
    name: recipe.name ?? first.clip.name,
    legend: "2.0",
    dur: t.dur,
    loop: t.loop,
    fps,
    tags: recipe.tags ?? first.clip.tags,
    desc: recipe.desc ?? "",
    skeleton: "humanoid",
    restSrc: t.restSrc,
    ...(contacts ? { contacts } : {}),
    ...(events.length ? { events } : {}),
    provenance: { src: first.clip.provenance.src, orig: first.clip.id, method: "composed", producer: RECIPE_PRODUCER, ...licenseOf([...used.values()]), ai: "composite", recipe: { sha256: sha256(canonical(recipe)), inputs } } as Clip["provenance"],
    quality: { fit, qa: "unchecked", qaVersion: "none" },
    keys,
  };
  const v = validate(clip, { mode: "read" });
  if (v.errors.length) throw new RecipeError(v.errors.map((e) => ({ code: "R-E004", message: `the compiled clip is invalid: ${e.code} ${e.message}` })));
  return { clip, rest: t.rest, track: t };
}

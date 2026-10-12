// The library's census for G5 (PLAN.md WP-5.8): a category per clip, read from its tags, and a minimal dedup so the gate
// counts unique motions. Clips are joined by their `orig` chains (Mesh2Motion's re-exports of Quaternius), as re-exports
// (one source's animation of one name in two sets, or its root-motion take `_RM`; a re-export source's clip without an
// orig, by pose at its own rate, REEXPORT_NEAR), and by pose: two clips of about the same length whose poses lie within
// NEAR mm of each other on average over their whole length are one motion (two standing idles a style barely shows in,
// an animation saved twice under two names), and two that hold still the same pose are one whatever their lengths. A
// pose is the body's 36 points in the root's frame, centred on the pelvis over the floor and scaled to the reference hip
// height, at SAMPLES times over the clip (two loops compared at every shift of their phase); a clip's mean pose bounds
// the distance from below, so most pairs are never compared in full. The full dedup is WP-9.3.
import { format } from "@m3a/core";
import type { LibraryClip } from "./qa.ts";

/** One of G5's categories: its floor and the tags that put a clip in it (unless it has one of `unless`). */
export interface Category {
  name: string;
  label: string;
  floor: number;
  tags: readonly string[];
  unless?: readonly string[];
}
/** G5's categories, in the order a clip's tags are read: the first that takes it is its category. */
export const CATEGORIES: readonly Category[] = [
  // a hurt walk is locomotion, a hit or a fall a reaction; the floor was 40 until D66 (CMU has no hits or deaths to
  // pick, and the keyed sets re-export one another's)
  { name: "reactions", label: "reactions (hits, deaths, get-ups)", floor: 33, tags: ["hurt", "death", "getup"], unless: ["walk", "run"] },
  // a pitch or a golf swing is sport, not a fight
  { name: "combat", label: "combat", floor: 60, tags: ["attack", "block", "kick", "aim", "gun", "sword", "shield", "unarmed", "magic", "throw", "bow"], unless: ["sport"] },
  { name: "traversal", label: "traversal", floor: 30, tags: ["jump", "climb", "dodge", "slide", "swim", "fly", "crawl", "air"] },
  { name: "locomotion", label: "locomotion", floor: 200, tags: ["walk", "run", "sidestep", "strafe", "turn"] },
  { name: "work", label: "interaction and work", floor: 60, tags: ["work", "interact", "farm", "carry", "push", "eat", "fish", "item", "sit", "vehicle", "exercise", "sport"] },
  { name: "gestures", label: "gestures and emotes", floor: 60, tags: ["emote", "gesture", "talk", "dance", "cheer", "monster", "pose"] },
  { name: "idles", label: "idles", floor: 30, tags: ["idle", "stance", "rest", "lie", "lean", "prop"] },
];
/** A clip that no category takes (a reference pose). */
export const OTHER = "other";

/** A clip's category, from its tags. */
export function categoryOf(tags: readonly string[]): string {
  return CATEGORIES.find((c) => c.tags.some((t) => tags.includes(t)) && !c.unless?.some((t) => tags.includes(t)))?.name ?? OTHER;
}

/** Poses sampled over a clip. */
export const SAMPLES = 24;
/** Two clips whose poses lie this close (mm on average, on a body 950 mm at the hips) are one motion. */
export const NEAR = 20;
/** Two clips are compared only when the longer is at most this many times the shorter. */
const LENGTHS = 1.1;
/** Sources that re-export another library's animations: that library's sources, and the rates the re-export may play
 *  them at (Mesh2Motion plays Quaternius' library 1 at 0.8 of its speed, 25% longer, and library 2 at its own). */
export const REEXPORTS: Readonly<Record<string, { from: readonly string[]; rates: readonly number[] }>> = { M2M_QUATERNIUS: { from: ["UAL1", "UAL2"], rates: [1, 0.8] } };
/** A re-export without an `orig` counts with its original when their poses lie this close over the re-export's length,
 *  the original read at the re-export's rate: the declared copies sit at 47–65 mm, other clips 240 mm and more apart. */
export const REEXPORT_NEAR = 80;
/** A clip whose poses all lie within this many mm of its mean pose holds still: two such count once when their mean
 *  poses lie within NEAR, whatever their lengths (a held aim and a held idle of the same pose). */
export const STILL = 10;

interface Sampled {
  id: string;
  dur: number;
  loop: boolean;
  /** SAMPLES poses, 36 points each, x y z. */
  poses: Float32Array;
  /** The mean pose. */
  mean: Float32Array;
  /** The farthest any pose lies from the mean (mm a point). */
  spread: number;
}
const N = format.P * 3, PELVIS = format.IDX.pelvis! * 3;

/** A clip's poses: centred on the pelvis over the floor, scaled to the reference hip height. */
function sampled({ clip, rest }: LibraryClip): Sampled {
  const poses = new Float32Array(SAMPLES * N), mean = new Float32Array(N), Y = new Float32Array(N), k = 950 / rest.H0;
  for (let i = 0; i < SAMPLES; i++) {
    format.pose(rest, clip, clip.loop ? (clip.dur * i) / SAMPLES : (clip.dur * i) / (SAMPLES - 1), Y);
    const x0 = Y[PELVIS]!, y0 = Y[PELVIS + 1]!;
    for (let p = 0; p < format.P; p++) {
      const o = i * N + p * 3;
      poses[o] = (Y[p * 3]! - x0) * k;
      poses[o + 1] = (Y[p * 3 + 1]! - y0) * k;
      poses[o + 2] = Y[p * 3 + 2]! * k;
      for (let d = 0; d < 3; d++) mean[p * 3 + d]! += poses[o + d]! / SAMPLES;
    }
  }
  let spread = 0;
  for (let i = 0; i < SAMPLES; i++) spread = Math.max(spread, between(poses, i * N, mean, 0));
  return { id: clip.id, dur: clip.dur, loop: clip.loop, poses, mean, spread };
}

/** How far a re-export lies from a clip read at `rate` of its time: the poses' mean distance over the re-export's length
 *  (the original held at its end past it). */
function rated(re: LibraryClip, o: LibraryClip, rate: number): number {
  const A = new Float32Array(N), B = new Float32Array(N), at = (c: LibraryClip, t: number, Y: Float32Array, k: number) => {
    format.pose(c.rest, c.clip, t, Y);
    const x0 = Y[PELVIS]!, y0 = Y[PELVIS + 1]!;
    for (let p = 0; p < format.P; p++) [Y[p * 3], Y[p * 3 + 1], Y[p * 3 + 2]] = [(Y[p * 3]! - x0) * k, (Y[p * 3 + 1]! - y0) * k, Y[p * 3 + 2]! * k];
  };
  let sum = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t = (re.clip.dur * i) / (SAMPLES - 1);
    at(re, t, A, 950 / re.rest.H0);
    at(o, Math.min(o.clip.dur, t * rate), B, 950 / o.rest.H0);
    sum += between(A, 0, B, 0);
  }
  return sum / SAMPLES;
}

/** The mean distance between two poses (mm a point). */
function between(a: Float32Array, ao: number, b: Float32Array, bo: number): number {
  let s = 0;
  for (let p = 0; p < format.P; p++) s += Math.hypot(a[ao + p * 3]! - b[bo + p * 3]!, a[ao + p * 3 + 1]! - b[bo + p * 3 + 1]!, a[ao + p * 3 + 2]! - b[bo + p * 3 + 2]!);
  return s / format.P;
}
/** How far apart two sampled clips are: their poses' mean distance, the best shift of phase for two loops. */
function distance(a: Sampled, b: Sampled, under: number): number {
  let best = Infinity;
  for (let s = 0; s < (a.loop && b.loop ? SAMPLES : 1); s++) {
    let sum = 0;
    for (let i = 0; i < SAMPLES && sum < under * SAMPLES; i++) sum += between(a.poses, i * N, b.poses, ((i + s) % SAMPLES) * N);
    best = Math.min(best, sum / SAMPLES);
  }
  return best;
}

/** The census: unique motions, the groups that count once and why, and each category's counts. */
export interface Census {
  clips: number;
  unique: number;
  /** Unique motions with a clip in a CC0 set (the default pack's). */
  cc0: number;
  /** Each clip that counts with another: the one it counts with, how it is the same (a copy by `orig`, a re-export,
   *  a near-duplicate by pose) and why. */
  same: Record<string, { as: string; kind: Kind; why: string }>;
  /** Per category: its floor, its clips, its unique motions and those with a CC0 clip. */
  categories: Record<string, { label: string; floor: number; clips: number; unique: number; cc0: number }>;
  /** Each clip's category. */
  of: Record<string, string>;
}

/** How a clip is the same motion as another. */
export type Kind = "orig" | "export" | "pose";

/** Counts a library's unique motions and its categories (`cc0`: the sets in the CC0 tier). */
export function census(lib: readonly LibraryClip[], cc0: ReadonlySet<string>): Census {
  const ids = lib.map((c) => c.clip.id), at = new Map(ids.map((id, i) => [id, i])), parent = ids.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  // each clip's links to others, by kind ("copied": another is its copy, which says nothing of its own)
  const links = new Map<number, { kind: Kind | "copied"; why: string }[]>(), copied = new Set(lib.map((c) => c.clip.provenance.orig).filter((o): o is string => Boolean(o)));
  const join = (i: number, j: number, kind: Kind, whyI: string, whyJ: string) => {
    links.set(i, [...(links.get(i) ?? []), { kind, why: whyI }]);
    links.set(j, [...(links.get(j) ?? []), { kind: kind === "orig" ? "copied" : kind, why: whyJ }]);
    const a = find(i), b = find(j);
    if (a === b) return;
    // the one that counts: an original over its copy or re-export, CC0 over another tier, a clip others copy, then by id
    const rank = (k: number) => `${lib[k]!.clip.provenance.orig || REEXPORTS[lib[k]!.clip.provenance.src] ? 1 : 0}${cc0.has(lib[k]!.set) ? 0 : 1}${copied.has(ids[k]!) ? 0 : 1}${ids[k]}`;
    if (rank(a) < rank(b)) parent[b] = a;
    else parent[a] = b;
  };
  // the orig chains
  lib.forEach((c, i) => {
    const o = c.clip.provenance.orig, j = o ? at.get(o) : undefined;
    if (j !== undefined) join(i, j, "orig", `a copy of ${o} (its orig)`, `copied as ${ids[i]}`);
  });
  // re-exports: the same animation of the same source in another set, or its root-motion take
  const exported = new Map<string, number>();
  lib.forEach((c, i) => {
    const key = `${c.clip.provenance.src} ${c.clip.id.split("/")[1]!.replace(/_RM$/, "")}`, j = exported.get(key);
    if (j === undefined) exported.set(key, i);
    else join(i, j, "export", `the same animation of ${c.clip.provenance.src} as ${ids[j]}`, `the same animation of ${c.clip.provenance.src} as ${ids[i]}`);
  });
  const s = lib.map(sampled);
  // a re-export source's clips without an orig: their original by pose, read at the rate the re-export plays it
  lib.forEach((c, i) => {
    const re = REEXPORTS[c.clip.provenance.src];
    if (!re || c.clip.provenance.orig) return;
    let best = -1, d = REEXPORT_NEAR, at = 1;
    lib.forEach((o, j) => {
      if (!re.from.includes(o.clip.provenance.src) || o.clip.loop !== c.clip.loop || o.clip.skeleton !== c.clip.skeleton) return;
      for (const rate of re.rates) {
        const e = rated(c, o, rate);
        if (e < d) [best, d, at] = [j, e, rate];
      }
    });
    if (best >= 0) join(i, best, "export", `re-exported from ${ids[best]} (within ${d.toFixed(0)} mm over its length, played at ${at} of its speed)`, `re-exported as ${ids[i]}`);
  });
  // clips that hold still: by their mean poses, whatever their lengths
  const still = s.map((x, i) => i).filter((i) => s[i]!.spread < STILL);
  for (let x = 0; x < still.length; x++) for (let y = x + 1; y < still.length; y++) {
    const i = still[x]!, j = still[y]!;
    if (lib[i]!.clip.skeleton !== lib[j]!.clip.skeleton || find(i) === find(j)) continue;
    const d = between(s[i]!.mean, 0, s[j]!.mean, 0);
    if (d < NEAR) join(i, j, "pose", `held still within ${d.toFixed(1)} mm of ${ids[j]}`, `held still within ${d.toFixed(1)} mm of ${ids[i]}`);
  }
  // near-duplicates by pose
  const order = s.map((_, i) => i).sort((a, b) => s[a]!.dur - s[b]!.dur);
  for (let x = 0; x < order.length; x++) {
    const i = order[x]!, a = s[i]!;
    for (let y = x + 1; y < order.length; y++) {
      const j = order[y]!, b = s[j]!;
      if (b.dur > a.dur * LENGTHS) break;
      if (lib[i]!.clip.skeleton !== lib[j]!.clip.skeleton || a.loop !== b.loop || find(i) === find(j)) continue;
      if (between(a.mean, 0, b.mean, 0) >= NEAR) continue;
      const d = distance(a, b, NEAR);
      if (d < NEAR) join(i, j, "pose", `within ${d.toFixed(1)} mm of ${ids[j]} over its length`, `within ${d.toFixed(1)} mm of ${ids[i]} over its length`);
    }
  }
  const roots = new Map<number, number[]>(), same: Census["same"] = {};
  ids.forEach((_, i) => roots.set(find(i), [...(roots.get(find(i)) ?? []), i]));
  // a clip's own link says why it counts with another: its orig first, then a re-export, then its pose
  ids.forEach((id, i) => {
    if (find(i) === i) return;
    const own = links.get(i)!, l = (["orig", "export", "pose"] as const).map((k) => own.find((x) => x.kind === k)).find(Boolean) ?? own[0]!;
    same[id] = { as: ids[find(i)]!, kind: l.kind === "copied" ? "orig" : l.kind, why: l.why };
  });
  const of = Object.fromEntries(lib.map((c) => [c.clip.id, categoryOf(c.clip.tags)])), categories: Census["categories"] = {};
  for (const c of [...CATEGORIES, { name: OTHER, label: "other", floor: 0, tags: [] }]) categories[c.name] = { label: c.label, floor: c.floor, clips: 0, unique: 0, cc0: 0 };
  for (const id of ids) categories[of[id]!]!.clips++;
  let free = 0;
  for (const [root, members] of roots) {
    const cat = categories[of[ids[root]!]!]!, hasCc0 = members.some((k) => cc0.has(lib[k]!.set));
    cat.unique++;
    if (hasCc0) [cat.cc0, free] = [cat.cc0 + 1, free + 1];
  }
  return { clips: ids.length, unique: roots.size, cc0: free, same, categories, of };
}

// Compiling actions (PLAN.md WP-6.3, D72): an action's recipe compiled on the library and its procedural parts, its
// beats and interrupt points marked as events, and the ground under the character over it, from which comes the root
// curve a game moves its character along (the clip's travel and turn, and the ground's height). An interrupt cuts the
// action into another clip, raised to the ground the action stands on there and turned to face the way it faces.
import { sole } from "../clip/contacts.ts";
import { P, type Rest } from "../format/body.ts";
import { decodePose, type KeyLike } from "../format/pose.ts";
import { serialize } from "../format/serialize.ts";
import { PORTABLE as PM } from "../math/portable.ts";
import { fitGait, gaitClip, GAITS } from "../procedural/gait.ts";
import { idleClip, IDLES } from "../procedural/idle.ts";
import { moveClip } from "../procedural/clip.ts";
import type { Move } from "../procedural/move.ts";
import { compile, type Compiled } from "../recipe/compile.ts";
import { sha256 } from "../recipe/sha256.ts";
import { poseAt, rootAt as trackRootAt } from "../recipe/track.ts";
import type { Recipe, Resolved, Resolver, Root, Step } from "../recipe/types.ts";
import { RecipeError, type RecipeIssue } from "../recipe/validate.ts";
import { recipeOf, validateAction, validatePaired, type Action, type Interrupt, type PairedAction } from "./action.ts";

/** A compiled action: its clip and track, the ground under it at each of the track's frames (% of the hip height in
 *  the clip's frame, whose floor is the lower of the two grounds), the start ground there, and the resolver it used. */
export interface CompiledAction extends Compiled {
  action: Action;
  ground: number[];
  start: number;
  resolve: Resolver;
}

/** How far the feet near an end may be from the ground the floor gives there, % of the hip height. */
const GROUND_TOLERANCE = 6;
/** How near an end the feet are looked for, s. */
const ENDS = 0.3;

/**
 * The ready-made gaits and idles made, by id and body (six to a rest: the four gaits and the two idles), the PARTS_KEPT
 * used last, the one used longest ago dropped first: a game's handful of bodies (16, each asking all six) never makes
 * one twice. Kept without a bound they grew with each body asked for: the four gaits resolved on the 104 bodies (the 64
 * library rests and test characters 0 to 39) held 43 MB after a forced gc, 0.33 MB more a body (WP-6.2's close-out's
 * review); kept so they hold about 24 MB after two forced gcs (some 10 MB for the 96 parts, the seam's readings, up to
 * 16 MB, the rest), every content id the same. Seventeen bodies or more asking all six in turn miss every time.
 */
const PARTS = new Map<string, Resolved>(), PARTS_KEPT = 96;

/**
 * A resolver over `base` that also makes procedural parts on `rest`: PROCEDURAL/<Name> is the gait, idle (or, given
 * `moves`, the move) of that name, from the standing pose, its content id the SHA-256 of the clip as written. A gait is
 * fitted to the body first (`fitGait`): one the legs don't take is slowed (or, rarely, lifted less) until they do, and
 * one that fits is played as it is.
 */
export function proceduralResolver(base: Resolver, rest: Rest, restSrc: string, moves: readonly Move[] = []): Resolver {
  const made = new Map<string, Resolved | undefined>(), body = `${restSrc}\n${JSON.stringify(rest)}`;
  const make = (id: string): Resolved | undefined => {
    const m = /^PROCEDURAL\/([A-Za-z0-9_]+)$/.exec(id);
    if (!m) return undefined;
    const name = m[1]!.toLowerCase(), opts = { restSrc, id }, g = GAITS.find((x) => x.name === name), i = IDLES.find((x) => x.name === name), mv = moves.find((x) => x.name === name);
    // a ready-made gait or idle is the same clip on the same body whichever action asks: made once while kept, and
    // given back on this resolver's own rest (an equal body another caller made it on is another object, D125)
    const key = `${id}\n${body}`, kept = g || i ? PARTS.get(key) : undefined;
    if (kept) {
      PARTS.delete(key);
      PARTS.set(key, kept);
      return kept.rest === rest ? kept : { ...kept, rest };
    }
    const clip = g ? gaitClip(fitGait(g, rest), rest, opts) : i ? idleClip(i, rest, opts) : mv ? moveClip(mv, rest, opts) : undefined, out = clip ? { clip, rest, contentId: sha256(serialize(clip)) } : undefined;
    if (out && (g || i)) {
      PARTS.set(key, out);
      if (PARTS.size > PARTS_KEPT) PARTS.delete(PARTS.keys().next().value!);
    }
    return out;
  };
  return Object.assign((id: string) => base(id) ?? (made.has(id) ? made.get(id) : (made.set(id, make(id)), made.get(id))), {
    ids: () => [...(base.ids?.() ?? []), ...GAITS.map((g) => `PROCEDURAL/${cap(g.name)}`), ...IDLES.map((i) => `PROCEDURAL/${cap(i.name)}`), ...moves.map((m) => `PROCEDURAL/${cap(m.name)}`)],
  });
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** The name a step is read by: its `as`, or s1, s2, … by its place. */
const nameOf = (steps: readonly Step[], i: number) => steps[i]!.as ?? `s${i + 1}`;
const fail = (issues: RecipeIssue[]): never => {
  throw new RecipeError(issues);
};

/** The lowest point of either sole at each of a track's frames, % of the hip height. */
function lowest(rest: Rest, poses: readonly object[]): number[] {
  const X = new Float32Array(P * 3);
  return poses.map((p) => {
    decodePose(rest, p as KeyLike, X);
    return (Math.min(...(["L", "R"] as const).flatMap((s) => sole(rest, X, s).map((q) => q.p[2]))) / rest.H0) * 100;
  });
}

/**
 * The ground under the character at each frame, given the lowest sole there and the floor it ends on (% of the hip
 * height): the clip's floor is the lower ground. Climbing (floor > 0), the ground rises to the ledge as the feet leave
 * the floor for good, never above them now or later; dropping (floor < 0), it falls from the ledge as the feet do,
 * never above them so far. On one ground it stays put.
 */
export function groundOf(low: readonly number[], floor: number): { ground: number[]; start: number } {
  const n = low.length;
  if (floor > 0) {
    const ground = new Array<number>(n);
    let m = Infinity;
    for (let i = n - 1; i >= 0; i--) ground[i] = Math.max(0, Math.min(floor, (m = Math.min(m, low[i]!))));
    return { ground, start: 0 };
  }
  if (floor < 0) {
    let m = Infinity;
    return { ground: low.map((z) => Math.max(0, Math.min(-floor, (m = Math.min(m, z))))), start: -floor };
  }
  return { ground: low.map(() => 0), start: 0 };
}

/**
 * An action compiled: its recipe on `resolve` and the procedural parts made on its first library clip's rest, with an
 * event at each beat's start (named by it) and at each interrupt point ("interrupt"). It fails with coded issues when
 * the action doesn't check, a time falls outside it, or its feet don't stand on the grounds its floor gives.
 */
export function compileAction(a: Action, resolve: Resolver, opts: { moves?: readonly Move[] } = {}): CompiledAction {
  const issues = validateAction(a);
  if (issues.length) fail(issues);
  const firstId = a.steps.find((s) => s.op === "clip" && !String(s.id).startsWith("PROCEDURAL/"))!.id as string, first = resolve(firstId);
  if (!first) fail([{ code: "R-E008", field: "steps", message: `no clip ${firstId} in the library`, fix: "search the library for the clip's id" }]);
  const res = proceduralResolver(resolve, first!.rest, first!.clip.restSrc, opts.moves);
  const last = nameOf(a.steps, a.steps.length - 1), events = [...a.beats.map((b) => ({ t: b.from, name: b.name })), ...a.interrupts.map((i) => ({ t: i.t, name: "interrupt" }))];
  const out = compile({ ...recipeOf(a), steps: [...a.steps, { op: "events", in: last, add: events }] }, res), dur = out.clip.dur;
  const late = a.beats.filter((b) => b.to > dur + 1e-3);
  if (late.length) fail(late.map((b) => ({ code: "A-E005", field: "beats", message: `beat "${b.name}" ends at ${b.to} s, after the action (${dur} s)`, fix: `"to": ${dur}` })));
  const floor = a.floor ?? 0, low = lowest(out.rest, out.track.poses), { ground, start } = groundOf(low, floor), ts = out.track.times;
  // where the feet stand near each end: the lowest they come within ENDS s of it (a run or a landing may start in the
  // air), but a drop's first frame, where they stand on the ledge
  const near = (a: number, b: number) => Math.min(...low.filter((_, i) => ts[i]! >= a - 1e-9 && ts[i]! <= b + 1e-9)), onStart = floor < 0 ? low[0]! : near(0, ENDS), onEnd = near(dur - ENDS, dur);
  if (Math.abs(onStart - start) > GROUND_TOLERANCE || Math.abs(onEnd - (start + floor)) > GROUND_TOLERANCE)
    fail([{ code: "A-E006", field: "floor", message: `the feet stand on ${Math.round(onStart - start)} at the start and ${Math.round(onEnd - start)} at the end (% of the hip height from the start), not 0 and ${floor}`, fix: `"floor": ${Math.round(onEnd - onStart)}` }]);
  return { ...out, action: a, ground, start, resolve: res };
}

/** The ground's height in a compiled action at a time, % of the hip height in its clip's frame. */
function groundAt(c: CompiledAction, time: number): number {
  const ts = c.track.times, n = ts.length;
  if (time <= ts[0]!) return c.ground[0]!;
  for (let i = 1; i < n; i++) if (time <= ts[i]!) return c.ground[i - 1]! + ((c.ground[i]! - c.ground[i - 1]!) * (time - ts[i - 1]!)) / (ts[i]! - ts[i - 1]!);
  return c.ground[n - 1]!;
}
/** Where the character's root is at a time of an action: the clip's travel and turn, and `up`, the ground's height
 *  above where it started (% of the hip height): the curve a game moves its character along. */
export function actionRootAt(c: CompiledAction, time: number): Root & { up: number } {
  return { ...trackRootAt(c.track, Math.min(Math.max(0, time), c.track.dur)), up: groundAt(c, time) - c.start };
}
/** The first interrupt point at or after a time, if any. */
export const interruptAt = (c: CompiledAction, time: number): Interrupt | undefined => c.action.interrupts.find((i) => i.t >= time - 1e-9);

/** A clip's way of facing at a time, against its root: its pelvis turn less the root's. */
const facing = (body: unknown, yaw: number) => ((body as number[] | undefined)?.[0] ?? 0) - yaw;
/** An angle the short way round, in (−180, 180]. */
const short = (deg: number) => deg - 360 * Math.round(deg / 360);

/**
 * The action cut at an interrupt point and gone on into `target` (one of the point's clips, or any the resolver knows):
 * the action until then, then the target crossfaded in over `fade` s, in step on the feet, raised to the ground the
 * action stands on there and turned to face the way it faces (a get-up that ends turned from its root goes on turned).
 * `play` plays only that much of the target, s (all of it, a loop's whole cycle, by default): a preview of the cut.
 */
export function interruptInto(c: CompiledAction, at: Interrupt, target: string, opts: { fade?: number; play?: number } = {}): Compiled {
  const own: Resolved = { clip: c.clip, rest: c.rest, contentId: sha256(serialize(c.clip)) }, next = c.resolve(target);
  if (!next) fail([{ code: "R-E008", field: "to", message: `no clip ${target} to go on into`, fix: "a library clip, a PROCEDURAL/<Name> part or a compiled action" }]);
  const k0 = next!.clip.keys[0] as unknown as { body?: number[]; yaw?: number }, root = trackRootAt(c.track, at.t);
  const turn = Math.round(short(facing(poseAt(c.track, at.t).body, root.yaw) - facing(k0.body, k0.yaw ?? 0))), up = Math.round(groundAt(c, at.t));
  const [set, slug] = c.clip.id.split("/") as [string, string], into = target.split("/")[1]!.replace(/-/g, "_"); // a clip slug may keep "-"; a recipe's own id may not
  const play = opts.play !== undefined ? Math.min(opts.play, next!.clip.dur) : undefined;
  const steps: Step[] = [{ as: "action", op: "clip", id: c.clip.id, to: at.t }, { as: "next", op: "clip", id: target, ...(play !== undefined && play < next!.clip.dur ? { to: play } : {}) }];
  if (turn || up) steps.push({ as: "placed", op: "pose", in: "next", ...(up ? { hips: { up } } : {}), ...(turn ? { yaw: turn } : {}) });
  steps.push({ op: "sequence", items: ["action", turn || up ? "placed" : "next"], fade: opts.fade ?? 0.3, sync: "contacts" });
  const recipe: Recipe = { format: "2.0", id: `${set}/${slug}_To_${into}`, desc: `${c.action.desc ?? slug}, cut at ${at.t} s into ${target}`, steps };
  return compile(recipe, Object.assign((id: string) => (id === c.clip.id ? own : c.resolve(id)), { ids: () => [c.clip.id, ...(c.resolve.ids?.() ?? [])] }));
}

/** A compiled paired action: each role's clip, the time it starts at (s after the pair starts) and where it stands. */
export interface CompiledPair {
  pair: PairedAction;
  roles: Record<string, { compiled: Compiled; start: number; place: [number, number, number] }>;
  dur: number;
}
/** Each role compiled (its id the pair's and the role's), started so its `sync` event falls with the others'. */
export function compilePaired(p: PairedAction, resolve: Resolver): CompiledPair {
  const issues = validatePaired(p);
  if (issues.length) fail(issues);
  const compiled = Object.entries(p.roles).map(([name, r]) => {
    const c = compile({ format: p.format, id: `${p.id}_${cap(name)}`, desc: `${p.desc}: the ${name}`, steps: r.steps }, resolve), at = c.clip.events?.find((e) => e.name === p.sync)?.t;
    if (at === undefined) fail([{ code: "A-E005", field: `roles.${name}`, message: `the ${name} has no "${p.sync}" event to meet the others at`, fix: `{ "op": "events", "in": "…", "add": [{ "t": 0.4, "name": "${p.sync}" }] }` }]);
    return [name, c, at!, r.place ?? [0, 0, 0]] as const;
  });
  const meet = Math.max(...compiled.map(([, , at]) => at)), roles: CompiledPair["roles"] = {};
  for (const [name, c, at, place] of compiled) roles[name] = { compiled: c, start: Math.round((meet - at) * 1000) / 1000, place: [...place] };
  return { pair: p, roles, dur: Math.max(...Object.values(roles).map((r) => r.start + r.compiled.clip.dur)) };
}
/** Each role at a time of the pair: its own clip's time (held at its ends) and its root in the lead's frame. */
export function pairAt(c: CompiledPair, time: number): Record<string, { time: number; root: Root }> {
  const out: Record<string, { time: number; root: Root }> = {};
  for (const [name, r] of Object.entries(c.roles)) {
    const t = Math.min(Math.max(0, time - r.start), r.compiled.clip.dur), own = trackRootAt(r.compiled.track, t), [f, s, yaw] = r.place, rad = (yaw * Math.PI) / 180;
    out[name] = { time: t, root: { forward: f + own.forward * PM.cos(rad) - own.right * PM.sin(rad), right: s + own.forward * PM.sin(rad) + own.right * PM.cos(rad), yaw: yaw + own.yaw } };
  }
  return out;
}

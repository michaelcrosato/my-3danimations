// Recipes (WP-6.1, spec/RECIPE.md): the checks and their codes, and the schema agreeing with them; each operation on
// tracks made from library clips (clip, sequence, blend, layer, mirror, retime, pose, look, pin, exaggerate, smooth,
// overshoot, stiffen, events, contacts); the compiler's keys, provenance, license and sameness; and describe's line.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { parseClip, recipe as R, serialize, validate, type Clip, type Rest } from "../src/index.ts";
import { P, POINTS } from "../src/format/body.ts";
import { decodePose } from "../src/format/pose.ts";
import { mirrorPose, type Pose } from "../src/ops/pose.ts";
import { look, pin, reachTo, REACH } from "../src/recipe/ik.ts";
import { addContacts, addEvents, blendTracks, build, layer, mirror, poseDeltas, retime, sequence, steady, turnPose } from "../src/recipe/steps.ts";
import { exaggerate, overshoot, smooth, stiffen } from "../src/recipe/style.ts";
import { ease } from "../src/math/helpers.ts";
import { compose, invert, poseAt, rootAt, trackOfClip } from "../src/recipe/track.ts";
import type { Root, Track } from "../src/recipe/types.ts";

const LIB = join(import.meta.dirname, "../../../library/sets"), ROOT = join(import.meta.dirname, "../../..");
const IDS = ["STYLE100/Neutral_Walk", "STYLE100/BigSteps_Walk", "STYLE100_RUN/Neutral_Run", "MESH2MOTION/Idle_A", "MESH2MOTION/Punch_Jab", "MESH2MOTION/Punch_Cross", "CMU_CURATED/Walk_Loop", "CMU_CURATED/Curtsey", "MESH2MOTION/Crawl_RM", "CMU_CURATED/Duck_Under"];
const cache = new Map<string, { clip: Clip; rest: Rest }>();
function load(id: string): { clip: Clip; rest: Rest } {
  if (!cache.has(id)) {
    const [set, slug] = id.split("/") as [string, string], clip = parseClip(readFileSync(join(LIB, set, `${slug}.json`), "utf8"));
    const manifest = JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> };
    cache.set(id, { clip, rest: manifest.sources[clip.restSrc]!.rest });
  }
  return cache.get(id)!;
}
const resolve: R.Resolver = Object.assign((id: string) => (IDS.includes(id) ? { ...load(id), contentId: `content-of-${id}` } : undefined), { ids: () => IDS });
const track = (id: string, opts: Parameters<typeof trackOfClip>[3] = {}): Track => trackOfClip(load(id).clip, load(id).rest, 30, opts);
const recipe = (steps: R.Step[], extra: Partial<R.Recipe> = {}): R.Recipe => ({ format: "2.0", id: "RECIPES/Test", steps, ...extra });
const codes = (r: unknown) => R.validateRecipe(r).map((i) => i.code);
const part = (p: Pose, f: string, i: number) => (p[f] as number[])[i]!;
/** Two poses with the same fields, every number within 1e-9. */
const near = (a: Pose, b: Pose) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((f) => [a[f]].flat().every((x, i) => Math.abs((x as number) - ([b[f]].flat()[i] as number)) < 1e-9));
/** b's travel from a. */
const sub2 = (b: Root, a: Root): Root => ({ forward: b.forward - a.forward, right: b.right - a.right, yaw: b.yaw - a.yaw });
/** The largest jump of a root between frames, in % of H0. */
const rootJump = (t: Track) => Math.max(...t.roots.slice(1).map((r, i) => Math.hypot(r.forward - t.roots[i]!.forward, r.right - t.roots[i]!.right)));
/** A point's place (mm, from the root) in a track's pose at a time. */
function point(t: Track, time: number, name: string): [number, number, number] {
  const X = new Float32Array(P * 3), i = POINTS.indexOf(name as never);
  decodePose(t.rest, poseAt(t, time), X);
  return [X[i * 3]!, X[i * 3 + 1]!, X[i * 3 + 2]!];
}
/** A part's mean over a track's frames. */
const meanOf = (t: Track, f: string, i: number) => t.poses.reduce((a, p) => a + part(p, f, i), 0) / t.poses.length;
/** Each number's spread about its mean over a track, summed over a field. */
function spread(t: Track, f: string): number {
  const n = (t.poses[0]![f] as number[]).length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const v = t.poses.map((p) => part(p, f, i)), m = v.reduce((a, b) => a + b, 0) / v.length;
    s += Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
  }
  return s;
}

describe("a recipe's check", () => {
  it("names each problem with its code, where it is and a fix", () => {
    expect(codes(null)).toEqual(["R-E001"]);
    expect(codes({ format: "1.0", id: "nope", steps: [] })).toEqual(["R-E001", "R-E001", "R-E001"]);
    const blnd = R.validateRecipe(recipe([{ as: "w", op: "clip", id: "STYLE100/Neutral_Walk" }, { op: "blnd", in: "w" }]));
    expect(blnd).toEqual([{ code: "R-E002", step: 2, field: "op", message: 'no operation "blnd"', fix: 'did you mean "blend"?' }]);
    expect(codes(recipe([{ as: "a", op: "clip", id: "STYLE100/Neutral_Walk" }, { op: "blend", a: "a", b: "a" }]))).toEqual(["R-E003"]);
    expect(codes(recipe([{ as: "a", op: "clip", id: "STYLE100/Neutral_Walk" }, { op: "smooth", in: "a", window: 9 }]))).toEqual(["R-E004"]);
    // a name that isn't an earlier step, a name twice, a field the operation doesn't take
    expect(codes(recipe([{ op: "mirror", in: "later" }, { as: "later", op: "clip", id: "STYLE100/Neutral_Walk" }]))).toEqual(["R-E005"]);
    expect(codes(recipe([{ as: "a", op: "clip", id: "STYLE100/Neutral_Walk" }, { as: "a", op: "mirror", in: "a" }]))).toEqual(["R-E006"]);
    const typo = R.validateRecipe(recipe([{ as: "a", op: "clip", id: "STYLE100/Neutral_Walk" }, { op: "retime", in: "a", sped: 2, speed: 2 }]));
    expect(typo.map((i) => [i.code, i.fix])).toEqual([["R-E007", 'did you mean "speed"?']]);
    expect(R.formatRecipeIssue(typo[0]!)).toBe('R-E007 step 2 sped: retime has no field "sped"\n  fix: did you mean "speed"?');
    expect(Object.keys(R.RECIPE_RULES)).toEqual(["R-E001", "R-E002", "R-E003", "R-E004", "R-E005", "R-E006", "R-E007", "R-E008", "R-E009"]);
    // every issue says how to fix it
    expect(R.validateRecipe(recipe([{ as: "a", op: "clip", id: "STYLE100/Neutral_Walk" }, { op: "blend", a: "a", b: "a" }, { op: "smooth", in: "a", window: 9 }])).every((i) => i.fix)).toBe(true);
    // names a JavaScript object has are no operation, field or part; a pose moves no root; event names are a clip's
    const idle = { as: "i", op: "clip", id: "MESH2MOTION/Idle_A" };
    expect(codes(recipe([idle, { op: "toString", in: "i" }]))).toEqual(["R-E002"]);
    expect(codes(recipe([idle, { op: "pose", in: "i", constructor: { a: 1 } }]))).toEqual(["R-E007"]);
    expect(codes(recipe([idle, { op: "mirror", in: "i", hasOwnProperty: 1 }]))).toEqual(["R-E007"]);
    expect(codes(recipe([idle, { op: "pose", in: "i", root: { forward: 50 } }]))).toEqual(["R-E007"]);
    expect(codes(recipe([idle, { op: "events", in: "i", add: [{ t: 0.5, name: "footstepL" }] }]))).toEqual(["R-E004"]);
    expect(codes(recipe([idle, { op: "events", in: "i", add: [{ t: 0.5, name: "foot-step" }] }]))).toEqual([]);
    expect(codes(recipe([idle, { op: "exaggerate", in: "i", amount: 2, mask: {} }]))).toEqual(["R-E004"]);
    expect(codes(recipe([idle, { op: "pin", in: "i", end: "handR", path: [[1, 0, 0, 0], [0.5, 0, 0, 0]] }]))).toEqual(["R-E004"]);
    expect(codes(recipe([idle, { op: "blend", a: "i", b: "i", w: [[0.5, 0], [0.2, 1]] }]))).toEqual(["R-E004"]);
    // a step can't take a name the steps already answer to by place
    expect(codes(recipe([{ as: "s1", op: "clip", id: "MESH2MOTION/Idle_A" }]))).toEqual(["R-E006"]);
    expect(codes(recipe([{ as: "s12", op: "clip", id: "MESH2MOTION/Idle_A" }]))).toEqual(["R-E006"]);
    // every issue, of every kind, says how to fix it
    const bad = R.validateRecipe({ format: "2.0", id: "RECIPES/Bad", fps: 0, tags: ["Big Walk"], name: 3, colour: "red", steps: [7, { as: "s1", op: "clip", id: "MESH2MOTION/Idle_A", zzz: 1 }, { as: "s1", op: "retime", in: "s1", speed: 2, dur: 1 }, { op: "pose", in: "s1", yaw: "left", chest: { lean: "far", zzz: 1 } }, { op: "mirror", in: "s1", qqqqqq: 1 }] });
    expect(bad.length).toBeGreaterThan(9);
    expect(bad.filter((i) => !i.fix)).toEqual([]);
  });
  it("adds, compiling, a clip the library doesn't have and a time outside its track", () => {
    expect(() => R.compile(recipe([{ op: "clip", id: "STYLE100/Neutral_Wlak" }]), resolve)).toThrow(/R-E008 step 1 id: no clip STYLE100\/Neutral_Wlak in the library\n {2}fix: did you mean STYLE100\/Neutral_Walk\?/);
    expect(() => R.compile(recipe([{ op: "clip", id: "STYLE100/Neutral_Walk", from: 0.2, to: 50 }]), resolve)).toThrow(/R-E009 step 1 to: to 50 s is past the clip's end/);
    expect(() => R.compile(recipe([{ op: "clip", id: "STYLE100/Neutral_Walk", from: 0.6, to: 0.3 }]), resolve)).toThrow(/R-E004 step 1 to/);
    // every time a step gives: a span's end, a path's points, a curve's, an event's (none before 0)
    const w = { as: "w", op: "clip", id: "MESH2MOTION/Idle_A" }, R9 = (s: R.Step) => () => R.compile(recipe([w, s]), resolve);
    expect(R9({ op: "pose", in: "w", chest: { lean: 5 }, to: 99 })).toThrow(/R-E009 step 2 to/);
    expect(R9({ op: "pin", in: "w", end: "handR", path: [[0.5, 300, 200, 1100], [99, 300, 200, 1100]] })).toThrow(/R-E009 step 2 path/);
    expect(R9({ op: "blend", a: "w", b: "w", w: [[0, 0], [99, 1]] })).toThrow(/R-E009 step 2 w/);
    expect(R9({ op: "events", in: "w", add: [{ t: -0.5, name: "hit" }] })).toThrow(/R-E009 step 2 add/);
    expect(() => R.compile(recipe([{ as: "w", op: "clip", id: "STYLE100/Neutral_Walk" }, { op: "pose", in: "w", chest: { lean: 5 }, from: 9 }]), resolve)).toThrow(/R-E009 step 2 from/);
    // a slice that leaves none of the clip, a seam blended over more than there is: coded, not thrown from inside
    expect(() => R.compile(recipe([{ op: "clip", id: "MESH2MOTION/Punch_Jab", from: load("MESH2MOTION/Punch_Jab").clip.dur }]), resolve)).toThrow(/R-E009 step 1 from/);
    expect(() => R.compile(recipe([{ op: "clip", id: "MESH2MOTION/Punch_Jab", to: 0.3, loop: 0.5 }]), resolve)).toThrow(/R-E009 step 1 loop/);
    expect(() => R.compile(recipe([{ op: "clip", id: "STYLE100/Neutral_Walk", loop: 2 }]), resolve)).toThrow(/R-E009 step 1 loop/);
    // a contact's end: within a once track; a loop's may wrap past its end (MOTION.md §7.1), but by no more than a cycle
    const jab = { as: "j", op: "clip", id: "MESH2MOTION/Punch_Jab" }, walk = { as: "w", op: "clip", id: "STYLE100/Neutral_Walk" };
    expect(() => R.compile(recipe([jab, { op: "contacts", in: "j", add: { handR: [[0.9, 1.2]] } }]), resolve)).toThrow(/R-E009 step 2 add/);
    expect(R.compile(recipe([walk, { op: "contacts", in: "w", add: { handR: [[1.2, 1.5]] } }]), resolve).clip.contacts!.handR).toEqual([[1.2, 1.5]]);
    expect(() => R.compile(recipe([walk, { op: "contacts", in: "w", add: { handR: [[1.2, 2.6]] } }]), resolve)).toThrow(/R-E009 step 2 add/);
  });
  it("agrees with spec/schemas/recipe.schema.json on the operations and their fields", () => {
    const schema = JSON.parse(readFileSync(join(ROOT, "spec/schemas/recipe.schema.json"), "utf8")) as { properties: { steps: { items: { oneOf: { properties: Record<string, { const?: string }> }[] } } } };
    const ops = schema.properties.steps.items.oneOf;
    expect(ops.map((o) => o.properties.op!.const)).toEqual(Object.keys(R.OPS));
    for (const o of ops) if (o.properties.op!.const !== "pose") expect([o.properties.op!.const, Object.keys(o.properties).filter((k) => k !== "op" && k !== "as").sort()]).toEqual([o.properties.op!.const, Object.keys(R.OPS[o.properties.op!.const!]!.fields).sort()]);
    const check = new Ajv2020({ strict: false }).compile(schema);
    expect(check(recipe([{ op: "clip", id: "STYLE100/Neutral_Walk" }]))).toBe(true);
    expect(check(recipe([{ op: "clip", id: "STYLE100/Neutral_Walk", form: 1 }]))).toBe(false);
  });
});

describe("the operations", () => {
  it("clip: a library clip sliced and closed into a loop, its frames on the rate's grid", () => {
    const t = track("MESH2MOTION/Punch_Jab", { from: 0.2, to: 0.8 });
    expect([t.dur, t.loop, t.times[1], t.times.at(-1)]).toEqual([0.6, false, 0.033, 0.6]);
    const looped = track("MESH2MOTION/Punch_Jab", { from: 0.2, to: 0.8, loop: true });
    expect(looped.loop).toBe(true);
    expect(looped.times.at(-1)!).toBeLessThan(looped.dur);
  });
  it("sequence: one after another with crossfades, the root carrying on, in step on the contacts when asked", () => {
    const walk = track("STYLE100/Neutral_Walk"), run = track("STYLE100_RUN/Neutral_Run"), s = sequence([walk, walk, run], 0.25, true), plain = sequence([walk, run], 0.25, false);
    expect(plain.dur).toBeCloseTo(walk.dur - 0.25 + run.dur, 2);
    expect(s.dur).toBeGreaterThan(walk.dur * 2 - 0.5);
    // travel never jumps: at most a frame's worth of a run's speed
    expect(rootJump(s)).toBeLessThan(5);
    // a travelling crawl followed by itself in step: the second starts mid-stride, its root carried on from there, so
    // travel never jumps more than a frame's worth of the crawl's own
    const cw = track("MESH2MOTION/Crawl_RM"), twice = sequence([cw, cw], 0.25, true);
    expect(rootJump(cw)).toBeGreaterThan(1);
    // and a travelling once clip followed by itself in step starts the second mid-way, from where its root has got to
    const duck = track("CMU_CURATED/Duck_Under"), ducks = sequence([duck, duck], 0.2, true);
    expect(ducks.dur).toBeLessThan(duck.dur * 2 - 0.3);
    expect(rootJump(ducks)).toBeLessThan(rootJump(duck) * 1.5);
    expect(rootJump(twice)).toBeLessThan(rootJump(cw) * 1.5);
    // a turning clip's heading carries into the next: the body's turn less the root's stays continuous (MOTION.md §5.3)
    const turned = sequence([track("CMU_CURATED/Curtsey"), track("MESH2MOTION/Idle_A")], 0.3, false), facing = turned.poses.map((p, i) => part(p, "body", 0) - turned.roots[i]!.yaw);
    expect(Math.max(...facing.slice(1).map((f, i) => Math.abs(f - facing[i]!)))).toBeLessThan(15);
    // standing clips have no step to keep in: the next one plays from its start
    const jab = track("MESH2MOTION/Punch_Jab"), cross = track("MESH2MOTION/Punch_Cross");
    expect(sequence([jab, cross], 0.2, true).dur).toBeCloseTo(jab.dur - 0.2 + cross.dur, 2);
    // in step: the run starts at the point of its stride the walk had reached, not at its own start
    const late = s.dur - run.dur / 2;
    expect(near(poseAt(s, late), poseAt(sequence([walk, walk, run], 0.25, false), late - (s.dur - sequence([walk, walk, run], 0.25, false).dur)))).toBe(false);
  });
  it("blend: two loops in step, lasting between their durations, and its angles never flipping half a turn", () => {
    const a = track("STYLE100/Neutral_Walk"), b = track("STYLE100/BigSteps_Walk"), half = blendTracks(a, b, 0.5, true);
    expect(half.dur).toBeCloseTo((a.dur + b.dur) / 2, 2);
    expect(half.loop).toBe(true);
    expect(blendTracks(a, b, 0, true).dur).toBeCloseTo(a.dur, 2);
    // between frames, no angle jumps (BigSteps' right foot heading winds round as the foot points down)
    for (let i = 1; i < half.poses.length; i++) for (const f of ["footL", "footR", "handL", "handR"]) if (half.poses[i]![f]) expect(Math.abs(part(half.poses[i]!, f, f.startsWith("foot") ? 1 : 2) - part(half.poses[i - 1]!, f, f.startsWith("foot") ? 1 : 2))).toBeLessThan(90);
    // all the way to b reads b at a's phase: its mean, not a's
    const toB = blendTracks(a, b, 1, true);
    expect(Math.abs(meanOf(a, "head", 1) - meanOf(b, "head", 1))).toBeGreaterThan(5);
    expect(Math.abs(meanOf(toB, "head", 1) - meanOf(b, "head", 1))).toBeLessThan(1);
    // a blend that can't close plays once: a curve that ends elsewhere than it starts, or two loops read out of step
    expect(blendTracks(a, b, [[0, 0], [1.2, 1]], true).loop).toBe(false);
    expect(blendTracks(a, b, 0.5, false).loop).toBe(false);
    expect(blendTracks(a, a, [[0, 0.3], [0.6, 0.8], [a.dur, 0.3]], false).loop).toBe(true);
    // held steady: b's angle crossing a's opposite doesn't flip the halfway between them
    const mix = steady(), out = [-170, -178, -182, -190].map((r) => part(mix({ handR: [0, 0, r] }, { handR: [0, 0, 0] }, 0.5), "handR", 2));
    expect(out.slice(1).every((v, i) => Math.abs(v - out[i]!) < 10)).toBe(true);
    expect(out).toEqual([-85, -89, -91, -95]);
  });
  it("layer: the masked fields from the over, the rest from the base; additive adds the over's change", () => {
    const idle = track("MESH2MOTION/Idle_A"), jab = track("MESH2MOTION/Punch_Jab"), l = layer(idle, jab, { armR: 1, handR: 1 }, 1, false);
    expect(l.dur).toBe(idle.dur);
    expect(l.poses[5]!.legL).toEqual(idle.poses[5]!.legL);
    expect(l.poses[5]!.armR).toEqual(poseAt(jab, l.times[5]!).armR);
    // additive: the over's change from its first pose added on the base, number for number
    const add = layer(idle, jab, { armR: 1 }, 1, true);
    expect(part(add.poses[8]!, "armR", 1)).toBeCloseTo(part(idle.poses[8]!, "armR", 1) + part(poseAt(jab, add.times[8]!), "armR", 1) - part(jab.poses[0]!, "armR", 1), 6);
    expect(Math.abs(part(poseAt(jab, add.times[8]!), "armR", 1) - part(jab.poses[0]!, "armR", 1))).toBeGreaterThan(15);
    // the over's first pose added on changes nothing
    const still = layer(idle, { ...jab, poses: jab.poses.map(() => jab.poses[0]!) }, undefined, 1, true);
    for (let i = 0; i < idle.poses.length; i += 7) expect(part(still.poses[i]!, "armR", 0)).toBeCloseTo(part(idle.poses[i]!, "armR", 0), 6);
  });
  it("mirror: left and right swapped, the root's sideways travel and turn reversed; twice, as it was", () => {
    const w = track("STYLE100/Neutral_Walk"), m = mirror(w), mm = mirror(m);
    expect(m.poses[3]).toEqual(mirrorPose(w.poses[3]!));
    expect(m.roots.at(-1)!.right).toBeCloseTo(-w.roots.at(-1)!.right, 9);
    expect(m.contacts!.footL).toEqual(w.contacts!.footR);
    expect(mm.poses.every((p, i) => near(p, w.poses[i]!))).toBe(true);
    const turning = poseDeltas(w, { yaw: 20 }, 0, w.dur, 0);
    expect(mirror(turning).roots.map((r) => r.yaw)).toEqual(turning.roots.map((r) => -r.yaw));
  });
  it("retime: faster, to a length or through an ease, its events moved with it", () => {
    const jab = addEvents(track("MESH2MOTION/Punch_Jab"), [{ t: 0.4, name: "hit" }]), fast = retime(jab, { speed: 2 }), eased = retime(jab, { ease: "inOut" });
    expect(fast.dur).toBeCloseTo(jab.dur / 2, 2);
    expect(fast.events.find((e) => e.name === "hit")!.t).toBeCloseTo(0.2, 2);
    expect(retime(jab, { dur: 2 }).dur).toBe(2);
    expect([eased.poses[0], eased.poses.at(-1)]).toEqual([jab.poses[0], jab.poses.at(-1)]);
    // the frame at t shows the source at inOut(t / dur) of its length, not at t
    const k = 5, u = eased.times[k]! / eased.dur;
    expect(near(eased.poses[k]!, poseAt(jab, ease.inOut(u) * jab.dur))).toBe(true);
    expect(near(eased.poses[k]!, poseAt(jab, u * jab.dur))).toBe(false);
    expect([retime(track("STYLE100/Neutral_Walk"), { ease: "inOut" }).loop, retime(track("STYLE100/Neutral_Walk"), { speed: 2 }).loop]).toEqual([false, true]);
  });
  it("pose: the parts moved by that much from `from` to `to`, faded at both ends", () => {
    const w = track("STYLE100/Neutral_Walk"), lean = poseDeltas(w, { chest: { lean: 10 } }, 0.2, 0.8, 0.1);
    const at = (t: Track, time: number) => part(poseAt(t, time), "chest", 1);
    expect(at(lean, 0.5) - at(w, 0.5)).toBeCloseTo(10, 6);
    expect(at(lean, 0.1)).toBeCloseTo(at(w, 0.1), 9);
    expect(at(lean, 0.25) - at(w, 0.25)).toBeGreaterThan(0);
    expect(at(lean, 0.25) - at(w, 0.25)).toBeLessThan(10);
    // a yaw turns the character: its root, and its body in clip space; a loop turned all through closes turned
    const turned = poseDeltas(w, { yaw: 20 }, 0, w.dur, 0);
    expect(turned.roots.every((r) => r.yaw === 20)).toBe(true);
    expect(part(turned.poses[4]!, "body", 0) - part(w.poses[4]!, "body", 0)).toBeCloseTo(20, 9);
    const keys = R.compile(recipe([{ as: "w", op: "clip", id: "STYLE100/Neutral_Walk" }, { op: "pose", in: "w", yaw: 20 }]), resolve).clip.keys;
    expect(keys.map((x) => (x as { yaw?: number }).yaw)).toEqual(keys.map(() => 20));
  });
  it("look: the head turned toward a point, within what a neck does", () => {
    const idle = track("MESH2MOTION/Idle_A"), left = look(idle, [1000, -1000, 1500], 0.5, 1.5, 0.2, 1), far = look(idle, [-1000, -100, 1500], 0.5, 1.5, 0.2, 1);
    const face = (t: Track) => { const h = point(t, 1, "head"), f = point(t, 1, "faceF"); return Math.atan2(f[1] - h[1], f[0] - h[0]) * (180 / Math.PI); };
    expect(face(left)).toBeLessThan(face(idle) - 30);
    expect(Math.abs(part(poseAt(far, 1), "head", 0))).toBeLessThanOrEqual(80);
    // straight to the side is past what a neck turns: held at 80°
    const side = look(idle, [0, -2000, 1500], 0.5, 1.5, 0.2, 1), turn = part(poseAt(side, 1), "head", 0);
    expect(Math.abs(turn)).toBeLessThanOrEqual(80);
    expect(Math.abs(turn)).toBeGreaterThan(75);
    expect(near(poseAt(left, 0.2), poseAt(idle, 0.2))).toBe(true);
  });
  it("pin: the hand held on the path while it lasts, the elbow on its side", () => {
    const idle = track("MESH2MOTION/Idle_A"), reach = pin(idle, "handR", [[0.4, 350, 250, 1150], [1.2, 350, 250, 1150]], 0.2);
    const f = point(reach, 0.8, "fistR");
    expect(Math.hypot(f[0] - 350, f[1] - 250, f[2] - 1150)).toBeLessThan(15);
    expect(near(poseAt(reach, 0.1), poseAt(idle, 0.1))).toBe(true);
    // the elbow stays on the side of the shoulder-to-fist line it was on (out and back from it)
    const sideOf = (t: Track, time: number) => { const sh = point(t, time, "shR"), el = point(t, time, "elbowR"), fi = point(t, time, "fistR"), d = [fi[0] - sh[0], fi[1] - sh[1], fi[2] - sh[2]], e = [el[0] - sh[0], el[1] - sh[1], el[2] - sh[2]], k = (e[0] * d[0] + e[1] * d[1] + e[2] * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2); return [e[0] - k * d[0], e[1] - k * d[1], e[2] - k * d[2]]; };
    const before = sideOf(idle, 0.8), after = sideOf(reach, 0.8);
    expect(before[0] * after[0] + before[1] * after[1] + before[2] * after[2]).toBeGreaterThan(0);
    // a foot pinned on a straight leg: the knee bends forward, as a knee does
    const lift = pin(idle, "footL", [[0.5, 100, -150, 300], [1.5, 300, -150, 300]], 0.3), knee = point(lift, 1, "kneeL"), hip = point(lift, 1, "hipL"), ankle = point(lift, 1, "ankleL");
    expect(knee[0]).toBeGreaterThan((hip[0] + ankle[0]) / 2);
  });
  it("exaggerate, smooth, overshoot, stiffen: further from the mean, steadier, carried past a stop, held nearer", () => {
    const talk = track("MESH2MOTION/Punch_Jab"), base = spread(talk, "armR");
    expect(spread(exaggerate(talk, 1.5), "armR")).toBeGreaterThan(base * 1.3);
    expect(spread(stiffen(talk, 0.5, { armR: 1 }), "armR")).toBeLessThan(base * 0.7);
    const rough = (t: Track) => t.poses.slice(2).reduce((s, p, i) => s + Math.abs(part(p, "armR", 0) - 2 * part(t.poses[i + 1]!, "armR", 0) + part(t.poses[i]!, "armR", 0)), 0);
    expect(rough(smooth(talk, 0.2))).toBeLessThan(rough(talk) * 0.6);
    // a part that ramps up and stops: the overshoot never lags the ramp, carries on past the stop and settles back
    const base0 = talk.poses[0]!, stepAt = (time: number) => 30 * Math.min(1, Math.max(0, (time - 0.5) / 0.1));
    const step = build(talk, 1.6, false, (time) => ({ pose: { ...base0, armR: [stepAt(time), ...(base0.armR as number[]).slice(1)] }, root: { forward: 0, right: 0, yaw: 0 } }));
    const shot = overshoot(step, 1, { armR: 1 }), v = (time: number) => part(poseAt(shot, time), "armR", 0);
    expect(v(0.3)).toBeCloseTo(0, 6);
    expect(v(0.567)).toBeGreaterThanOrEqual(stepAt(0.567) - 1e-6);
    expect(Math.max(...shot.times.filter((x) => x > 0.6).map(v))).toBeGreaterThan(31);
    expect(v(1.6)).toBeCloseTo(30, 0);
    // past a stop, the overshoot reaches beyond where the part stops
    const o = overshoot(talk, 0.5, { armR: 1 }), lo = (t: Track) => Math.min(...t.poses.map((p) => part(p, "armR", 0))), hi = (t: Track) => Math.max(...t.poses.map((p) => part(p, "armR", 0)));
    expect(hi(o) - lo(o)).toBeGreaterThan(hi(talk) - lo(talk));
  });
  it("events and contacts: added, sorted, within the track", () => {
    const jab = track("MESH2MOTION/Punch_Jab"), e = addEvents(jab, [{ t: 0.5, name: "hit" }, { t: 0.1, name: "wind" }]), c = addContacts(jab, { handL: [[0.1, 0.3]] });
    expect(e.events.filter((x) => ["hit", "wind"].includes(x.name)).map((x) => x.name)).toEqual(["wind", "hit"]);
    expect(c.contacts!.handL).toEqual([[0.1, 0.3]]);
    expect(addContacts(jab, { handL: [[0.1, 0.3], [0.2, 0.5]] }).contacts!.handL).toEqual([[0.1, 0.5]]);
    // a loop's contact over its seam stays one interval that wraps (MOTION.md §7.1), through an added one and compiling
    const walk = track("STYLE100/Neutral_Walk"), wrap = walk.contacts!.footL!;
    expect(wrap.at(-1)![1]).toBeGreaterThan(walk.dur);
    expect(addContacts(walk, { handR: [[0.2, 0.3]] }).contacts!.footL).toEqual(wrap);
    expect(R.compile(recipe([{ op: "clip", id: "STYLE100/Neutral_Walk" }]), resolve).clip.contacts!.footL).toEqual(wrap);
    expect(retime(walk, { speed: 2 }).contacts!.footL!.at(-1)![1]).toBeCloseTo(wrap.at(-1)![1] / 2, 2);
    expect(rootAt(e, 0.5)).toEqual(rootAt(jab, 0.5));
  });
  it("a yaw turns the way a travelling clip goes, at every time of a loop and into the next item of a sequence", () => {
    // a pose's turn carries its pelvis's place relative to the root round with it
    expect(turnPose({ hips: [10, 0, 95], body: [5, 0, 0] }, 90)).toEqual({ hips: [expect.closeTo(0, 9), expect.closeTo(10, 9), 95], body: [95, 0, 0] });
    // a crawl turned 90° all through crawls to the right, its root at any time (cycles on, a cycle back, in the last
    // frame's interval) the plain crawl's turned about its start
    const cw = track("MESH2MOTION/Crawl_RM"), tw = poseDeltas(cw, { yaw: 90 }, 0, cw.dur, 0), r0 = cw.roots[0]!;
    const about = compose({ ...r0, yaw: r0.yaw + 90 }, invert(r0));
    // (the last frame's interval runs to where the next cycle starts: cw.dur − 0.004 falls in it)
    for (const time of [0.5, cw.dur - 0.004, cw.dur * 1.5, cw.dur * 3 - 0.004, -0.4]) {
      const want = compose(about, rootAt(cw, time)), got = rootAt(tw, time);
      expect([time, got.forward, got.right, got.yaw]).toEqual([time, expect.closeTo(want.forward, 6), expect.closeTo(want.right, 6), expect.closeTo(want.yaw, 6)]);
    }
    expect(rootAt(tw, cw.dur * 2).right).toBeGreaterThan(rootAt(cw, cw.dur * 2).forward * 0.95);
    expect(rootJump(tw)).toBeLessThan(rootJump(cw) + 1e-6);
    // turned for part of its length, it travels the way it faces then, and its root never jumps
    const part2 = poseDeltas(cw, { yaw: 90 }, 0.5, 1.2, 0.2), mid = sub2(rootAt(part2, 1.0), rootAt(part2, 0.9));
    expect(Math.abs(mid.right)).toBeGreaterThan(Math.abs(mid.forward) * 3);
    expect(rootJump(part2)).toBeLessThan(rootJump(cw) * 1.2);
    // and its next cycle starts where the turned travel got to: no jump at the seam, a cycle on or a cycle back
    const gap = (at: number) => { const d = sub2(rootAt(part2, at + 0.005), rootAt(part2, at - 0.005)); return Math.hypot(d.forward, d.right); };
    for (const seam of [cw.dur, cw.dur * 2, 0]) expect([seam, gap(seam) < 2]).toEqual([seam, true]);
    // in a sequence an item's own turn turns it from where it starts: crawl, then crawl turned 60°, ends facing and
    // having gone 60° to the right of the first
    const seq = sequence([cw, poseDeltas(cw, { yaw: 60 }, 0, cw.dur, 0)], 0.2, false), end = rootAt(seq, seq.dur), first = rootAt(cw, cw.dur - 0.2);
    expect(end.yaw).toBeCloseTo(60, 6);
    expect((Math.atan2(end.right - first.right, end.forward - first.forward) * 180) / Math.PI).toBeCloseTo(60, 0);
    expect(rootJump(seq)).toBeLessThan(rootJump(cw) * 1.5);
  });
  it("sequence in step: only a step sets the phase, read round a loop's seam, and each item's whole cycle keeps its contacts", () => {
    const walk = track("STYLE100/Neutral_Walk"), idle = track("MESH2MOTION/Idle_A"), same = (x: Track, y: Track) => x.dur === y.dur && x.poses.every((p, i) => near(p, y.poses[i]!));
    // a standing clip's feet set no phase for the walk after it, and the walk sets none for a clip that never lifts a foot
    expect(same(sequence([idle, walk], 0.3, true), sequence([idle, walk], 0.3, false))).toBe(true);
    expect(same(sequence([walk, idle], 0.3, true), sequence([walk, idle], 0.3, false))).toBe(true);
    // a crossfade that starts inside a plant over the walk's seam keeps the walks in step: each plant of the left foot
    // a cycle after the last, however long the fade
    for (const fade of [0.2, 0.45, 0.5]) {
      const s = sequence([walk, walk, walk], fade, true), plants = s.contacts!.footL!.map(([a]) => a).filter((a) => a > 0.01);
      expect([fade, plants.slice(1).map((a, i) => a - plants[i]!)]).toEqual([fade, plants.slice(1).map(() => expect.closeTo(walk.dur, 1))]);
    }
    // a once item whose step would start too late to fade in plays from its start
    const half = trackOfClip(load("STYLE100/Neutral_Walk").clip, load("STYLE100/Neutral_Walk").rest, 30, { from: 0, to: 0.6 });
    const s2 = sequence([walk, half], 0.3, true);
    expect(s2.dur).toBeCloseTo(sequence([walk, half], 0.3, false).dur, 6);
    // a walk always has a foot down: so does a sequence of walks in step, the second's cycle read all round
    const two = sequence([walk, walk], 0.25, true);
    for (let time = 0; time < two.dur; time += 0.05) expect([time, (["footL", "footR"] as const).some((f) => two.contacts![f]!.some(([a, b]) => a <= time + 0.02 && b >= time - 0.02))]).toEqual([time, true]);
  });
  it("blend, layer and retime: a curve as a number blends alike, read on a's clock, and a loop that plays once keeps its seam's contacts", () => {
    const a = track("STYLE100/Neutral_Walk"), b = track("STYLE100/BigSteps_Walk");
    const flat = blendTracks(a, b, [[0, 0.2], [a.dur, 0.2]], true), num = blendTracks(a, b, 0.2, true);
    expect([flat.loop, flat.poses.every((p, i) => near(p, num.poses[i]!))]).toEqual([true, true]);
    expect(blendTracks(a, b, 0.5, false).sources).toEqual(["STYLE100/Neutral_Walk", "STYLE100/BigSteps_Walk"]);
    // a curve reaching 1 at a's end reaches it at the result's end, however long that is
    const jab = track("MESH2MOTION/Punch_Jab"), idle = track("MESH2MOTION/Idle_A"), toIdle = blendTracks(jab, idle, [[0, 0], [jab.dur, 1]], true);
    expect(near(poseAt(toIdle, toIdle.dur * 0.6), poseAt(idle, idle.dur * 0.6))).toBe(false);
    expect(near(toIdle.poses.at(-1)!, poseAt(idle, idle.dur))).toBe(true);
    // the walk's left plant over its seam ([1.05, 1.766] of 1.333 s) is both its parts once the result plays once
    const wrap = a.contacts!.footL!.at(-1)!, parts = [[0, expect.closeTo(wrap[1] - a.dur, 2)], [wrap[0], a.dur]];
    expect(retime(a, { ease: "inOut" }).contacts!.footL!.length).toBe(2);
    expect(layer(a, jab, { armR: 1 }, 1, false).contacts!.footL).toEqual(parts);
    expect(blendTracks(a, b, 0.5, false).contacts!.footL).toEqual(parts);
    expect(blendTracks(a, b, [[0, 0], [a.dur, 1]], true).contacts!.footR!.length).toBe(2);
  });
  it("pin: a straight limb bends the way it bends, and its joint's side turns with a big swing", () => {
    const idle = track("MESH2MOTION/Idle_A");
    // the left leg pulled straight, then its foot pinned higher: the knee comes forward, as a knee does
    const straight = build(idle, idle.dur, idle.loop, (time) => {
      const p = poseAt(idle, time), l = p.legL as number[];
      return { pose: { ...p, legL: [l[0]!, l[1]!, l[2]!, 0, ...l.slice(4)] }, root: rootAt(idle, time) };
    });
    const ankle = point(straight, 1, "ankleL"), up = pin(straight, "footL", [[0.5, ankle[0], ankle[1], ankle[2] + 150], [1.5, ankle[0], ankle[1], ankle[2] + 150]], 0.2);
    const knee = point(up, 1, "kneeL"), hip = point(up, 1, "hipL"), a2 = point(up, 1, "ankleL");
    expect(knee[0] - (hip[0] + a2[0]) / 2).toBeGreaterThan(20);
    // the hand from hanging to high in front: the elbow, behind the arm as it hangs, comes round in front of it
    const sh = point(idle, 1, "shR"), raised = pin(idle, "handR", [[0.5, sh[0] + 150, sh[1], sh[2] + 450], [1.5, sh[0] + 150, sh[1], sh[2] + 450]], 0);
    const el = point(raised, 1, "elbowR"), fi = point(raised, 1, "fistR"), s2 = point(raised, 1, "shR");
    expect(el[0] - (s2[0] + fi[0]) / 2).toBeGreaterThan(10);
    // a knee exactly on the line from hip to ankle has no side of its own: it bends forward, as a knee does
    const X = new Float32Array(P * 3), at = (n: string) => POINTS.indexOf(n as never) * 3, get = (n: string): [number, number, number] => [X[at(n)]!, X[at(n) + 1]!, X[at(n) + 2]!];
    decodePose(idle.rest, poseAt(idle, 1), X);
    const h = get("hipL"), an = get("ankleL"), thigh = Math.hypot(...get("kneeL").map((v, i) => v - h[i]!)), line = an.map((v, i) => v - h[i]!), ll = Math.hypot(...line);
    X.set(h.map((v, i) => v + (line[i]! / ll) * thigh), at("kneeL"));
    reachTo(X, "footL", [an[0], an[1], an[2] + 120]);
    expect(get("kneeL")[0] - (get("hipL")[0] + get("ankleL")[0]) / 2).toBeGreaterThan(20);
    // a hand pinned out of reach stops short of a straight arm (whose elbow and twist have nothing to go by)
    const far = pin(idle, "handR", [[0.5, 900, 300, 1400], [1.5, 900, 300, 1400]], 0.2), d = (p: number[], q: number[]) => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!);
    const S = point(far, 1, "shR"), E = point(far, 1, "elbowR"), F = point(far, 1, "fistR");
    expect(d(S, F) / (d(S, E) + d(E, F))).toBeLessThan(REACH + 0.002);
    expect(d(S, F) / (d(S, E) + d(E, F))).toBeGreaterThan(REACH - 0.02);
  });
});

describe("compiling", () => {
  const r = recipe([{ as: "walk", op: "clip", id: "STYLE100/Neutral_Walk" }, { op: "pose", in: "walk", chest: { lean: 8 } }], { tags: ["walk", "loop"], desc: "A walk, leaning forward" });
  it("writes a valid format-2 clip whose keys stay within the budget", () => {
    const out = R.compile(r, resolve);
    expect(validate(out.clip).errors).toEqual([]);
    expect([out.clip.loop, out.clip.id, out.clip.tags, out.clip.restSrc]).toEqual([true, "RECIPES/Test", ["walk", "loop"], load("STYLE100/Neutral_Walk").clip.restSrc]);
    expect(out.clip.quality.fit[1]).toBeLessThanOrEqual(R.KEY_BUDGET);
    expect(out.clip.keys.length).toBeLessThan(out.track.times.length);
  });
  it("names the recipe's hash and its inputs' content ids, with the license they force", () => {
    const p = R.compile(r, resolve).clip.provenance as Clip["provenance"] & { recipe: { sha256: string; inputs: Record<string, string> } };
    expect([p.method, p.ai, p.orig, p.producer.tool]).toEqual(["composed", "composite", "STYLE100/Neutral_Walk", "m3a-recipe"]);
    expect(p.recipe).toEqual({ sha256: R.sha256(R.canonical(r)), inputs: { "STYLE100/Neutral_Walk": "content-of-STYLE100/Neutral_Walk" } });
    const cc0 = { ...load("MESH2MOTION/Idle_A"), contentId: "a" }, cmu = { ...load("CMU_CURATED/Walk_Loop"), contentId: "b" }, style = { ...load("STYLE100/Neutral_Walk"), contentId: "c" };
    expect(R.licenseOf([cc0, cc0])).toEqual({ license: "CC0-1.0" });
    // a clip read by no step that leads to the result is no input of it
    const p2 = R.compile(recipe([{ as: "x", op: "clip", id: "CMU_CURATED/Walk_Loop" }, { as: "i", op: "clip", id: "MESH2MOTION/Idle_A" }, { op: "mirror", in: "i" }]), resolve).clip.provenance as Clip["provenance"] & { recipe: { inputs: Record<string, string> } };
    expect([p2.orig, p2.license, Object.keys(p2.recipe.inputs)]).toEqual(["MESH2MOTION/Idle_A", "CC0-1.0", ["MESH2MOTION/Idle_A"]]);
    expect(R.licenseOf([cc0, style, cmu]).license).toBe(`${[cmu.clip.provenance.license, style.clip.provenance.license].sort().join(" AND ")}`);
  });
  it("gives the same clip, byte for byte, for the same recipe and inputs", () => {
    expect(serialize(R.compile(r, resolve).clip)).toBe(serialize(R.compile(JSON.parse(JSON.stringify(r)) as R.Recipe, resolve).clip));
  });
  it("hashes as SHA-256 does, over canonical JSON", () => {
    expect(R.sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(R.sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    for (const text of ["é".repeat(40), "a".repeat(55), "a".repeat(56), "a".repeat(64), "🙂 walk"]) expect(R.sha256(text)).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
    expect(R.canonical({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
  });
  it("is described in a line: what it makes and each step in a few words", () => {
    const text = R.describeRecipe(r);
    expect(text).toMatch(/^RECIPES\/Test/);
    expect(text).toContain("STYLE100/Neutral_Walk");
    expect(text.length).toBeLessThanOrEqual(300);
  });
});

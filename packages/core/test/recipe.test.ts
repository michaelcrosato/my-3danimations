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
import { look, pin } from "../src/recipe/ik.ts";
import { addContacts, addEvents, blendTracks, layer, mirror, poseDeltas, retime, sequence, steady } from "../src/recipe/steps.ts";
import { exaggerate, overshoot, smooth, stiffen } from "../src/recipe/style.ts";
import { poseAt, rootAt, trackOfClip } from "../src/recipe/track.ts";
import type { Track } from "../src/recipe/types.ts";

const LIB = join(import.meta.dirname, "../../../library/sets"), ROOT = join(import.meta.dirname, "../../..");
const IDS = ["STYLE100/Neutral_Walk", "STYLE100/BigSteps_Walk", "STYLE100_RUN/Neutral_Run", "MESH2MOTION/Idle_A", "MESH2MOTION/Punch_Jab", "CMU_CURATED/Walk_Loop"];
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
/** The largest jump of a root between frames, in % of H0. */
const rootJump = (t: Track) => Math.max(...t.roots.slice(1).map((r, i) => Math.hypot(r.forward - t.roots[i]!.forward, r.right - t.roots[i]!.right)));
/** A point's place (mm, from the root) in a track's pose at a time. */
function point(t: Track, time: number, name: string): [number, number, number] {
  const X = new Float32Array(P * 3), i = POINTS.indexOf(name as never);
  decodePose(t.rest, poseAt(t, time), X);
  return [X[i * 3]!, X[i * 3 + 1]!, X[i * 3 + 2]!];
}
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
  });
  it("adds, compiling, a clip the library doesn't have and a time outside its track", () => {
    expect(() => R.compile(recipe([{ op: "clip", id: "STYLE100/Neutral_Wlak" }]), resolve)).toThrow(/R-E008 step 1 id: no clip STYLE100\/Neutral_Wlak in the library\n {2}fix: did you mean STYLE100\/Neutral_Walk\?/);
    expect(() => R.compile(recipe([{ op: "clip", id: "STYLE100/Neutral_Walk", from: 0.2, to: 50 }]), resolve)).toThrow(/R-E009 step 1 to: to 50 s is past the clip's end/);
    expect(() => R.compile(recipe([{ op: "clip", id: "STYLE100/Neutral_Walk", from: 0.6, to: 0.3 }]), resolve)).toThrow(/R-E004 step 1 to/);
    expect(() => R.compile(recipe([{ as: "w", op: "clip", id: "STYLE100/Neutral_Walk" }, { op: "pose", in: "w", chest: { lean: 5 }, from: 9 }]), resolve)).toThrow(/R-E009 step 2 from/);
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
    // held steady: b's angle crossing a's opposite doesn't flip the halfway between them
    const mix = steady(), out = [-170, -178, -182, -190].map((r) => part(mix({ handR: [0, 0, r] }, { handR: [0, 0, 0] }, 0.5), "handR", 2));
    expect(out).toEqual([-85, -89, -91, -95]);
  });
  it("layer: the masked fields from the over, the rest from the base; additive adds the over's change", () => {
    const idle = track("MESH2MOTION/Idle_A"), jab = track("MESH2MOTION/Punch_Jab"), l = layer(idle, jab, { armR: 1, handR: 1 }, 1, false);
    expect(l.dur).toBe(idle.dur);
    expect(l.poses[5]!.legL).toEqual(idle.poses[5]!.legL);
    expect(l.poses[5]!.armR).toEqual(poseAt(jab, l.times[5]!).armR);
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
  });
  it("retime: faster, to a length or through an ease, its events moved with it", () => {
    const jab = addEvents(track("MESH2MOTION/Punch_Jab"), [{ t: 0.4, name: "hit" }]), fast = retime(jab, { speed: 2 }), eased = retime(jab, { ease: "inOut" });
    expect(fast.dur).toBeCloseTo(jab.dur / 2, 2);
    expect(fast.events.find((e) => e.name === "hit")!.t).toBeCloseTo(0.2, 2);
    expect(retime(jab, { dur: 2 }).dur).toBe(2);
    expect([eased.poses[0], eased.poses.at(-1)]).toEqual([jab.poses[0], jab.poses.at(-1)]);
  });
  it("pose: the parts moved by that much from `from` to `to`, faded at both ends", () => {
    const w = track("STYLE100/Neutral_Walk"), lean = poseDeltas(w, { chest: { lean: 10 } }, 0.2, 0.8, 0.1);
    const at = (t: Track, time: number) => part(poseAt(t, time), "chest", 1);
    expect(at(lean, 0.5) - at(w, 0.5)).toBeCloseTo(10, 6);
    expect(at(lean, 0.1)).toBeCloseTo(at(w, 0.1), 9);
    expect(at(lean, 0.25) - at(w, 0.25)).toBeGreaterThan(0);
    expect(at(lean, 0.25) - at(w, 0.25)).toBeLessThan(10);
  });
  it("look: the head turned toward a point, within what a neck does", () => {
    const idle = track("MESH2MOTION/Idle_A"), left = look(idle, [1000, -1000, 1500], 0.5, 1.5, 0.2, 1), far = look(idle, [-1000, -100, 1500], 0.5, 1.5, 0.2, 1);
    const face = (t: Track) => { const h = point(t, 1, "head"), f = point(t, 1, "faceF"); return Math.atan2(f[1] - h[1], f[0] - h[0]) * (180 / Math.PI); };
    expect(face(left)).toBeLessThan(face(idle) - 30);
    expect(Math.abs(part(poseAt(far, 1), "head", 0))).toBeLessThanOrEqual(80);
    expect(near(poseAt(left, 0.2), poseAt(idle, 0.2))).toBe(true);
  });
  it("pin: the hand held on the path while it lasts, the elbow on its side", () => {
    const idle = track("MESH2MOTION/Idle_A"), reach = pin(idle, "handR", [[0.4, 350, 250, 1150], [1.2, 350, 250, 1150]], 0.2);
    const f = point(reach, 0.8, "fistR");
    expect(Math.hypot(f[0] - 350, f[1] - 250, f[2] - 1150)).toBeLessThan(15);
    expect(near(poseAt(reach, 0.1), poseAt(idle, 0.1))).toBe(true);
  });
  it("exaggerate, smooth, overshoot, stiffen: further from the mean, steadier, carried past a stop, held nearer", () => {
    const talk = track("MESH2MOTION/Punch_Jab"), base = spread(talk, "armR");
    expect(spread(exaggerate(talk, 1.5), "armR")).toBeGreaterThan(base * 1.3);
    expect(spread(stiffen(talk, 0.5, { armR: 1 }), "armR")).toBeLessThan(base * 0.7);
    const rough = (t: Track) => t.poses.slice(2).reduce((s, p, i) => s + Math.abs(part(p, "armR", 0) - 2 * part(t.poses[i + 1]!, "armR", 0) + part(t.poses[i]!, "armR", 0)), 0);
    expect(rough(smooth(talk, 0.2))).toBeLessThan(rough(talk) * 0.6);
    // past a stop, the overshoot reaches beyond where the part stops
    const o = overshoot(talk, 0.5, { armR: 1 }), lo = (t: Track) => Math.min(...t.poses.map((p) => part(p, "armR", 0))), hi = (t: Track) => Math.max(...t.poses.map((p) => part(p, "armR", 0)));
    expect(hi(o) - lo(o)).toBeGreaterThan(hi(talk) - lo(talk));
  });
  it("events and contacts: added, sorted, within the track", () => {
    const jab = track("MESH2MOTION/Punch_Jab"), e = addEvents(jab, [{ t: 0.5, name: "hit" }, { t: 0.1, name: "wind" }]), c = addContacts(jab, { handL: [[0.1, 0.3]] });
    expect(e.events.filter((x) => ["hit", "wind"].includes(x.name)).map((x) => x.name)).toEqual(["wind", "hit"]);
    expect(c.contacts!.handL).toEqual([[0.1, 0.3]]);
    expect(rootAt(e, 0.5)).toEqual(rootAt(jab, 0.5));
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

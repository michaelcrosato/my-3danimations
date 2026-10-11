// Tests for the codec's format-2 parts (WP-1.3): the canonical file, slugs, reading format 1, the key lens, and the
// new optional fields (hand, fingers, spine, yaw) in decode, encode, sampling and mirroring. Format 1's behaviour is
// proved against the oracle by spec/conformance/tier1a and tier2.
import { describe, expect, it } from "vitest";
import { decodePose, encodePose, fit, fromFormat1, IDX, keyAt, keyLens, mirror, parseClip, serialize, slug, slugs, validate, type Capture, type Clip, type KeyLike, type Rest } from "../src/index.ts";
import { loadTier1a, loadTier2 } from "../../../spec/conformance/runner/vectors.ts";
import { baseClip } from "./fixtures.ts";

const ual = loadTier2("QUATERNIUS");
const R = ual.bodies.UAL1 as unknown as Rest;
const walk = ual.clips.Walk_Loop!.clip;
const key0 = walk.keys[0] as KeyLike;
const point = (X: ArrayLike<number>, n: string) => [X[IDX[n]! * 3]!, X[IDX[n]! * 3 + 1]!, X[IDX[n]! * 3 + 2]!];
const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const decode = (k: KeyLike) => decodePose(R, k, new Array(108).fill(0)) as number[];

describe("the canonical clip file", () => {
  it("round-trips, is stable, puts each key on three short lines and passes the validator", () => {
    const c = baseClip() as Clip;
    const text = serialize(c);
    expect(serialize(parseClip(text))).toBe(text);
    expect(parseClip(text)).toEqual(c);
    expect(text.split("\n").filter((l) => l.startsWith('  {"t":'))).toHaveLength(c.keys.length);
    expect(text.endsWith("]}\n")).toBe(true);
    expect(validate(parseClip(text), { mode: "lint" }).ok).toBe(true);
  });
  it("writes fields in the spec's order whatever order they came in, and -0 as 0", () => {
    const c = baseClip();
    const shuffled = Object.fromEntries(Object.entries(c).reverse()) as Clip;
    shuffled.keys[0]!.armL[4] = -0;
    shuffled.provenance = Object.fromEntries(Object.entries(c.provenance).reverse()) as unknown as Clip["provenance"];
    const text = serialize(shuffled);
    expect(text.indexOf('"format"')).toBeLessThan(text.indexOf('"id"'));
    expect(text).toContain('"provenance": {"src":"UAL1","method":"captured"');
    expect(text).not.toContain("-0,");
    expect(text).toBe(serialize({ ...c, keys: shuffled.keys } as Clip));
  });
  it("slugs names and keeps them unique in a set", () => {
    expect(slug("Dance Charleston")).toBe("Dance_Charleston");
    expect(slug("  Jump (high)! ")).toBe("Jump_high");
    expect(slugs(["Walk Loop", "Walk_Loop", "walk-loop"])).toEqual(["Walk_Loop", "Walk_Loop_2", "walk-loop"]);
  });
  it("reads a format-1 clip as format 2 that validates", () => {
    const c = fromFormat1({ clip: "Walk_Loop", src: "UAL1", dur: walk.dur, loop: true, tags: ["walk"], desc: "relaxed walk", speed: 0, keys: walk.keys as KeyLike[] }, { set: "QUATERNIUS_3D2DGE", slug: "Walk_Loop", name: "Walk_Loop", fps: 30, restSrc: "UAL1", license: "CC0-1.0", fit: [12, 40], producer: { tool: "m3a-migrate", version: "0.4.0" }, qaVersion: "0" });
    expect(validate(c, { mode: "lint" }).errors).toEqual([]);
    expect(c.id).toBe("QUATERNIUS_3D2DGE/Walk_Loop");
    expect(c.facts).toEqual({ by: "m3a-migrate@0.4.0", speed: 0 });
    expect(Object.keys(c.keys[0]!)[0]).toBe("t");
  });
  it("shows a clip through the key lens: a header line and three lines per key", () => {
    const lens = keyLens({ ...(baseClip() as Clip), keys: [{ ...key0, handL: [10, 0, 0], yaw: 5 }] } as never);
    expect(lens.split("\n")).toHaveLength(6);
    expect(lens).toContain('"yaw":5');
    expect(lens).toContain('"handL":[10,0,0]');
  });
});

describe("format 2's optional fields", () => {
  it("a straight hand ([0, 0, 0]) places the elbow, wrist, knuckle and fist as format 1 does", () => {
    const a = decode(key0);
    const b = decode({ ...key0, handL: [0, 0, 0], handR: [0, 0, 0] });
    for (const n of ["elbowL", "wristL", "knuckL", "fistL", "elbowR", "wristR", "knuckR", "fistR"]) expect(dist(point(a, n), point(b, n)), n).toBeLessThan(1e-6);
  });
  it("a bent wrist moves only the hand, by the angle asked", () => {
    const a = decode({ ...key0, handR: [0, 0, 0] });
    const b = decode({ ...key0, handR: [60, 0, 0] });
    for (const n of ["elbowR", "wristR", "shR", "fistL"]) expect(dist(point(a, n), point(b, n)), n).toBeLessThan(1e-6);
    const w = point(a, "wristR");
    const ha = point(a, "knuckR").map((v, i) => v - w[i]!);
    const hb = point(b, "knuckR").map((v, i) => v - w[i]!);
    const ang = (Math.acos((ha[0]! * hb[0]! + ha[1]! * hb[1]! + ha[2]! * hb[2]!) / (Math.hypot(...ha) * Math.hypot(...hb))) * 180) / Math.PI;
    expect(ang).toBeCloseTo(60, 6);
  });
  it("hand and finger fields encode back from the points they decode to", () => {
    const k = { ...key0, handL: [30, -10, 60], handR: [-20, 15, -40], fingersL: [70, 70, 70, 70, 70], fingersR: [40, 40, 40, 40, 40] };
    const X = new Float32Array(decode(k));
    const e = encodePose(R, X, null, { hands: true });
    for (const f of ["handL", "handR", "fingersL", "fingersR"]) {
      const want = k[f as keyof typeof k] as number[];
      (e[f] as number[]).forEach((v, i) => expect(Math.abs(v - want[i]!), `${f}[${i}]`).toBeLessThanOrEqual(1));
    }
    for (const f of ["armL", "armR", "legL", "legR", "body", "chest"]) (e[f] as number[]).forEach((v, i) => expect(Math.abs(v - (key0[f] as number[])[i]!), `${f}[${i}]`).toBeLessThanOrEqual(1));
  });
  it("spine shares equal to the rest's decode the same; others curl the spine and keep the chest's turn", () => {
    const shares = R.spineW.slice(0, 3).map((w) => Math.round(w * 100));
    const a = decode(key0);
    expect(dist(point(a, "chest"), point(decode({ ...key0, spine: shares }), "chest"))).toBeLessThan(1e-9);
    const curled = decode({ ...key0, spine: [33, 66, 100] });
    expect(dist(point(a, "spine2"), point(curled, "spine2"))).toBeGreaterThan(5);
    expect(dist(point(a, "pelvis"), point(curled, "pelvis"))).toBe(0);
  });
  it("in-betweens yaw and mirrors it with the hands, fingers and contacts", () => {
    const clip = { dur: 1, loop: false, keys: [{ ...key0, t: 0, yaw: 0, handL: [10, 0, 0] }, { ...key0, t: 1, yaw: 90, handL: [30, 0, 0] }] as KeyLike[] };
    expect(keyAt(clip, 0.5).yaw).toBe(45);
    expect(keyAt(clip, 0.5).handL).toEqual([20, 0, 0]);
    const m = mirror({ ...clip, name: "Turn", contacts: { by: "detected", footL: [[0, 0.5]] }, events: [{ t: 0.2, name: "step", side: "L" }] });
    expect(m.keys[1]!.yaw).toBe(-90);
    expect(m.keys[1]!.handR).toEqual([30, 0, 0]);
    expect(m.keys[1]!.handL).toBeUndefined();
    expect(m.contacts).toEqual({ by: "detected", footR: [[0, 0.5]] });
    expect(m.events).toEqual([{ t: 0.2, name: "step", side: "R" }]);
    expect(m.name).toBe("Turn_Mirror");
  });
});

describe("fit with a budget per region", () => {
  it("keeps more keys for a tighter arms budget, and stays within the format's reach", () => {
    const v = loadTier1a("rig");
    const c = v.clips.Wave_Loop!.capture;
    const cap: Capture = { name: c.name, n: c.n, dur: c.dur, loop: c.loop, fps: c.fps, data: Float32Array.from(c.data.flat()), move: null };
    const rest = v.rest as unknown as Rest;
    const loose = fit(rest, cap, { torso: 30, arms: 30, legs: 30 });
    const tight = fit(rest, cap, { torso: 30, arms: 5, legs: 30 });
    expect(tight.clip.keys.length).toBeGreaterThan(loose.clip.keys.length);
    for (const r of [loose, tight]) expect(Number.isFinite(r.max) && r.mean <= r.max).toBe(true);
  });
});

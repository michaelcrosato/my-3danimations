// Pose operations (WP-2.3), as property tests: mirroring twice is the identity on every migrated clip; a blend at 0 or
// 1 gives its inputs; additive deltas undo; masks feather; retiming keeps event order and contact proportions; slices
// and loops keep their motion; and synced walk–run blends keep planted feet within 20 mm of the floor.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addDelta, blend, decodePose, delta, ease, endLow, keyAt, loopify, mask, measureFacts, mirror, mirrorPose, parseClip, phaseMap, retime, slice, syncBlend,
  type Clip, type KeyLike, type Lensed, type Pose, type Rest,
} from "../src/index.ts";

const LIB = join(import.meta.dirname, "../../../library/sets");
function libClip(id: string): { clip: Clip; R: Rest } {
  const [set, name] = id.split("/");
  const manifest = JSON.parse(readFileSync(join(LIB, set!, "_set.json"), "utf8"));
  const clip = parseClip(readFileSync(join(LIB, set!, `${name}.json`), "utf8"));
  return { clip, R: manifest.sources[clip.restSrc].rest as Rest };
}
const decode = (R: Rest, k: KeyLike) => decodePose(R, k, new Float32Array(108)) as Float32Array;
const worstDiff = (a: Float32Array, b: Float32Array) => a.reduce((w, x, i) => Math.max(w, Math.abs(x - b[i]!)), 0);
const mod360 = (x: number) => ((x % 360) + 360) % 360;

describe("mirror", () => {
  it("twice is the identity on every migrated clip: the same numbers, and poses within 0.5 mm", () => {
    let clips = 0, worst = 0;
    for (const set of readdirSync(LIB).sort()) {
      const manifest = JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8"));
      for (const f of readdirSync(join(LIB, set)).filter((x) => !x.startsWith("_") && x.endsWith(".json"))) {
        const clip = parseClip(readFileSync(join(LIB, set, f), "utf8"));
        const R = manifest.sources[clip.restSrc].rest as Rest;
        const twice = mirror(mirror(clip as unknown as Lensed)) as unknown as Clip;
        expect(twice.keys.length).toBe(clip.keys.length);
        for (const t of [0, clip.dur / 3, clip.dur * 0.71]) worst = Math.max(worst, worstDiff(decode(R, keyAt(twice, t)), decode(R, keyAt(clip, t))));
        expect(mirrorPose(mirrorPose(clip.keys[0]! as unknown as Pose))).toMatchObject({ hips: clip.keys[0]!.hips, body: clip.keys[0]!.body });
        clips++;
      }
    }
    expect(clips).toBe(525);
    expect(worst).toBeLessThanOrEqual(0.5);
  });
  it("a mirrored pose decodes as the reflection across the body's midline", () => {
    const { clip, R } = libClip("QUATERNIUS_3D2DGE/Punch_Cross");
    const k = keyAt(clip, 0.3), a = decode(R, k), b = decode(R, mirrorPose(k));
    // pelvis and head stay on their side's reflection: right (index 1) changes sign
    for (const i of [0, 5]) {
      expect(b[i * 3]!).toBeCloseTo(a[i * 3]!, 0);
      expect(b[i * 3 + 1]!).toBeCloseTo(-a[i * 3 + 1]!, 0);
    }
  });
});

describe("blend, deltas and masks", () => {
  const { clip: walk, R } = libClip("QUATERNIUS_3D2DGE/Walk_Loop");
  const { clip: punch } = libClip("QUATERNIUS_3D2DGE/Punch_Cross");
  const a = keyAt(walk, 0.4), b = keyAt(punch, 0.3);
  it("a blend at 0 or 1 gives its inputs: the same pose, the same numbers up to whole turns", () => {
    for (const [w, want] of [[0, a], [1, b]] as const) {
      const got = blend(a, b, w);
      expect(worstDiff(decode(R, got), decode(R, want))).toBeLessThan(1e-3);
      for (const f of ["hips", "body", "chest", "head", "armL", "armR", "legL", "legR"]) {
        (got[f] as number[]).forEach((x, i) => expect(mod360(x), `${f}[${i}]`).toBeCloseTo(mod360((want[f] as number[])[i] ?? 0), 9));
      }
    }
  });
  it("blends angles the short way round", () => {
    const p = { ...a, body: [350, 0, 0] }, q = { ...a, body: [-10, 0, 0] };
    expect((blend(p, q, 0.5).body as number[])[0]).toBe(350);
    expect((blend({ ...a, body: [170, 0, 0] }, { ...a, body: [-170, 0, 0] }, 0.5).body as number[])[0]).toBe(180);
  });
  it("an additive delta undoes: base + (pose − base) is the pose", () => {
    const d = delta(b, a), back = addDelta(a, d);
    expect(worstDiff(decode(R, back), decode(R, b))).toBeLessThan(1e-3);
    // at half weight it moves halfway, angle by angle
    expect((addDelta(a, d, 0.5).hips as number[])[2]).toBeCloseTo(((a.hips as number[])[2]! + (b.hips as number[])[2]!) / 2, 9);
  });
  it("masks by group, with feathering, and a masked blend leaves the rest alone", () => {
    expect(mask("armL")).toEqual({ shL: 1, armL: 1, handL: 1, fingersL: 1 });
    const upper = mask("upper", 0.5);
    expect([upper.chest, upper.armR, upper.body, upper.hips, upper.legL]).toEqual([1, 1, 0.5, 0.25, 0.25]);
    expect(mask(["legs", "head"])).toMatchObject({ legL: 1, footR: 1, head: 1 });
    expect(() => mask("tail")).toThrow(/no body group "tail"/);
    const m = blend(a, b, 1, mask("armR"));
    expect(m.armR).toEqual(b.armR);
    expect(m.legL).toEqual(a.legL);
    expect(m.armL).toEqual(a.armL);
  });
});

describe("retime, slice and loop", () => {
  const { clip: walk0, R } = libClip("QUATERNIUS_3D2DGE/Walk_Loop");
  const walk: Clip = { ...walk0, contacts: measureFacts(walk0, R).contacts, events: [{ t: 0.2, name: "step", side: "L" }, { t: 0.9, name: "step", side: "R" }, { t: 1.2, name: "breath" }] };
  const share = (c: Clip) => (c.contacts!.footL ?? []).reduce((s, [x, y]) => s + y - x, 0) / c.dur;
  it("keeps the event order and the contact proportions, by speed and to a duration", () => {
    for (const how of [{ speed: 2 }, { speed: 0.5 }, { dur: 3 }]) {
      const r = retime(walk, how);
      expect(r.events!.map((e) => e.name + (e.side ?? ""))).toEqual(walk.events!.map((e) => e.name + (e.side ?? "")));
      expect(r.events!.map((e) => e.t)).toEqual([...r.events!.map((e) => e.t)].sort((x, y) => x - y));
      expect(share(r)).toBeCloseTo(share(walk), 2);
      expect(worstDiff(decode(R, keyAt(r, r.dur * 0.37)), decode(R, keyAt(walk, walk.dur * 0.37)))).toBeLessThan(5);
      expect(r.facts).toBeUndefined();
    }
    expect(retime(walk, { dur: 3 }).dur).toBe(3);
  });
  it("along an ease curve: order kept, ends fixed, and a curve that isn't increasing refused", () => {
    const r = retime(walk, { ease: ease.inOut });
    expect(r.dur).toBe(walk.dur);
    expect(r.events!.map((e) => e.name)).toEqual(walk.events!.map((e) => e.name));
    const ts = r.keys.map((k) => k.t);
    expect(ts).toEqual([...ts].sort((x, y) => x - y));
    expect([ts[0], ts[ts.length - 1]]).toEqual([0, walk.dur]);
    expect(() => retime(walk, { ease: ease.outBack })).toThrow(/must increase/);
  });
  it("slices a stretch, across a loop's seam too, starting its root again where it stands", () => {
    const s = slice(walk, 1, 2);
    expect([s.dur, s.loop, s.keys[0]!.t, s.keys[s.keys.length - 1]!.t]).toEqual([1, false, 0, 1]);
    expect(worstDiff(decode(R, keyAt(s, 0.5)), decode(R, keyAt(walk, 1.5)))).toBeLessThan(10);
    expect(s.events!.map((e) => e.t)).toEqual([0.2, 0.533]);
    const { clip: roll } = libClip("QUATERNIUS_3D2DGE/Roll_RM");
    const rs = slice(roll, 0.5, 1.2);
    expect(rs.keys[0]!.root).toEqual([0, 0]);
    expect(() => slice(roll, 1, 2)).toThrow(/isn't within the clip/);
  });
  it("loopify closes a one-shot's seam: the last key is the first pose", () => {
    const { clip: idle, R: Ri } = libClip("QUATERNIUS_3D2DGE/Idle_Loop");
    const open = slice(idle, 0.2, 1.9);
    const before = measureFacts({ ...open, loop: true }, Ri).seam!;
    const closed = loopify(open, 0.5);
    expect(closed.loop).toBe(true);
    expect(before).toBeGreaterThan(10);
    expect(measureFacts(closed, Ri).seam!).toBeLessThan(1);
  });
});

describe("synced walk–run blends", () => {
  /** The worst height of a foot both inputs plant (within 20 mm of the floor at the same phase), over the blend. */
  function plantedHeight(idA: string, idB: string, shiftB = 0): { synced: number; byTime: number } {
    const A = libClip(idA), B0 = libClip(idB);
    const fb0 = measureFacts(B0.clip, B0.R);
    // the run started half a stride on: synced blends don't care; blending by time puts its feet out of step
    const B = shiftB ? { ...B0.clip, ...slice({ ...B0.clip, contacts: fb0.contacts }, shiftB * B0.clip.dur, (1 + shiftB) * B0.clip.dur), loop: true } : { ...B0.clip, contacts: fb0.contacts };
    const ma = phaseMap(A.clip, measureFacts(A.clip, A.R).contacts), mb = phaseMap(B, B.contacts);
    const byTime = (c: { dur: number }) => ({ dur: c.dur, phase: (t: number) => t / c.dur, time: (p: number) => p * c.dur });
    const out = { synced: 0, byTime: 0 };
    for (const [label, MA, MB] of [["synced", ma, mb], ["byTime", byTime(A.clip), byTime(B)]] as const) {
      for (const w of [0.25, 0.5, 0.75]) {
        const sb = syncBlend(A.clip, MA, B, MB, w, { rest: A.R });
        for (let i = 0; i < 200; i++) {
          const p = i / 200, o = decode(A.R, sb.at(p));
          // planted in the synced reading of both inputs: the phases the blend must keep on the floor
          const sa = decode(A.R, keyAt(A.clip, ma.time(p))), sbp = decode(A.R, keyAt(B, mb.time(p)));
          for (const end of ["footL", "footR"] as const) {
            if (Math.abs(endLow(sa, end)) > 20 || Math.abs(endLow(sbp, end)) > 20) continue;
            out[label] = Math.max(out[label], Math.abs(endLow(o, end)));
          }
        }
      }
    }
    return out;
  }
  for (const [a, b] of [["QUATERNIUS_3D2DGE/Walk_Loop", "QUATERNIUS_3D2DGE/Jog_Fwd_Loop"], ["QUATERNIUS_3D2DGE/Walk_Loop", "QUATERNIUS_3D2DGE/Sprint_Loop"], ["QUATERNIUS_SHARDFALL/Walk_Loop", "QUATERNIUS_SHARDFALL/Jog_Fwd_Loop"]]) {
    it(`${a.split("/")[1]} with ${b.split("/")[1]}: planted feet stay within 20 mm of the floor`, () => {
      expect(plantedHeight(a!, b!).synced).toBeLessThanOrEqual(20);
    });
  }
  it("and in step even when the run starts half a stride on, where blending by time lifts the feet", () => {
    const r = plantedHeight("QUATERNIUS_3D2DGE/Walk_Loop", "QUATERNIUS_3D2DGE/Jog_Fwd_Loop", 0.5);
    expect(r.synced).toBeLessThanOrEqual(20);
    expect(r.byTime).toBeGreaterThan(100);
  });
  it("lasts lerp(durA, durB, w)", () => {
    const A = libClip("QUATERNIUS_3D2DGE/Walk_Loop"), B = libClip("QUATERNIUS_3D2DGE/Jog_Fwd_Loop");
    const sb = syncBlend(A.clip, phaseMap(A.clip), B.clip, phaseMap(B.clip), 0.25);
    expect(sb.dur).toBeCloseTo(A.clip.dur + (B.clip.dur - A.clip.dur) * 0.25, 12);
  });
});

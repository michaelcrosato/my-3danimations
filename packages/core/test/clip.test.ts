// The clip runtime (WP-2.2): sample() decodes like the tier 2 vectors; events fire once each, in order, loop-aware;
// a turning root samples continuously and composes over loop cycles; contacts wrap; and measureFacts agrees with the
// 20 clips of packages/core/fixtures/facts-truth.json, whose expectations come from sources independent of this code.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contactsAt, events, keyAt, measureFacts, parseClip, rootAt, rootDelta, sample, type Clip, type ClipEvent, type Key, type Rest } from "./all.ts";
import { loadTier2, tier2Sets } from "../../../spec/conformance/runner/vectors.ts";

const LIB = join(import.meta.dirname, "../../../library/sets");
/** A library clip and the rest it decodes on. */
function libClip(id: string): { clip: Clip; R: Rest } {
  const [set, name] = id.split("/");
  const manifest = JSON.parse(readFileSync(join(LIB, set!, "_set.json"), "utf8"));
  const clip = parseClip(readFileSync(join(LIB, set!, `${name}.json`), "utf8"));
  return { clip, R: manifest.sources[clip.restSrc].rest as Rest };
}
/** A minimal key: standing, with extra fields. */
const key = (t: number, extra: Record<string, unknown> = {}): Key =>
  ({ t, hips: [0, 0, 100], body: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, -100, 0, 0], armR: [0, 0, -100, 0, 0], legL: [0, 0, -100, 0, 0], legR: [0, 0, -100, 0, 0], ...extra }) as Key;

describe("sample", () => {
  it("decodes like the tier 2 vectors: exactly (to the µm they store) at keys, within 0.001 mm between", () => {
    const out = new Float32Array(108);
    let n = 0;
    for (const set of tier2Sets()) {
      const v = loadTier2(set);
      for (const c of Object.values(v.clips)) {
        const R = v.bodies[c.restSrc] as unknown as Rest;
        for (const [list, exact] of [[c.keys, true], [c.between, false]] as const) {
          for (const s of list) {
            sample(c.clip as never, s.t, R, out);
            for (let i = 0; i < 108; i++) {
              const d = Math.abs(out[i]! * 1000 - s.at[i]!);
              if (exact ? Math.round(out[i]! * 1000) !== s.at[i] : !(d <= 1)) throw new Error(`${set} t ${s.t} [${i}]: ${out[i]} mm vs ${s.at[i]! / 1000}`);
            }
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(7000);
  });
  it("wraps a loop, holds a one-shot's ends, and interpolates every number linearly", () => {
    const clip = { dur: 1, loop: true, keys: [key(0, { hips: [0, 0, 100] }), key(1, { hips: [0, 0, 80] })] };
    expect(keyAt(clip, 0.25).hips).toEqual([0, 0, 95]);
    expect(keyAt(clip, 1.25).hips).toEqual([0, 0, 95]);
    expect(keyAt({ ...clip, loop: false }, 7).hips).toEqual([0, 0, 80]);
    expect(keyAt({ ...clip, loop: false }, -1).hips).toEqual([0, 0, 100]);
  });
});

describe("root motion", () => {
  const turning = (deg: number, travel = 0) => ({ dur: 2, loop: true, keys: [key(0, { yaw: 0, root: [0, 0] }), key(1, { yaw: deg / 2, root: [travel / 2, 0] }), key(2, { yaw: deg, root: [travel, 0] })] });
  for (const deg of [90, 360, 720]) {
    it(`a yaw turning through ${deg}° samples with no jump at ±180°`, () => {
      const c = turning(deg);
      let last = keyAt(c, 0).yaw as number, worst = 0;
      for (let t = 0.001; t < 2; t += 0.001) {
        const y = keyAt(c, t).yaw as number;
        worst = Math.max(worst, Math.abs(y - last));
        last = y;
      }
      expect(worst).toBeLessThan((deg / 2) * 0.0011);
      expect(rootAt(c, 2).yaw).toBe(deg);
    });
  }
  it("rootDelta across a loop's seam carries the cycle's turn and travel on", () => {
    const c = turning(90, 100);
    const d = rootDelta(c, 1.8, 2.2);
    expect(d.yaw).toBeCloseTo(18, 9); // 0.2 s of the end of a cycle and 0.2 s of the next, 45°/s
    // four cycles of "forward 100 while turning right 90°" come back to the start, facing ahead again (turned 360°)
    const four = rootAt(c, 8);
    expect([four.forward, four.right, four.yaw].map((x) => Math.round(x * 1e6) / 1e6 + 0)).toEqual([0, 0, 360]);
    expect(rootDelta(c, 0, 8).yaw).toBe(360);
    // backwards in time is the inverse
    const back = rootDelta(c, 2.2, 1.8);
    expect(back.yaw).toBeCloseTo(-18, 9);
    // a one-shot holds: nothing moves past its end
    expect(rootDelta({ ...c, loop: false }, 2, 5)).toEqual({ forward: 0, right: 0, yaw: 0 });
  });
  it("a straight clip's travel is its root, in the start frame", () => {
    const c = { dur: 1, loop: false, keys: [key(0, { root: [10, -4] }), key(1, { root: [60, 6] })] };
    expect(rootAt(c, 1)).toEqual({ forward: 50, right: 10, yaw: 0 });
    expect(rootDelta(c, 0.5, 1)).toEqual({ forward: 25, right: 5, yaw: 0 });
  });
});

describe("events", () => {
  const ev = (t: number, name: string): ClipEvent => ({ t, name });
  const loop = { dur: 1, loop: true, keys: [key(0), key(1)], events: [ev(0, "start"), ev(0.5, "step"), ev(1, "end")] };
  it("an event on a loop's boundary fires once per cycle, and windows that meet fire each occurrence once", () => {
    const steps: string[] = [];
    for (let i = 0; i < 40; i++) for (const f of events(loop, i * 0.1, (i + 1) * 0.1)) steps.push(`${f.event.name}@${f.t.toFixed(1)}`);
    // "start" (t 0) and "end" (t = dur) are the same moment of a loop: each fires at 0, 1, 2 and 3
    expect(steps.filter((s) => s.startsWith("start"))).toEqual(["start@0.0", "start@1.0", "start@2.0", "start@3.0"]);
    expect(steps.filter((s) => s.startsWith("end"))).toEqual(["end@0.0", "end@1.0", "end@2.0", "end@3.0"]);
    expect(steps.filter((s) => s.startsWith("step")).length).toBe(4);
    expect(events(loop, 0.4, 2.6).map((f) => `${f.event.name}@${f.t}`)).toEqual(["step@0.5", "start@1", "end@1", "step@1.5", "start@2", "end@2", "step@2.5"]);
  });
  it("plays backwards newest first, fires a one-shot's end once the playhead passes it, and nothing outside", () => {
    expect(events(loop, 1.6, 0.4).map((f) => `${f.event.name}@${f.t}`)).toEqual(["step@1.5", "start@1", "end@1", "step@0.5"]);
    const once = { ...loop, loop: false };
    expect(events(once, 0.9, 1).map((f) => f.event.name)).toEqual([]);
    expect(events(once, 1, 1.1).map((f) => f.event.name)).toEqual(["end"]);
    expect(events(once, 1.1, 5)).toEqual([]);
    expect(events({ ...once, events: undefined }, 0, 1)).toEqual([]);
  });
});

describe("contacts", () => {
  it("reads labelled intervals, a loop's wrapping one included", () => {
    const clip = { dur: 1, loop: true, keys: [key(0), key(1)], contacts: { by: "labelled" as const, footL: [[0.1, 0.4]] as [number, number][], footR: [[0.6, 1.2]] as [number, number][] } };
    expect(contactsAt(clip, 0.3)).toEqual({ footL: true, footR: false, handL: false, handR: false });
    expect(contactsAt(clip, 0.05)).toMatchObject({ footL: false, footR: true });
    expect(contactsAt(clip, 1.15)).toMatchObject({ footL: true, footR: true });
    expect(contactsAt({ ...clip, contacts: undefined }, 0.2)).toEqual({ footL: false, footR: false, handL: false, handR: false });
  });
  it("detects a walk's alternating feet with hysteresis, each foot planted once a cycle", () => {
    const { clip, R } = libClip("QUATERNIUS_3D2DGE/Walk_Loop");
    const c = measureFacts(clip, R).contacts;
    expect(c.by).toBe("detected");
    expect([c.footL?.length, c.footR?.length, c.handL, c.handR]).toEqual([1, 1, undefined, undefined]);
    for (const [a, b] of [...c.footL!, ...c.footR!]) expect(b - a).toBeGreaterThan(0.4 * clip.dur);
  });
});

describe("measureFacts against facts-truth.json", () => {
  const truth = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/facts-truth.json"), "utf8")) as { clips: { id: string; expect: { speed?: number; distance?: number; strike?: number; loop?: boolean }; source: string }[] };
  it("holds 20 clips, each with a cited source", () => {
    expect(truth.clips.length).toBe(20);
    for (const c of truth.clips) expect(c.source).toMatch(/@[0-9a-f]{7}/);
  });
  for (const t of truth.clips) {
    it(`${t.id}: ${Object.keys(t.expect).join(", ")}`, () => {
      const { clip, R } = libClip(t.id);
      const f = measureFacts(clip, R);
      const e = t.expect;
      if (e.speed !== undefined) expect(Math.abs(f.speed! / e.speed - 1), `speed ${f.speed} vs ${e.speed}`).toBeLessThanOrEqual(0.15);
      if (e.distance !== undefined) {
        const d = Math.hypot(...f.travel!);
        expect(Math.abs(d - e.distance), `distance ${d} vs ${e.distance}`).toBeLessThanOrEqual(Math.max(0.02 * e.distance, 1));
      }
      if (e.strike !== undefined) expect(Math.abs(f.strike![0]! - e.strike), `strike ${f.strike} vs ${e.strike}`).toBeLessThanOrEqual(0.08);
      if (e.loop !== undefined) {
        expect(clip.loop).toBe(e.loop);
        if (e.loop) expect(f.seam).toBeLessThanOrEqual(40);
      }
    });
  }
  it("measures height from the keys and names its tool", () => {
    const { clip, R } = libClip("QUATERNIUS_3D2DGE/Crouch_Idle_Loop");
    const f = measureFacts(clip, R);
    expect(f.height[1]).toBeLessThan(90);
    expect(f.by).toMatch(/^m3a-core@\d+\.\d+\.\d+$/);
    expect(readdirSync(LIB).length).toBe(5);
  });
});

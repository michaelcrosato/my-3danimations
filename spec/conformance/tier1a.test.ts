// Conformance tier 1a (spec/conformance/tiers.md): from the oracle's captured body points, @m3a/core's codec reduces,
// fits and writes text bit for bit like my-3d2dge's readable.js, for the tiny rig and the CMU take.
import { format, type Rest } from "@m3a/core";
import { describe, expect, it } from "vitest";
import { firstDiff, loadTier1a, type Tier1aClip } from "./runner/vectors.ts";

const { fit, reduce, text1 } = format;
type Capture = format.Capture;

/** A tier-1a capture as the codec takes it (float32 frames, as the origin stores them). */
function capture(c: Tier1aClip["capture"]): Capture {
  return { name: c.name, n: c.n, dur: c.dur, loop: c.loop, fps: c.fps, data: Float32Array.from(c.data.flat()), move: c.move ? Float32Array.from(c.move) : null, ...(c.take ? { take: c.take } : {}) };
}

for (const name of ["rig", "cmu-09_02"] as const) {
  describe(`tier 1a: ${name}`, () => {
    const v = loadTier1a(name);
    const R = v.rest as unknown as Rest;
    for (const [clipName, c] of Object.entries(v.clips)) {
      if (!c.fit) continue;
      it(`${clipName}: reduce, fit and text match the oracle bit for bit`, () => {
        const cap = capture(c.capture);
        expect(reduce(cap, v.tol)).toEqual(c.reduce);
        const r = fit(R, cap, v.tol, c.extra ?? {});
        expect(Object.is(r.max, c.fit!.max) && Object.is(r.mean, c.fit!.mean), `max ${r.max} vs ${c.fit!.max}, mean ${r.mean} vs ${c.fit!.mean}`).toBe(true);
        const want = c.fit!.clip;
        expect({ clip: r.clip.clip, dur: r.clip.dur, loop: r.clip.loop, tags: r.clip.tags, desc: r.clip.desc }).toEqual({ clip: want.clip, dur: want.dur, loop: want.loop, tags: want.tags, desc: want.desc });
        expect(r.clip.keys.length).toBe(want.keys.length);
        r.clip.keys.forEach((k, i) => {
          const w = want.keys[i]!;
          expect(Object.keys(k).sort(), `key ${i + 1}`).toEqual(Object.keys(w).sort());
          for (const f of Object.keys(w)) {
            const d = firstDiff(([] as number[]).concat(k[f] as number | number[]), ([] as number[]).concat(w[f] as number | number[]));
            expect(d, `key ${i + 1} ${f}`).toBeNull();
          }
        });
        expect(text1(r.clip as never)).toBe(c.text);
      });
    }
  });
}

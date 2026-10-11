// Conformance tier 2 (spec/conformance/tiers.md): every curated clip decodes on its reference body within 0.001 mm of
// the oracle at each key and at three in-betweens; mirroring and the format-1 text lens match it exactly.
import { format, type Rest } from "@m3a/core";
import { describe, expect, it } from "vitest";
import { stringify } from "./runner/json.ts";
import { loadTier2, sha256, TOLERANCE, tier2Sets } from "./runner/vectors.ts";

const { keyLens, mirror, parse1, pose, text1 } = format;
type KeyLike = format.KeyLike;
type Lensed = format.Lensed;

const sorted = (o: Record<string, unknown>) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const noZeroSign = (keys: KeyLike[]) => JSON.stringify(keys.map(sorted), (_k, v) => (v === 0 ? 0 : v));
const filled = (keys: KeyLike[]) =>
  keys.map((k) => {
    const o = { ...k };
    for (const f of ["armL", "armR", "legL", "legR"]) {
      const v = o[f] as number[] | undefined;
      if (v) o[f] = [v[0]!, v[1]!, v[2]!, v[3] || 0, v[4] || 0];
    }
    return o;
  });

for (const set of tier2Sets()) {
  describe(`tier 2: ${set}`, () => {
    const v = loadTier2(set);
    it(`decodes every clip within ${TOLERANCE.tier2mm} mm at every key and in-between`, () => {
      const out = new Float32Array(108);
      let points = 0;
      let exact = 0;
      let worst = 0;
      for (const [name, c] of Object.entries(v.clips)) {
        const R = v.bodies[c.restSrc] as unknown as Rest;
        for (const s of [...c.keys, ...c.between]) {
          pose(R, c.clip as never, s.t, out);
          for (let i = 0; i < 108; i++) {
            const d = Math.abs(out[i]! * 1000 - s.at[i]!);
            worst = Math.max(worst, d);
            if (Math.round(out[i]! * 1000) === s.at[i]) exact++;
            if (!(d <= TOLERANCE.tier2mm * 1000)) throw new Error(`${set}/${name} at t ${s.t}: point ${Math.floor(i / 3)} axis ${i % 3} is ${out[i]} mm, want ${s.at[i]! / 1000}`);
          }
          points += 108;
        }
      }
      expect(exact, `worst ${worst} µm`).toBe(points);
    });
    it("mirrors and writes text exactly like the oracle", () => {
      for (const [name, c] of Object.entries(v.clips)) {
        const clip = c.clip as unknown as Lensed;
        const format2 = (v as { format?: string }).format === "2.0";
        const text = format2 ? keyLens(clip) : text1(clip);
        expect(sha256(text), `${name} text`).toBe(c.textSha256);
        const back = format2 ? (JSON.parse(text) as Lensed).keys : parse1(text).keys;
        expect(noZeroSign(back), `${name} text round trip`).toBe(noZeroSign(clip.keys));
        const m = mirror(clip);
        expect(sha256(stringify(m.keys)), `${name} mirror`).toBe(c.mirrorSha256);
        expect(noZeroSign(mirror(m).keys), `${name} mirror twice`).toBe(noZeroSign(filled(clip.keys)));
      }
    });
  });
}

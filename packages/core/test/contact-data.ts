// The contact tests' helpers (Node only: they read the library): a clip as planting reads it, the worst slide of its
// planted feet, and every locomotion loop's worst slide, planted and free, over the sets a test names. Shared by
// contact.test.ts and contact-gaits, contact-sidesteps and contact-siderun.test.ts, which split the library's
// locomotion loops between them so they run side by side. T1 reads every third loop; T2 (`npm run e2e`) reads them all
// (M3A_FULL=1), so T1 stays within its budget (D74).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { contactRoot, decodePose, IDX, keyAt, measureFacts, parseClip, plant, toWorld, type Clip, type Contacts, type Motion, type Playable, type Rest } from "./all.ts";

/** A library clip: its id (`SET/name`), the clip and its rest. */
export interface LibClip {
  id: string;
  clip: Clip;
  R: Rest;
}
const LIB = join(import.meta.dirname, "../../../library/sets");
export const P = (X: ArrayLike<number>, n: string): [number, number, number] => [X[IDX[n]! * 3]!, X[IDX[n]! * 3 + 1]!, X[IDX[n]! * 3 + 2]!];
/** A clip as planting reads it: decoded on its rest (cached by time), its root the one its planted feet imply. */
export function motionOf(clip: Playable, R: Rest, contacts: Contacts): Motion & { speed: number } {
  const cr = contactRoot(clip, R, contacts), memo = new Map<number, Float64Array>();
  return {
    rest: R, dur: clip.dur, loop: clip.loop, contacts, key: (t) => keyAt(clip, t), root: cr.root, speed: cr.speed,
    points: (t) => {
      let X = memo.get(t);
      if (!X) memo.set(t, (X = Float64Array.from(decodePose(R, keyAt(clip, t), new Array(108)))));
      return X;
    },
  };
}
/** The lowest sole point of foot s: heel (below the ankle), ball or toe. */
export const lowest = (X: ArrayLike<number>, s: string, R: Rest) => ["ankle", "ball", "toe"].map((p) => ({ p, z: P(X, p + s)[2] - (p === "ankle" ? R.ankleZ : 0) })).reduce((a, b) => (b.z < a.z ? b : a));
/** The worst slide per contact: the path the contact point (each step's lowest sole point) takes in the world. */
export function worstSlide(m: Motion, X: (t: number) => ArrayLike<number>, cycles = 2): number {
  let worst = 0;
  for (const s of ["L", "R"]) {
    for (const [a0, b0] of m.contacts[`foot${s}` as "footL"] ?? []) {
      for (let k = 0; k < cycles; k++) {
        const a = a0 + k * m.dur, b = b0 + k * m.dur;
        let len = 0;
        for (let t = a; t < b - 1e-9; t += 1 / 60) {
          const t1 = Math.min(b, t + 1 / 60), X0 = X(t), X1 = X(t1), low = lowest(X0, s, m.rest).p;
          const w0 = toWorld(m.root(t), P(X0, low + s)), w1 = toWorld(m.root(t1), P(X1, low + s));
          len += Math.hypot(w1[0] - w0[0], w1[1] - w0[1]);
        }
        worst = Math.max(worst, len);
      }
    }
  }
  return worst;
}
/** The library's clips, of the sets `keep` names (every set when none), each with its rest. */
export function library(keep: (set: string) => boolean = () => true): LibClip[] {
  const out: LibClip[] = [];
  for (const set of readdirSync(LIB).sort().filter(keep)) {
    const manifest = JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8"));
    for (const f of readdirSync(join(LIB, set)).filter((x) => !x.startsWith("_") && x.endsWith(".json")).sort()) {
      const clip = parseClip(readFileSync(join(LIB, set, f), "utf8"));
      out.push({ id: `${set}/${f.replace(/\.json$/, "")}`, clip, R: manifest.sources[clip.restSrc].rest as Rest });
    }
  }
  return out;
}

/** The library-wide sweeps in full (T2 sets M3A_FULL=1), or every SAMPLE-th clip (T1). */
export const FULL = process.env.M3A_FULL === "1", SAMPLE = FULL ? 1 : 3;

/**
 * Every looping walk, run or sidestep among `lib` that travels (a walk on the spot has nothing to slide against), or
 * every SAMPLE-th of them: how many, the worst slide of a planted foot (and the clip it's in), and the worst a foot
 * slides unplanted, over `cycles` of each loop (planting depends on the time alone, so a second cycle is the first
 * moved by the loop's travel: two check that, one is enough after).
 */
export function locomotionSlides(lib: readonly LibClip[], cycles = 2): { clips: number; worst: number; at: string; worstFree: number } {
  let clips = 0, worst = 0, worstFree = 0, at = "", seen = 0;
  for (const { id, clip, R } of lib) {
    if (!clip.loop || !clip.tags.some((t) => t === "walk" || t === "run" || t === "sidestep")) continue;
    if (seen++ % SAMPLE !== 0) continue;
    const m = motionOf(clip, R, measureFacts(clip, R).contacts);
    if (m.speed < 0.05 * R.H0) continue;
    const w = worstSlide(m, (t) => plant(m, t), cycles);
    if (worstFree <= 30) worstFree = Math.max(worstFree, worstSlide(m, m.points, cycles));
    if (w > worst) [worst, at] = [w, id];
    clips++;
  }
  return { clips, worst, at, worstFree };
}

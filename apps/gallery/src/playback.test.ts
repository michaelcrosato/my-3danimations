// The gallery plays a clip as its data says (WP-F.14): at 8 moments of each clip, the character the gallery's player
// poses and the stage places (player.ts's ClipPlayer through @m3a/three's attach, place.ts's placeCarrier with the
// player's turn) against the
// clip's own data (its keys decoded on its own body, on its root's path), compared where bodies of other proportions
// still agree: which way the body faces (its hips), which way it travels, and each limb's direction (the median over the
// moments). A clip's turn shown twice (the stage turning the character by a heading its pose already carried) set the
// facing up to 179° apart: the owner saw CMU_CURATED/Pick_Up_Basket spin round and walk backwards where its data turns
// half round and walks forward, and the sheets drew it right. T1 runs the clips that turn on gen-1 (the review page's);
// M3A_FULL=1 (T2) every clip on gen-1 and gen-0 (VRM's names, a T pose), about 45 s each (gen-2 and gen-7 pass as well).
import { join } from "node:path";
import { contact, format, playable, type Clip, type Rest } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { bind, type ThreeBound } from "@m3a/three";
import { character, loadGlb, variant } from "@m3a/three/test-characters";
import { Group, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { placeCarrier } from "./place.ts";
import { ClipPlayer } from "./player.ts";

const ROOT = join(import.meta.dirname, "../../.."), FULL = process.env.M3A_FULL === "1";
const lib = openLibrary({ dir: join(ROOT, "library/sets"), tiers: ["cc0", "cc-by", "cmu"], warn: () => undefined });

/** The bounds, from the library measured on gen-0, gen-1, gen-2 and gen-7 once the turn showed once (the worst in brackets). */
export const BOUNDS = {
  /** The hips' facing (degrees) apart at any moment (0). */
  facing: 5,
  /** Where the data has travelled over half its hip height from its start: the engine's travel's direction (degrees)
   *  apart (51; walking backwards is 180). Short of it a clip moved by its planted feet alone travels as each body's
   *  feet plant (a sword combo's lunges: 85° on gen-0), not a way to keep. */
  direction: 60,
  /** That travel, in hip heights. */
  travelled: 0.5,
  /** A clip's median limb direction (degrees) apart, over its moments and its 8 limbs (20). */
  limbs: 25,
} as const;
/** Clips the engine plays far from their data for a reason of their own, each with it (not the turn). */
export const KNOWN: Readonly<Record<string, string>> = {
  "QUATERNIUS_SHARDFALL/Swim_Idle_Loop": "treading water, its hips 36 to 47% of H0 under the floor (the water's surface): the engine's pose of a body under its floor is a follow-up of its own (WP-F.14); the gallery's floor hides it",
};

const DEG = Math.PI / 180, wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
/** The way a body faces, from its hips (left, right) in (forward, right): degrees, + toward the right. */
const facingOf = (L: readonly number[], R: readonly number[]) => Math.atan2(R[1]! - L[1]!, R[0]! - L[0]!) / DEG - 90;
/** Each limb: its humanoid bones (from, to) and the data's points. */
const LIMBS = [["leftUpperLeg", "leftLowerLeg", "hipL", "kneeL"], ["leftLowerLeg", "leftFoot", "kneeL", "ankleL"], ["rightUpperLeg", "rightLowerLeg", "hipR", "kneeR"], ["rightLowerLeg", "rightFoot", "kneeR", "ankleR"], ["leftUpperArm", "leftLowerArm", "shL", "elbowL"], ["leftLowerArm", "leftHand", "elbowL", "wristL"], ["rightUpperArm", "rightLowerArm", "shR", "elbowR"], ["rightLowerArm", "rightHand", "elbowR", "wristR"]] as const;

/** A test character bound and in a carrier, as the stage holds it. */
async function stage(seed: number): Promise<{ b: ThreeBound; carrier: Group }> {
  const b = bind((await loadGlb(character(variant(seed)).glb)).scene), carrier = new Group();
  carrier.add(b.root);
  return { b, carrier };
}

/** How a clip plays on a character against its data: the most its facing parts, the most its travel's direction parts
 *  (where the data has travelled), and its limbs' median. */
export function compare(s: { b: ThreeBound; carrier: Group }, clip: Clip, rest: Rest) {
  const { b, carrier } = s, p = new ClipPlayer(b, clip, rest), pc = playable(clip, rest);
  const own = (pc.keys[0] as { root?: unknown }).root !== undefined, feet = (pc.contacts.footL?.length ?? 0) + (pc.contacts.footR?.length ?? 0) > 0;
  const path = own || feet ? contact.contactRoot(pc, rest, pc.contacts) : { root: () => ({ forward: 0, right: 0, yaw: 0 }) };
  const v = (x: readonly number[]) => new Vector3(x[0], x[1], x[2]).normalize(), f = v(b.core.frame.forward), r = v(b.core.frame.right), u = v(b.core.frame.up), k = b.core.scale;
  const X = new Float32Array(format.P * 3), q = new Vector3(), limbs: number[] = [];
  let facing = 0, direction = 0, at = 0;
  for (let i = 0; i < 8; i++) {
    const t = (clip.dur * i) / 7;
    p.seek(t);
    p.apply();
    const root = p.root(), data = path.root(t);
    placeCarrier(carrier, b, root, p.turn());
    carrier.updateMatrixWorld(true);
    // the engine's points (forward, right, up: mm on its body) and the data's (mm on its own, where its path puts them)
    const e = (bone: string) => (b.humanoid[bone]!.getWorldPosition(q), [q.dot(f) / k, q.dot(r) / k, q.dot(u) / k]);
    format.decodePose(rest, format.keyAt(clip, t), X);
    const d = (n: string) => [X[format.IDX[n]! * 3]! + data.forward, X[format.IDX[n]! * 3 + 1]! + data.right, X[format.IDX[n]! * 3 + 2]!];
    const off = Math.abs(wrap(facingOf(e("leftUpperLeg"), e("rightUpperLeg")) - facingOf(d("hipL"), d("hipR"))));
    if (off > facing) [facing, at] = [off, t];
    if (Math.hypot(data.forward, data.right) > BOUNDS.travelled * rest.H0) direction = Math.max(direction, Math.abs(wrap(Math.atan2(root.right, root.forward) / DEG - Math.atan2(data.right, data.forward) / DEG)));
    for (const [a, z, pa, pz] of LIMBS) {
      if (!b.humanoid[a] || !b.humanoid[z]) continue;
      const ea = e(a), ez = e(z), da = d(pa), dz = d(pz), ev = ez.map((x, j) => x - ea[j]!), dv = dz.map((x, j) => x - da[j]!);
      limbs.push(Math.acos(Math.max(-1, Math.min(1, (ev[0]! * dv[0]! + ev[1]! * dv[1]! + ev[2]! * dv[2]!) / (Math.hypot(...ev) * Math.hypot(...dv))))) / DEG);
    }
  }
  return { facing: Math.round(facing), at: Math.round(at * 100) / 100, direction: Math.round(direction), limbs: Math.round(median(limbs)) };
}

/** The clips that turn: a key's heading 20° or more from its start. */
const turning = (c: Clip) => c.keys.some((key) => Math.abs((key as { yaw?: number }).yaw ?? 0) >= 20);

describe("the gallery plays a clip as its data says", () => {
  const ids = lib.catalog().map((c) => c.id), seeds = FULL ? [1, 0] : [1];
  for (const seed of seeds) {
    it(`gen-${seed} (${variant(seed).naming}, ${variant(seed).rest}): ${FULL ? "every clip" : "every other clip that turns"} faces, travels and moves its limbs as its data`, async () => {
      const s = await stage(seed), off: string[] = [];
      let n = 0, turns = 0;
      for (const id of ids) {
        const { clip, rest } = lib.clip(id);
        // T1 reads every other clip that turns (WP-F.15: D74's sample), T2 every clip on two bodies
        if (!FULL && (!turning(clip) || turns++ % 2)) continue;
        n++;
        const got = compare(s, clip, rest);
        if (got.facing > BOUNDS.facing) off.push(`${id}: faces ${got.facing}° from its data at ${got.at} s`);
        if (got.direction > BOUNDS.direction) off.push(`${id}: travels ${got.direction}° from its data's way`);
        if (got.limbs > BOUNDS.limbs && !KNOWN[id]) off.push(`${id}: its limbs ${got.limbs}° (median) from its data's`);
      }
      expect(n, "clips compared").toBeGreaterThan(FULL ? 1000 : 30);
      expect(off).toEqual([]);
    }, FULL ? 300_000 : 60_000);
  }
  it("CMU_CURATED/Pick_Up_Basket: half round to its right, then forward back to its start, as its data (it spun round and walked backwards)", async () => {
    const { clip, rest } = lib.clip("CMU_CURATED/Pick_Up_Basket"), got = compare(await stage(1), clip, rest);
    expect(got).toMatchObject({ facing: expect.any(Number), direction: expect.any(Number) });
    expect(got.facing).toBeLessThanOrEqual(BOUNDS.facing);
    expect(got.direction).toBeLessThanOrEqual(BOUNDS.direction);
  });
  it("names each known exception with its reason, and each still parts from its data (else it goes)", async () => {
    const s = await stage(1);
    for (const [id, why] of Object.entries(KNOWN)) {
      expect(why.length, id).toBeGreaterThan(40);
      const { clip, rest } = lib.clip(id);
      expect(compare(s, clip, rest).limbs, id).toBeGreaterThan(BOUNDS.limbs);
    }
  });
});

// The limbs of a procedural clip, solved frame after frame (PLAN.md WP-6.2, D71): each hand or foot reached for by
// two-bone IK with its bones as long as the start pose has them (the pelvis or shoulders may have moved since), and
// its elbow or knee carried on from where the last frame put it, so a limb swung far turns its joint the short way.
import { IDX } from "../format/body.ts";
import { add, len, sub, type V3 } from "../format/math.ts";
import { reachTo } from "../recipe/ik.ts";

const pt = (X: ArrayLike<number>, n: string): V3 => [X[IDX[n]! * 3]!, X[IDX[n]! * 3 + 1]!, X[IDX[n]! * 3 + 2]!];
/** Each end's chain: the joint it hangs from, the middle joint, the end. */
const CHAIN = { handL: ["shL", "elbowL", "fistL"], handR: ["shR", "elbowR", "fistR"], footL: ["hipL", "kneeL", "ankleL"], footR: ["hipR", "kneeR", "ankleR"] } as const;
/** An end of a limb. */
export type End = keyof typeof CHAIN;

/** The four limbs of a body whose start pose is the points S. */
export class Limbs {
  private readonly lengths = new Map<End, [number, number]>();
  private readonly last = new Map<End, { mid: V3; end: V3 }>();
  constructor(S: ArrayLike<number>) {
    for (const [end, [root, mid, tip]] of Object.entries(CHAIN) as [End, readonly [string, string, string]][]) this.lengths.set(end, [len(sub(pt(S, mid), pt(S, root))), len(sub(pt(S, tip), pt(S, mid)))]);
  }
  /** In the points X, `end` put at T; its joint where the last frame's was, relative to the joint it hangs from. */
  reach(X: Float32Array, end: End, T: V3): void {
    const [root, mid, tip] = CHAIN[end], S = pt(X, root), was = this.last.get(end);
    reachTo(X, end, T, was ? { mid: add(S, was.mid), end: add(S, was.end) } : undefined, this.lengths.get(end));
    this.last.set(end, { mid: sub(pt(X, mid), S), end: sub(pt(X, tip), S) });
  }
}

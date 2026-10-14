// The limbs of a procedural clip, solved frame after frame (PLAN.md WP-6.2, D71): each hand or foot reached for by
// two-bone IK with its bones as long as the start pose has them (the pelvis or shoulders may have moved since), and
// its elbow or knee carried on from where the last frame put it, so a limb swung far turns its joint the short way. A
// start pose whose knee points back (a straight leg, its twist turned round: nothing shows) would carry that knee on
// into every bend, so a leg starts from its knee turned to the front instead.
import { IDX } from "../format/body.ts";
import { add, dot, len, mul, sub, type V3 } from "../format/math.ts";
import { reachTo } from "../recipe/ik.ts";

const pt = (X: ArrayLike<number>, n: string): V3 => [X[IDX[n]! * 3]!, X[IDX[n]! * 3 + 1]!, X[IDX[n]! * 3 + 2]!];
/** Each end's chain: the joint it hangs from, the middle joint, the end. */
const CHAIN = { handL: ["shL", "elbowL", "fistL"], handR: ["shR", "elbowR", "fistR"], footL: ["hipL", "kneeL", "ankleL"], footR: ["hipR", "kneeR", "ankleR"] } as const;
/** An end of a limb. */
export type End = keyof typeof CHAIN;

/** A leg's knee and ankle relative to its hip, the knee turned to the front (+x) if it points back: its offset from the
 *  hip-to-ankle line mirrored across it. Undefined when it already points forward. */
function forward(X: ArrayLike<number>, root: string, mid: string, tip: string): { mid: V3; end: V3 } | undefined {
  const S = pt(X, root), K = sub(pt(X, mid), S), A = sub(pt(X, tip), S), l = len(A);
  if (l < 1e-6) return undefined;
  const u = mul(A, 1 / l), off = sub(K, mul(u, dot(K, u))), front = sub([1, 0, 0], mul(u, dot([1, 0, 0], u)));
  return dot(off, front) < 0 ? { mid: sub(K, mul(off, 2)), end: A } : undefined;
}

/** The four limbs of a body whose start pose is the points S. */
export class Limbs {
  private readonly lengths = new Map<End, [number, number]>();
  private readonly last = new Map<End, { mid: V3; end: V3 }>();
  constructor(S: ArrayLike<number>) {
    for (const [end, [root, mid, tip]] of Object.entries(CHAIN) as [End, readonly [string, string, string]][]) this.lengths.set(end, [len(sub(pt(S, mid), pt(S, root))), len(sub(pt(S, tip), pt(S, mid)))]);
  }
  /** In the points X, `end` put at T; its joint where the last frame's was, relative to the joint it hangs from. */
  reach(X: Float32Array, end: End, T: V3): void {
    const [root, mid, tip] = CHAIN[end], S = pt(X, root), was = this.last.get(end) ?? (end.startsWith("foot") ? forward(X, root, mid, tip) : undefined);
    reachTo(X, end, T, was ? { mid: add(S, was.mid), end: add(S, was.end) } : undefined, this.lengths.get(end));
    this.last.set(end, { mid: sub(pt(X, mid), S), end: sub(pt(X, tip), S) });
  }
}

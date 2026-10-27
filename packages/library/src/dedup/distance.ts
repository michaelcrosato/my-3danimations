// The time-warped distance between two clips' motions (PLAN.md WP-9.3): dynamic time warping over their sampled poses
// (features.ts), so a clip retimed, eased or trimmed a little lies near its original. A pose is matched to the other
// clip's motion between two of its samples (the nearer of the two poses projected on the other's next step), so a
// retimed copy, whose samples fall between its original's, costs nothing for falling there. The alignment stays within
// BAND of the diagonal (each clip's time as a fraction of its length), may leave up to SLACK of either clip's ends
// unmatched, and for a loop starts from its first phase and the PHASES nearest in lockstep. A step's cost is weighted
// as Sakoe and Chiba's symmetric form (a diagonal step twice a straight one), and the distance is the cost per unit of
// weight along the path: mm a point on average. The mirrored motion is tried too, and each turned about the up axis to
// face as the other does on average (a slice starts its heading afresh), and the nearest kept.
import { format } from "@m3a/core";
import { N, poseDistance, type MotionFeatures } from "./features.ts";

/** How far an alignment may stray from the diagonal, as a fraction of each clip's length (an ease in strays 0.25). */
export const BAND = 0.3;
/** How much of either end of either clip an alignment may leave unmatched, as a fraction of its length. */
export const SLACK = 0.1;
/** How many of a loop's phases, besides its first, an alignment starts from: the nearest in lockstep, PROBE poses
 *  read. */
export const PHASES = 3;
const PROBE = 24;
/** A turn under 1° (its cosine above this) is not tried apart from the clip as it faces. */
const TURNED = 0.99985;
/** Two clips are compared only when the longer is at most this many times the shorter (a retime by half, or double),
 *  unless both hold still. */
export const RETIME = 2;
/** A clip whose poses lie this close to their centre (mm a point on average) holds still: a held pose is the same held
 *  for a second or for five. */
export const STILL = 5;

/** How near two motions are: mm a point on average along the best alignment, and whether one was mirrored to get
 *  there. */
export interface Alignment {
  mm: number;
  mirrored: boolean;
}

/** A clip's poses as an alignment reads them: from pose `k` on (a loop's phase), its next pose wrapping if it loops. */
interface Seq {
  f: Float32Array;
  n: number;
  loop: boolean;
  k: number;
}
const at = (s: Seq, j: number) => (j + s.k) % s.n;
/** Each step of a sequence's poses (pose p to the next, a loop's last to its first), worked out once a frames array and
 *  read by every cell of every warp over it: the step's numbers (E) and its squared length (nn), as toStep would sum
 *  them, the same doubles in the same order (WP-F.15: T1's dedup and the intake's checker spent most of their time
 *  working them out again at every cell). */
interface Steps {
  E: Float64Array;
  nn: Float64Array;
}
const stepsOf = new WeakMap<Float32Array, { loop: boolean; steps: Steps }>();
function steps(s: Seq): Steps {
  const had = stepsOf.get(s.f);
  if (had && had.loop === s.loop) return had.steps;
  const B = s.f, E = new Float64Array(s.n * N), nn = new Float64Array(s.n);
  for (let p = 0; p < s.n; p++) {
    if (p + 1 >= s.n && !s.loop) break;
    const b0 = p * N, b1 = ((p + 1) % s.n) * N;
    let sq = 0;
    for (let o = 0; o < N; o++) {
      const e = B[b1 + o]! - B[b0 + o]!;
      E[b0 + o] = e;
      sq += e * e;
    }
    nn[p] = sq;
  }
  const out = { E, nn };
  stepsOf.set(s.f, { loop: s.loop, steps: out });
  return out;
}
/** How far pose `i` of `a` lies from b's motion between its poses j and j + 1 (mm a point): the pose projected on that
 *  step, as a straight line in every number; pose j itself when b has no next pose. */
function toStep(a: Seq, i: number, b: Seq, j: number, st: Steps): number {
  const ai = at(a, i) * N, bj = at(b, j);
  if (j + 1 >= b.n && !b.loop) return poseDistance(a.f, at(a, i), b.f, bj);
  const b0 = bj * N, A = a.f, B = b.f, E = st.E, nn = st.nn[bj]!;
  let dot = 0;
  for (let o = 0; o < N; o++) dot += (A[ai + o]! - B[b0 + o]!) * E[b0 + o]!;
  const s = nn > 0 ? Math.min(1, Math.max(0, dot / nn)) : 0;
  let sum = 0;
  for (let o = 0; o < N; o += 3) {
    const dx = A[ai + o]! - B[b0 + o]! - s * E[b0 + o]!, dy = A[ai + o + 1]! - B[b0 + o + 1]! - s * E[b0 + o + 1]!, dz = A[ai + o + 2]! - B[b0 + o + 2]! - s * E[b0 + o + 2]!;
    sum += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return sum / format.P;
}

/** The best alignment's cost per unit weight between sequences a and b. */
function warp(a: Seq, b: Seq): number {
  const n = a.n, m = b.n, un = 1 / (n - 1), um = 1 / (m - 1);
  // D: cost along the best path to a cell; W: its weight; rows of m cells, two kept
  let D0 = new Float64Array(m), W0 = new Float64Array(m), D1 = new Float64Array(m), W1 = new Float64Array(m);
  let best = Infinity;
  const sa = steps(a), sb = steps(b);
  for (let i = 0; i < n; i++) {
    const u = i * un;
    D1.fill(Infinity);
    for (let j = Math.max(0, Math.ceil((u - BAND) / um)), top = Math.min(m - 1, Math.floor((u + BAND) / um)); j <= top; j++) {
      const v = j * um, c = Math.min(toStep(a, i, b, j, sb), toStep(b, j, a, i, sa));
      // a path starts with the cell itself (weight 2), at either clip's start within SLACK of the other's
      let d = (i === 0 && v <= SLACK) || (j === 0 && u <= SLACK) ? 2 * c : Infinity, w = 2;
      const step = (pd: number, pw: number, cw: number) => {
        if (pd === Infinity) return;
        const nd = pd + cw * c, nw = pw + cw;
        if (d === Infinity || nd / nw < d / w) [d, w] = [nd, nw];
      };
      if (i > 0 && j > 0) step(D0[j - 1]!, W0[j - 1]!, 2);
      if (i > 0) step(D0[j]!, W0[j]!, 1);
      if (j > 0) step(D1[j - 1]!, W1[j - 1]!, 1);
      D1[j] = d;
      W1[j] = w;
      // and ends at either clip's end within SLACK of the other's
      if (d !== Infinity && ((i === n - 1 && v >= 1 - SLACK) || (j === m - 1 && u >= 1 - SLACK))) best = Math.min(best, d / w);
    }
    [D0, D1, W0, W1] = [D1, D0, W1, W0];
  }
  return best;
}

/** The turn about the up axis (as cos, sin) that best lays pose `a` onto pose `b`, their points' forward and right
 *  taken as they are (Kabsch's rotation in the plane): how a copy whose heading was taken afresh lines up. */
function turnOnto(a: Float32Array, b: Float32Array): [number, number] {
  let dot = 0, cross = 0;
  for (let o = 0; o < N; o += 3) {
    dot += a[o]! * b[o]! + a[o + 1]! * b[o + 1]!;
    cross += a[o]! * b[o + 1]! - a[o + 1]! * b[o]!;
  }
  const r = Math.sqrt(dot * dot + cross * cross);
  return r > 0 ? [dot / r, cross / r] : [1, 0];
}
/** Poses turned about the up axis (each is centred on the pelvis, so about it). */
function turned(f: Float32Array, [c, s]: [number, number]): Float32Array {
  const out = f.slice();
  for (let o = 0; o < f.length; o += 3) {
    out[o] = c * f[o]! - s * f[o + 1]!;
    out[o + 1] = s * f[o]! + c * f[o + 1]!;
  }
  return out;
}
/** The phases of loop q an alignment with p starts from: its first, and the `keep` nearest p in lockstep (p's poses
 *  against q's at the same fraction of their lengths, PROBE of them). */
function phases(p: Seq, q: Seq, keep: number): number[] {
  const probe = Math.min(PROBE, p.n), score: [number, number][] = [];
  for (let k = 0; k < q.n; k++) {
    let sum = 0;
    for (let x = 0; x < probe; x++) {
      const i = Math.floor((x * p.n) / probe);
      sum += poseDistance(p.f, i, q.f, (Math.floor((i * q.n) / p.n) + k) % q.n);
    }
    score.push([sum, k]);
  }
  // a copy most often starts where its original does: phase 0 is always tried
  return [...new Set([0, ...score.sort((x, y) => x[0] - y[0] || x[1] - y[1]).slice(0, keep).map(([, k]) => k)])];
}

/** Whether two motions' lengths are near enough to compare: within RETIME, or both held still. */
export const comparable = (a: MotionFeatures, b: MotionFeatures): boolean => Math.max(a.dur, b.dur) <= RETIME * Math.min(a.dur, b.dur) || (a.spread < STILL && b.spread < STILL);

/** How near motion `a` lies to motion `b`: the time-warped distance, `a` as it is and mirrored, as it faces and turned
 *  to face as `b` does, the loop of the two (b when both loop) read from its first phase and its PHASES nearest.
 *  Infinity when they aren't `comparable`. */
export function motionDistance(a: MotionFeatures, b: MotionFeatures): Alignment {
  if (!comparable(a, b)) return { mm: Infinity, mirrored: false };
  // the loop is the one read at a phase; mirroring either one is the same (core's mirror is its own inverse)
  const [p, q] = b.loop || !a.loop ? [a, b] : [b, a];
  let out: Alignment = { mm: Infinity, mirrored: false };
  for (const mirrored of [false, true]) {
    const f = mirrored ? p.mirror : p.frames, turn = turnOnto(mirrored ? p.meanMirror : p.mean, q.mean);
    for (const P of turn[0] > TURNED ? [f] : [f, turned(f, turn)]) {
      const seq: Seq = { f: P, n: p.n, loop: p.loop, k: 0 }, Q: Seq = { f: q.frames, n: q.n, loop: q.loop, k: 0 };
      for (const k of q.loop ? phases(seq, Q, PHASES) : [0]) {
        const mm = warp(seq, { ...Q, k });
        if (mm < out.mm) out = { mm, mirrored };
      }
    }
  }
  return out;
}

/** How far apart two motions' mean poses lie (mm a point), `a`'s as it is or mirrored and turned to face as `b`'s,
 *  whichever is nearer: over time, or (`path`) along the paths the poses trace. A cheap measure to skip pairs by. */
export function centreDistance(a: MotionFeatures, b: MotionFeatures, path = false): number {
  const to = path ? b.centre : b.mean;
  return Math.min(...(path ? [a.centre, a.centreMirror] : [a.mean, a.meanMirror]).map((m) => poseDistance(turned(m, turnOnto(m, to)), 0, to, 0)));
}

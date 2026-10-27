// How a clip's own motion bounds its fit's limit (F.13, D135): one rule for an import (@m3a/io's `importSet`, over the
// whole clip) and a recipe's compile (core's `recipe.compile`, over the second around each frame). The fit starts from Ramer–Douglas–Peucker key frames (`reduce`), which keep
// only a clip's first and last frames when every frame is within the limit of the straight in-between of those two; a
// loop's two ends are one pose, so a fixed 30 mm took a 1 to 4 cm sway (an idle's breathing) for noise and froze it.
// Half of how far the capture strays from that in-between (`offLine`; a loop's is its reach) keeps the frame that strays
// most, and so the sway, also on a clip that leans or drifts while it sways; a clip that reaches twice the limit or more
// is fitted at the limit, exactly as before; under 3 mm is still (a held pose, or noise the format's whole degrees
// don't show). Nothing here changes `fit` or `reduce`: a caller passes the limit it gets.
import { P } from "./body.ts";
import { error } from "./fit.ts";

/** Frames of body points, as a capture holds them (`Capture` is one): n frames of the 36 points, mm. */
export interface Frames {
  n: number;
  data: Float32Array;
}

/** The share of how far a clip strays its fit's limit is (`ratio`) and the least limit (`floor`, mm). */
export const MOTION_TOL: Readonly<{ ratio: number; floor: number }> = { ratio: 0.5, floor: 3 };

/** How far a capture moves (mm): the farthest any body point of any frame gets from the first frame's, as `error`
 *  measures two poses apart. */
export function reach(cap: Frames): number {
  const k = P * 3, first = cap.data.subarray(0, k);
  let far = 0;
  for (let f = 1; f < cap.n; f++) far = Math.max(far, error(cap.data.subarray(f * k, (f + 1) * k), first));
  return far;
}

/** How far a capture strays from the straight in-between of its first and last frames (mm): what the fit tests first
 *  (`reduce`, the same in-between and `error`), the farthest any body point of any frame gets from where that in-between
 *  puts it. A clip whose ends meet (a loop) strays as far as it reaches. */
export function offLine(cap: Frames): number {
  const k = P * 3, D = cap.data, last = (cap.n - 1) * k, X = new Float32Array(k);
  let far = 0;
  for (let f = 1; f < cap.n - 1; f++) {
    const t = f / (cap.n - 1);
    for (let j = 0; j < k; j++) X[j] = D[j]! + (D[last + j]! - D[j]!) * t;
    far = Math.max(far, error(X, D.subarray(f * k, (f + 1) * k)));
  }
  return far;
}

/** The fit's limit (mm) for a clip that strays `far` mm: `tol`, or `ratio` of `far` when that is less, and at least
 *  `floor` (MOTION_TOL). */
export function clipTol(tol: number, far: number, k: { ratio: number; floor: number } = MOTION_TOL): number {
  return Math.min(tol, Math.max(k.floor, k.ratio * far));
}

/** Whether a capture moves too little for `tol` to keep its motion: it reaches less than `tol / ratio`, so `fitLimit`
 *  bounds its limit by its own motion (and an import encodes it with the encoder's `steadyBend` and `steadyRound` and the
 *  fit's `spaced`; a recipe's compile reads no bend from points). */
export function ownMotion(cap: Frames, tol: number, k: { ratio: number; floor: number } = MOTION_TOL): boolean {
  return reach(cap) < tol / k.ratio;
}

/** The fit's limit (mm) for a capture: `tol` for one that reaches `tol / ratio` or more (fitted exactly as before
 *  F.13); else `clipTol` of how far it strays from the in-between of its ends, or of its reach where that is less
 *  (either way under how far it strays, so the fit keeps the frame that strays most). */
export function fitLimit(cap: Frames, tol: number, k: { ratio: number; floor: number } = MOTION_TOL): number {
  const far = reach(cap);
  return far >= tol / k.ratio ? tol : clipTol(tol, Math.min(far, offLine(cap)), k);
}

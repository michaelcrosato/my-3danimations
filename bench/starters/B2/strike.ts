// A punch's strike, found as B2's grader finds it (the grader imports this very file, and `npm run check` prints what
// it finds): from each hand's place forward of the hips on every frame, the hand that reaches farthest forward after a
// press, the frame it is farthest out, and its strike, the last time its forward speed peaks faster than one hip height
// a second before then. Damage may come from two frames before the strike (a cross-fade moves the played peak a frame
// or two from the clip's own) to the frame the hand is farthest out.

/** A press's punch: its hand, the frame it is farthest out, its strike and that speed, and the frames damage may come on. */
export interface Strike {
  hand: number;
  far: number;
  at: number;
  /** The hand's forward speed at its strike, mm/s (0 when it never peaks faster than one hip height a second). */
  speed: number;
  from: number;
  to: number;
}

/** How many frames after a press its punch is looked for in (60 a second). */
export const WINDOW = 90;

/**
 * The punch after the press on frame `press`: `ahead[h][i]` is hand h's place forward of the hips on frame i (mm, 60
 * frames a second), `H0` the hip height (mm). A fade into a fighting stance can carry a hand forward faster than the
 * punch itself, so the strike is the punch's own last peak, not the fastest moment.
 */
export function strikeOf(ahead: number[][], press: number, H0: number, fps = 60): Strike {
  const n = ahead[0]!.length, end = Math.min(n, press + WINDOW);
  const speed = (h: number, i: number) => {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    return ((ahead[h]![b]! - ahead[h]![a]!) * fps) / (b - a);
  };
  let hand = 0, far = press;
  for (let h = 0; h < ahead.length; h++) for (let i = press; i < end; i++) if (ahead[h]![i]! > ahead[hand]![far]!) [hand, far] = [h, i];
  let at = -1;
  for (let i = far - 1; i > press && at < 0; i--) {
    const v = speed(hand, i);
    if (v > H0 && v >= speed(hand, i - 1) && v >= speed(hand, i + 1)) at = i;
  }
  return at < 0 ? { hand, far, at: far, speed: 0, from: far, to: far } : { hand, far, at, speed: speed(hand, at), from: at - 2, to: Math.max(at, far) };
}

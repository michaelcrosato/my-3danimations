// The frame clock, shaped as my-3dge's (its engine/core/time.ts, ADR-0005): real time in, fixed 60 Hz sim steps out,
// at most 6 a frame (the rest dropped after a stall), and `alpha`, how far into the next step the frame ends, for the
// view to interpolate. The accumulator counts whole nanoseconds times hz (one step is 1e9), so after T ms exactly
// floor(T × hz / 1000) steps have run however the frames fall. No wall clock: the page passes requestAnimationFrame's
// timestamp, a test its own.

/** The sim's steps a second (my-3dge's SIM_HZ). */
export const HZ = 60;
/** One sim step, seconds. */
export const DT = 1 / HZ;

/** A frame's fixed steps: how many to run, how far into the next one it ends (0 to 1), and how many a stall dropped. */
export interface Frame {
  steps: number;
  alpha: number;
  dropped: number;
}

/** A frame clock: `advance(now)` (ms) gives the fixed steps the time since the first frame owes, at most `maxSteps`. */
export interface Clock {
  advance(now: number): Frame;
}

/** A frame clock at `hz` steps a second, at most `maxSteps` (6) a frame; the first frame sets the origin. */
export function createClock(opts: { hz?: number; maxSteps?: number } = {}): Clock {
  const hz = opts.hz ?? HZ, max = opts.maxSteps ?? 6, STEP = 1e9;
  let origin: number | null = null, acc = 0, last = 0;
  return {
    advance(now) {
      if (!Number.isFinite(now)) throw new Error(`clock.advance(now): pass the frame's time in ms (requestAnimationFrame's argument), not ${now}`);
      if (origin === null) {
        origin = now;
        return { steps: 0, alpha: 0, dropped: 0 };
      }
      const ns = Math.round((now - origin) * 1e6);
      acc += (ns - last) * hz;
      last = ns;
      const due = Math.floor(acc / STEP), steps = Math.min(due, max);
      acc -= due * STEP;
      return { steps, alpha: acc / STEP, dropped: due - steps };
    },
  };
}

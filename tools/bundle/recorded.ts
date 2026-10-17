// @m3a/three, recorded (WP-7.4): `npm run pack -- --check` runs the manual's complete example on the installed
// packages with its imports of @m3a/three taken from this file (./example.ts, `recordedForm`): every name @m3a/three
// gives, its own player too, with each update recorded as ./headless.ts's stand-ins record theirs (`record`: every
// pose's fingerprint, the events, the travel, each Animator's hash). `recordedReport()`, printed at the end, is then
// held to what the headless form prints (./example.ts, `sameRun`), so the stand-ins can't drift from three's binding
// on anything the example uses unseen. No clock.
import type { Animator, PoseOptions } from "@m3a/core";
import { attach as attachThree, type Attached, type ThreeBound } from "@m3a/three";
import { record } from "./headless.ts";

export * from "@m3a/three";

/** What @m3a/three's players saw here. */
const seen = record();

/** @m3a/three's attach, its player recorded: the same player, its `update` recording the pose it wrote and the travel
 *  it gave after each step. */
export function attach(animator: Animator, bound: ThreeBound): Attached {
  const player = attachThree(animator, bound), update = player.update;
  seen.attached(animator);
  player.update = (dt: number, opts?: PoseOptions) => {
    const r = update(dt, opts);
    seen.updated(r, player.pose, player.travel);
    return r;
  };
  return player;
}

/** What @m3a/three's players saw, as one line of JSON (./headless.ts `record`; no images: the real writePng writes
 *  its file). */
export function recordedReport(): string {
  return seen.report();
}

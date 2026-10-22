// The still rule (F.13, D133, D135): a clip whose body points all stay within STILL.mm of where they start never moves,
// and is a held pose only when its tags say so (`pose`, a held pose; `reference`, a rest or T-pose). A still pose breaks
// no metric, so no sensor rule catches a clip that promises motion and plays a statue; this rule does. One rule, read
// in two places: the library's QA (`npm run qa -- library`'s still check, tools/qa/library.ts, where library/baselines/
// qa.json may answer a clip that stays still) and the intake's lint gate (`m3a library submit`, the checker and the
// library's pull-request gates, packages/tools/src/tools/library-submit.ts), so a statue is named where it is sent.
import { format, type Clip, type Rest } from "@m3a/core";

/**
 * A clip never moves when every body point stays within `mm` of where it starts (read every 1/30 s and at its end, the
 * farthest any point gets as core's `format.error` measures two poses apart); its `tags` say when that is meant. 3 mm is the least
 * limit a clip's own motion gives its fit (MOTION_TOL's floor, F.13): the format's whole degrees show less only as noise.
 */
export const STILL = { mm: 3, tags: ["pose", "reference"] } as const;

/** How far a clip moves (mm): the farthest any body point gets from where it starts, read every 1/30 s and at its end
 *  (where the 1/30 s steps don't land on it: a clip shorter than 1/30 s has no other reading); or, given `upTo`, read
 *  only until it gets that far (what it returns then is at least `upTo`: the still rule needs no more, and a clip that
 *  moves gets past STILL.mm in its first few frames). */
export function reachOf(clip: Clip, rest: Rest, upTo = Infinity): number {
  const k = format.P * 3, X0 = format.pose(rest, clip, 0, new Float32Array(k)), X = new Float32Array(k), n = Math.floor(clip.dur * 30 + 1e-6);
  let far = 0;
  for (let i = 1; i <= n && far < upTo; i++) far = Math.max(far, format.error(format.pose(rest, clip, i / 30, X), X0));
  if (far < upTo && clip.dur * 30 - n > 1e-6) far = Math.max(far, format.error(format.pose(rest, clip, clip.dur, X), X0));
  return far;
}

/** Whether a clip's tags say it is a held pose (one of STILL.tags), so staying still is what it promises. */
export const isPose = (tags: readonly string[]): boolean => tags.some((t) => (STILL.tags as readonly string[]).includes(t));

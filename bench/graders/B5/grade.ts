// B5's grader (PLAN.md §7, WP-6.6): the workspace's emote.json compiled against the CC0 library: it checks and makes a
// valid clip, 1.5 s (±0.05) and looping; the sensors find nothing failing; `describe` reports it in the air (a hop); both
// wrists above the head a quarter of the cycle or more, each moving side to side at least 10% of the hip height and
// changing direction at least twice (a two-handed wave), on the clip's own rest; and it plays on the workspace's
// character, every joint finite.
import { describe as describeClip } from "@m3a/sensors";
import type { Check, Grade } from "../B1/grade.ts";
import { compiled, playsOn, sensorsCheck, track } from "../recipes.ts";

/** Grades the recipe in `workspace` (its emote.json). */
export async function gradeB5(workspace: string): Promise<Grade> {
  const t0 = performance.now(), out: Check[] = [], add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail }), done = () => ({ pass: out.every((c) => c.ok), checks: out, ms: performance.now() - t0 });
  const c = compiled(workspace, "emote.json", add);
  if (!c) return done();
  const { clip, rest } = c, H0 = rest.H0;
  add("1.5 s, looping", Math.abs(clip.dur - 1.5) <= 0.05 && clip.loop, `${clip.dur} s, ${clip.loop ? "a loop" : "not a loop"}`);
  out.push(sensorsCheck(clip, rest));
  const text = describeClip(clip, rest).text;
  add("its description reports a hop (in the air)", /in the air/.test(text), text);
  const head = track(clip, rest, "head"), wrists = (["L", "R"] as const).map((s) => track(clip, rest, `wrist${s}`));
  const up = head.filter((h, i) => wrists.every((w) => w[i]![2] > h[2])).length / head.length;
  add("both hands above the head", up >= 0.25, `both wrists above the head ${(up * 100).toFixed(0)}% of the cycle`);
  for (const [k, s] of (["L", "R"] as const).entries()) {
    const side = wrists[k]!.map((p) => p[1]), span = Math.max(...side) - Math.min(...side);
    let turns = 0;
    for (let i = 2; i < side.length; i++) if ((side[i]! - side[i - 1]!) * (side[i - 1]! - side[i - 2]!) < 0 && Math.abs(side[i]! - side[i - 2]!) > 0.002 * H0) turns++;
    add(`the ${s === "L" ? "left" : "right"} hand waves`, span >= 0.1 * H0 && turns >= 2, `side to side ${((100 * span) / H0).toFixed(0)}% of the hip height, ${turns} turns`);
  }
  out.push(await playsOn(workspace, clip, rest));
  return done();
}

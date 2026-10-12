// B6's grader (PLAN.md §7, WP-6.6): the workspace's punch.json compiled against the CC0 library, against the library's
// MESH2MOTION/Punch_Cross, by the facts measured on its rest: its length and its strike the original's over 1.3 (±3%,
// ±0.05 s); the left fist strikes; mirrored back (the mirror check), its fist at the strike within 10% of the hip height
// of the original's against the pelvis; the fist draws back 4% of the hip height before the strike (anticipation: the
// original has none); the sensors find nothing failing; it plays on the workspace's character, every joint finite.
import { format, type Clip } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import type { Check, Grade } from "../B1/grade.ts";
import { compiled, playsOn, punchOf, sensorsCheck, track } from "../recipes.ts";

/** The punch the brief edits. */
export const ORIGINAL = "MESH2MOTION/Punch_Cross";

/** Grades the recipe in `workspace` (its punch.json). */
export async function gradeB6(workspace: string): Promise<Grade> {
  const t0 = performance.now(), out: Check[] = [], add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail }), done = () => ({ pass: out.every((c) => c.ok), checks: out, ms: performance.now() - t0 });
  const c = compiled(workspace, "punch.json", add);
  if (!c) return done();
  const { clip, rest } = c, H0 = rest.H0, orig = openLibrary().clip(ORIGINAL), o = punchOf(orig.clip, orig.rest), p = punchOf(clip, rest);
  add("30% faster", Math.abs(clip.dur - orig.clip.dur / 1.3) <= 0.03 * (orig.clip.dur / 1.3), `${clip.dur} s, the original's ${orig.clip.dur} s over 1.3 is ${(orig.clip.dur / 1.3).toFixed(3)}`);
  add("its strike 30% sooner", Math.abs(p.strike - o.strike / 1.3) <= 0.05, `strikes at ${p.strike} s, the original's ${o.strike} s over 1.3 is ${(o.strike / 1.3).toFixed(3)}`);
  add("the left fist strikes", p.side === "L", `the ${p.side === "L" ? "left" : "right"} fist strikes`);
  // the mirror check: the edit mirrored back, its fist at its strike where the original's is at its own
  const back = format.mirror(clip as never) as Clip;
  const at = (cl: Clip, r: typeof rest, s: number) => {
    const i = Math.round(s * 60), f = track(cl, r, "fistR")[i]!, pel = track(cl, r, "pelvis")[i]!;
    return [(f[0] - pel[0]) / r.H0, (f[1] - pel[1]) / r.H0, (f[2] - pel[2]) / r.H0];
  };
  const a = at(back, rest, p.strike), b = at(orig.clip, orig.rest, o.strike), off = Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
  add("mirrored back, it strikes where the original does", off <= 0.1, `its fist at the strike ${(off * 100).toFixed(0)}% of the hip height from the original's`);
  add("more anticipation: the fist draws back first", p.windup >= 0.04 * H0 && p.windup > o.windup, `draws back ${Math.round(p.windup)} mm (the original ${Math.round(o.windup)}; at least ${Math.round(0.04 * H0)})`);
  out.push(sensorsCheck(clip, rest));
  out.push(await playsOn(workspace, clip, rest));
  return done();
}

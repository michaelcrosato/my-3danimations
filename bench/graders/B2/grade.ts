// B2's grader (PLAN.md §7, WP-6.6): the workspace's fighter driven with two presses two seconds apart, graded from the
// character's bones: after each press a hand reaches 15% of the hip height forward and strikes faster than one hip
// height a second against the pelvis (a punch), then comes back (an idle again); the game's damage comes exactly once
// per punch, never without one, from two frames before the strike to four after (and not past the hand's farthest
// reach), the strike being the last time that hand's speed
// toward its target (forward) against the pelvis peaks faster than one hip height a second before it is farthest out
// (the starter's strike.ts, which its check prints from: the punch's own peak, not a fade into a stance before it); it
// idles before and after; no transform goes non-finite. The character is the grader's parameter: its character.glb.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Check, Grade } from "../B1/grade.ts";
import { strikeOf, WINDOW } from "../../starters/B2/strike.ts";
import { bodyOf, jointsOf, sub, type V3 } from "../bones.ts";

/** The frames (at 60 a second) attack is pressed on, and how many frames the fighter is driven. */
export const PRESSES = [60, 180], FRAMES = 300;

/** Grades the fighter in `workspace` (its src/fighter.ts, on its character.glb). */
export async function gradeB2(workspace: string): Promise<Grade> {
  const t0 = performance.now(), out: Check[] = [], add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail }), done = () => ({ pass: out.every((c) => c.ok), checks: out, ms: performance.now() - t0 });
  const { core, bones, floor } = await bodyOf(workspace), H0 = core.rest.H0, dt = 1 / 60;
  const { loadCharacter } = (await import(pathToFileURL(join(workspace, "src/character.ts")).href)) as { loadCharacter(): Promise<never> };
  const { createFighter } = (await import(pathToFileURL(join(workspace, "src/fighter.ts")).href)) as { createFighter(c: unknown, g: { damage(n: number): void }): Promise<{ update(dt: number, i: { attack: boolean }): void }> };
  const damage: { frame: number; amount: number }[] = [], joints: Record<string, V3>[] = [];
  let frame = 0, nonFinite = 0, threw = "";
  try {
    const character: { updateMatrixWorld(f: boolean): void; traverse(f: (o: { matrixWorld: { elements: number[] } }) => void): void; getObjectByName(n: string): never } = await loadCharacter();
    const fighter = await createFighter(character, { damage: (amount) => damage.push({ frame, amount }) });
    for (frame = 0; frame < FRAMES; frame++) {
      fighter.update(dt, { attack: PRESSES.includes(frame) });
      character.updateMatrixWorld(true);
      character.traverse((o) => void (o.matrixWorld.elements.every(Number.isFinite) || nonFinite++));
      joints.push(jointsOf(character, bones, floor));
    }
  } catch (err) {
    threw = `${frame < FRAMES ? `at frame ${frame}` : "creating the fighter"}: ${String((err as Error).message).split("\n")[0]}`;
  }
  add("runs", !threw, threw || `${FRAMES} frames, attack pressed on frames ${PRESSES.join(" and ")}`);
  add("finite", !threw && nonFinite === 0, nonFinite ? `${nonFinite} non-finite transforms` : "every bone finite every frame");
  if (threw) return done();
  // each hand's place toward the target (forward, the way the character faces) against the pelvis, every frame; each
  // press's punch and its strike found by the starter's strike.ts, which `npm run check` prints from too
  const hands = ["wristL", "wristR"], ahead = hands.map((w) => joints.map((j) => sub(j.pelvis!, j[w]!)[0]));
  const strikes = PRESSES.map((p) => ({ press: p, ...strikeOf(ahead, p, H0) }));
  for (const s of strikes) add(`punches after the press on frame ${s.press}`, s.speed > H0 && s.reach >= 0.15 * H0, `its hand strikes forward at ${(s.speed / 1000).toFixed(2)} m/s against the pelvis, on frame ${s.at}, reaching ${Math.round((100 * s.reach) / H0)}% of the hip height forward (one hip height a second is ${(H0 / 1000).toFixed(2)}; a punch reaches 15% or more)`);
  const inWindow = (p: number) => damage.filter((d) => d.frame >= p && d.frame < p + WINDOW);
  add("damage once per punch", strikes.every((s) => inWindow(s.press).length === 1) && damage.length === PRESSES.length, `damage on frames ${damage.map((d) => d.frame).join(", ") || "none"}`);
  for (const s of strikes) {
    const d = inWindow(s.press)[0];
    add(`damage when the punch on frame ${s.press} lands`, !!d && d.frame >= s.from && d.frame <= s.to, d ? `damage on frame ${d.frame}; its strike on frame ${s.at}, the hand farthest out on ${s.far} (damage from ${s.from} to ${s.to})` : "no damage");
  }
  // it goes back to idling: from a punch's window's end to the next press (or the end), its hand comes back at least
  // half way from its reach to where it was before the press (a punch looped on is no idle)
  for (const s of strikes) {
    const h = ahead[s.hand]!, before = Math.max(...h.slice(s.press - 30, s.press)), next = PRESSES.find((p) => p > s.press) ?? FRAMES, after = Math.max(...h.slice(s.press + WINDOW, next));
    add(`back to idling after the punch on frame ${s.press}`, after <= before + 0.5 * (h[s.far]! - before), `its hand ${Math.round(after - before)} mm forward of where it was before the press, from frame ${s.press + WINDOW} to ${next} (at most half its reach, ${Math.round(0.5 * (h[s.far]! - before))})`);
  }
  // it idles before the first press and after the last punch: the body moves against the pelvis there (a pose held
  // still is no idle), each point's travel over the second before the press and the last ⅔ s, at its most
  const moves = (a: number, b: number) => Math.max(...Object.keys(joints[0]!).filter((n) => n !== "pelvis").map((n) => {
    const r = joints.slice(a, b).map((j) => sub(j.pelvis!, j[n]!));
    return Math.max(...[0, 1, 2].map((k) => Math.max(...r.map((v) => v[k]!)) - Math.min(...r.map((v) => v[k]!))));
  }));
  const before = moves(0, PRESSES[0]!), after = moves(FRAMES - 40, FRAMES);
  add("it idles", before >= IDLE * H0 && after >= IDLE * H0, `a point moves ${before.toFixed(0)} mm against the pelvis in the second before the first press and ${after.toFixed(0)} mm in the last ⅔ s (at least ${(IDLE * H0).toFixed(0)}: a pose held still is no idle)`);
  add("damage 10 a punch", damage.every((d) => d.amount === 10), `damage ${damage.map((d) => d.amount).join(", ") || "none"}`);
  return done();
}
/** The least an idle moves a point against the pelvis over its windows, of the hip height. */
const IDLE = 0.005;

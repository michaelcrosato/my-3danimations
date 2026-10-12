// B2's grader (PLAN.md §7, WP-6.6): the workspace's fighter driven with two presses two seconds apart, graded from the
// character's bones: after each press a hand reaches forward and strikes faster than one hip height a second against
// the pelvis (a punch); the game's damage comes exactly once per punch, never without one, within one frame of the
// strike: the last time that hand's speed toward its target (forward) against the pelvis peaks before it is farthest
// out (the punch's own peak, as the format's facts define a strike, not a fade into a stance before it); no transform
// goes non-finite. The character is the grader's parameter: the workspace's character.glb.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Check, Grade } from "../B1/grade.ts";
import { bodyOf, jointsOf, sub, type V3 } from "../bones.ts";

/** The frames (at 60 a second) attack is pressed on, and how many frames the fighter is driven. */
export const PRESSES = [60, 180], FRAMES = 300;
/** How many frames after a press its punch is looked for in. */
const WINDOW = 90;

/** Grades the fighter in `workspace` (its src/fighter.ts, on its character.glb). */
export async function gradeB2(workspace: string): Promise<Grade> {
  const t0 = performance.now(), out: Check[] = [], add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail }), done = () => ({ pass: out.every((c) => c.ok), checks: out, ms: performance.now() - t0 });
  const { core, bones } = await bodyOf(workspace), H0 = core.rest.H0, dt = 1 / 60;
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
      joints.push(jointsOf(character, bones));
    }
  } catch (err) {
    threw = `${frame < FRAMES ? `at frame ${frame}` : "creating the fighter"}: ${String((err as Error).message).split("\n")[0]}`;
  }
  add("runs", !threw, threw || `${FRAMES} frames, attack pressed on frames ${PRESSES.join(" and ")}`);
  add("finite", !threw && nonFinite === 0, nonFinite ? `${nonFinite} non-finite transforms` : "every bone finite every frame");
  if (threw) return done();
  // a hand's place toward the target (forward, the way the character faces) against the pelvis, and its speed there by
  // central differences, as the format's facts define a strike: raising the guard as a punch begins moves the hands
  // fast too, but up, not forward
  const ahead = (i: number, w: string) => sub(joints[i]!.pelvis!, joints[i]![w]!)[0];
  const speed = (i: number, w: string) => (ahead(Math.min(FRAMES - 1, i + 1), w) - ahead(Math.max(0, i - 1), w)) / ((Math.min(FRAMES - 1, i + 1) - Math.max(0, i - 1)) * dt);
  // each press's punch: the hand that reaches farthest forward after it, and its strike, the last time its forward
  // speed peaks (at half its fastest or more) before it is farthest out: the punch's own peak, not a fade into a
  // fighting stance before it, which can carry the hand forward faster
  const strikes = PRESSES.map((p) => {
    const end = Math.min(FRAMES, p + WINDOW), out = (w: string) => {
      let at = p;
      for (let i = p; i < end; i++) if (ahead(i, w) > ahead(at, w)) at = i;
      return at;
    };
    const w = ["wristL", "wristR"].reduce((a, b) => (ahead(out(b), b) > ahead(out(a), a) ? b : a)), far = out(w);
    let fastest = p;
    for (let i = p; i <= far; i++) if (speed(i, w) > speed(fastest, w)) fastest = i;
    let at = fastest;
    for (let i = far - 1; i > p; i--) {
      if (speed(i, w) >= speed(i - 1, w) && speed(i, w) >= speed(i + 1, w) && speed(i, w) >= 0.5 * speed(fastest, w)) {
        at = i;
        break;
      }
    }
    return { press: p, at, speed: speed(at, w) };
  });
  for (const s of strikes) add(`punches after the press on frame ${s.press}`, s.speed > H0, `its hand strikes forward at ${(s.speed / 1000).toFixed(2)} m/s against the pelvis, on frame ${s.at} (one hip height a second is ${(H0 / 1000).toFixed(2)})`);
  const inWindow = (p: number) => damage.filter((d) => d.frame >= p && d.frame < p + WINDOW);
  add("damage once per punch", strikes.every((s) => inWindow(s.press).length === 1) && damage.length === PRESSES.length, `damage on frames ${damage.map((d) => d.frame).join(", ") || "none"}`);
  for (const s of strikes) {
    const d = inWindow(s.press)[0];
    add(`damage when the punch on frame ${s.press} lands`, !!d && Math.abs(d.frame - s.at) <= 1, d ? `damage on frame ${d.frame}, its strike on frame ${s.at}` : "no damage");
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

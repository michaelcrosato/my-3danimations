// B1's grader (PLAN.md §7, WP-4.7): a workspace's player driven by scripted speeds on the starter's character (in
// proportion to its hip height, as the workspace's speeds.json lists them: D56), graded
// headless from what the character's bones do, not from what the player says. It checks that idle, walk and run switch
// by speed (the motion reported, the speed travelled, the feet stepping when walking, both feet leaving the ground
// at times when running and never when walking), that
// standing feet don't slide (the sensors' slide and skate under their fail levels on this body), that no bone goes
// non-finite, and that `npm run sheet` writes a non-blank sheet.png. The character is the grader's parameter: the
// workspace's character.glb, which the runner writes from a generator seed or a real rig.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "@m3a/core";
import { checks } from "@m3a/sensors";
import { bodyOf, jointsOf, pointsOf } from "../bones.ts";

/** One part of the script: a speed (m/s), for how long (s), and the motion it must play. */
export type Part = { speed: number; secs: number; motion: "idle" | "walk" | "run" };
/**
 * The speeds the grader asks of a character whose hips stand 1 m high (m/s), for how long (s), and the motion each must
 * play. A character is asked them in proportion to its hip height (`scriptFor`): a chibi with hips 0.44 m up walks at
 * 0.53 m/s, where 1.2 m/s would be more than two of its hip heights a second, a run for it (D56).
 */
export const SCRIPT: readonly Part[] = [
  { speed: 0, secs: 2, motion: "idle" },
  { speed: 1.2, secs: 3, motion: "walk" },
  { speed: 3.5, secs: 3, motion: "run" },
  { speed: 1.2, secs: 2, motion: "walk" },
  { speed: 0, secs: 2, motion: "idle" },
];
/** The script as a character with hips `H0` mm high is asked it: each speed in proportion, to the centimetre a second. */
export function scriptFor(H0: number): Part[] {
  return SCRIPT.map((p) => ({ ...p, speed: Math.round((p.speed * H0) / 10) / 100 }));
}
/** Seconds after each change of speed before it is judged. */
export const SETTLE = 0.75;

/** One check: its name, whether it passed and what it measured. */
export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}
/** A grade: pass when every check passes. */
export interface Grade {
  pass: boolean;
  checks: Check[];
  ms: number;
}

/** Grades the player in `workspace` (its src/player.ts and src/sheet.ts, on its character.glb). */
export async function gradeB1(workspace: string): Promise<Grade> {
  const t0 = performance.now(), checks_: Check[] = [], add = (name: string, ok: boolean, detail: string) => checks_.push({ name, ok, detail });
  // the grader's own copy, for the mapping from points to bones and the body's rest
  // heights from the body's own soles at rest (D145): read from y = 0, a generated character's foot 40 to 86 mm off its
  // floor read as standing, and a run's swinging feet as skating
  const { core, bones, sole } = await bodyOf(workspace);
  const script = scriptFor(core.rest.H0), scale = core.rest.H0 / 1000;
  const { loadCharacter } = (await import(pathToFileURL(join(workspace, "src/character.ts")).href)) as { loadCharacter(): Promise<never> };
  const { createPlayer } = (await import(pathToFileURL(join(workspace, "src/player.ts")).href)) as { createPlayer(c: unknown): Promise<{ motion: string; update(dt: number, i: { speed: number }): void }> };
  let character: { updateMatrixWorld(f: boolean): void; traverse(f: (o: { matrixWorld: { elements: number[] } }) => void): void; getObjectByName(n: string): never };
  let player: Awaited<ReturnType<typeof createPlayer>>;
  try {
    character = await loadCharacter();
    player = await createPlayer(character);
  } catch (err) {
    add("player", false, `createPlayer threw: ${String((err as Error).message).split("\n")[0]}`);
    return { pass: false, checks: checks_, ms: performance.now() - t0 };
  }
  // play the script, reading every bone each frame
  const dt = 1 / 60, frames: Float32Array[] = [], motions: string[] = [], judged: number[] = [];
  let nonFinite = 0, threw = "";
  for (const [k, s] of script.entries()) {
    const n = Math.round(s.secs / dt);
    for (let i = 0; i < n; i++) {
      try {
        player.update(dt, { speed: s.speed });
      } catch (err) {
        threw ||= `update threw at ${(frames.length * dt).toFixed(2)} s: ${String((err as Error).message).split("\n")[0]}`;
        break;
      }
      character.updateMatrixWorld(true);
      character.traverse((o) => {
        if (!o.matrixWorld.elements.every(Number.isFinite)) nonFinite++;
      });
      frames.push(pointsOf(jointsOf(character, bones, sole), core.rest));
      motions.push(player.motion);
      judged.push(i * dt >= SETTLE ? k : -1);
    }
    if (threw) break;
  }
  add("runs", !threw, threw || `${frames.length} frames played`);
  add("finite", nonFinite === 0, nonFinite ? `${nonFinite} non-finite transforms` : "every bone finite every frame");
  if (threw || nonFinite) return { pass: false, checks: checks_, ms: performance.now() - t0 };
  // the motion each part plays, the speed it travels and how far its feet swing against its pelvis
  const P = (X: Float32Array, n: string) => [X[format.IDX[n]! * 3]!, X[format.IDX[n]! * 3 + 1]!, X[format.IDX[n]! * 3 + 2]!];
  const swing: number[] = [];
  for (const [k, s] of script.entries()) {
    const idx = judged.flatMap((j, i) => (j === k ? [i] : []));
    const right = idx.filter((i) => motions[i] === s.motion).length / idx.length;
    add(`plays ${s.motion} at ${s.speed} m/s`, right >= 0.9, `${(right * 100).toFixed(0)}% of the judged frames report ${s.motion}`);
    const a = P(frames[idx[0]!]!, "pelvis"), b = P(frames[idx.at(-1)!]!, "pelvis"), v = Math.hypot(b[0] - a[0], b[1] - a[1]) / 1000 / ((idx.length - 1) * dt);
    add(`travels at ${s.speed} m/s`, s.speed === 0 ? v < 0.15 * scale : Math.abs(v - s.speed) <= 0.25 * s.speed, `${v.toFixed(2)} m/s`);
    let sw = 0;
    for (const i of idx.slice(1)) for (const f of ["ankleL", "ankleR"]) {
      const p0 = P(frames[i - 1]!, f), p1 = P(frames[i]!, f), q0 = P(frames[i - 1]!, "pelvis"), q1 = P(frames[i]!, "pelvis");
      sw += Math.hypot(p1[0] - p0[0] - (q1[0] - q0[0]), p1[1] - p0[1] - (q1[1] - q0[1]), p1[2] - p0[2] - (q1[2] - q0[2])) / dt / 1000;
    }
    swing.push(sw / (2 * (idx.length - 1)));
  }
  // the standing foot is still: whatever the speed, each step has moments where the lower foot's lowest point stands
  // in the world, slower than the sensors' bar for standing (half an H0 a second); a player that moves the body at one
  // speed and the feet at another (skating) has none, and its feet move too fast to read as standing at all
  const lowest = (X: Float32Array, s: string) => ["ankle", "ball", "toe"].map((p) => P(X, p + s)).reduce((a, b) => (b[2]! < a[2]! ? b : a));
  for (const [k, s] of script.entries()) {
    if (s.speed === 0) continue;
    const idx = judged.flatMap((j, i) => (j === k && i > 0 ? [i] : [])), still = core.rest.H0 * checks.STANCE.speed;
    const v = idx.map((i) => {
      const side = lowest(frames[i]!, "L")[2]! < lowest(frames[i]!, "R")[2]! ? "L" : "R", a = lowest(frames[i - 1]!, side), b = lowest(frames[i]!, side);
      return Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!) / dt;
    }).sort((x, y) => x - y), p10 = v[Math.floor(0.1 * (v.length - 1))]!;
    add(`a foot stands still at ${s.speed} m/s`, p10 < still, `the lower foot's slowest tenth moves ${(p10 / 1000).toFixed(2)} m/s or less (at most ${(still / 1000).toFixed(2)})`);
  }
  // flight: the share of frames with both feet off the ground (their lowest points over 4% of H0, the sensors' band)
  const flight = script.map((_, k) => {
    const idx = judged.flatMap((j, i) => (j === k ? [i] : [])), band = 0.04 * core.rest.H0;
    return idx.filter((i) => lowest(frames[i]!, "L")[2]! > band && lowest(frames[i]!, "R")[2]! > band).length / idx.length;
  });
  const [idle, walk] = [swing[0]!, swing[1]!];
  add("it steps when it walks", walk > 2 * idle, `feet against the pelvis: idle ${idle.toFixed(2)}, walk ${walk.toFixed(2)} m/s`);
  const walking = Math.max(...script.flatMap((s, k) => (s.motion === "walk" ? [flight[k]!] : []))), running = Math.min(...script.flatMap((s, k) => (s.motion === "run" ? [flight[k]!] : [])));
  add("it runs when it runs: both feet leave the ground running, never walking", running > 0.1 && walking < 0.02, `both feet off the ground: ${(running * 100).toFixed(0)}% of running frames, ${(walking * 100).toFixed(0)}% of walking ones`);
  // the feet while standing: the sensors' slide and skate, read in the world, under their fail levels on this body
  // (capture's worst; the package's own player reaches past the warn level, capture's p95, where a walk's foot lands
  // and rolls off unplanted: D54)
  const m = checks.motionOfFrames(frames, core.rest, { id: "B1" }), slide = checks.slide(m), lv = checks.levels(m, "slide"), ls = checks.levels(m, "skate");
  const worst = [...slide.findings, ...slide.skate.findings].sort((a, b) => b.value / checks.levels(m, b.metric).warn - a.value / checks.levels(m, a.metric).warn)[0];
  add("planted feet don't slide", slide.value < lv.fail && slide.skate.value < ls.fail, `slide ${slide.value.toFixed(0)} mm (fail ${lv.fail.toFixed(0)}), skate ${slide.skate.value.toFixed(1)} cm/s (fail ${ls.fail.toFixed(1)})${worst ? `; worst: ${worst.message.split(":").slice(0, 2).join(":")}` : ""}`);
  // the sheet
  const png = join(workspace, "sheet.png");
  rmSync(png, { force: true });
  let ran = "";
  try {
    execFileSync("npm", ["run", "--silent", "sheet"], { cwd: workspace, stdio: "pipe", timeout: 120_000 });
  } catch (err) {
    ran = String((err as { stderr?: Buffer }).stderr ?? (err as Error).message).trim().split("\n").slice(-1)[0] ?? "failed";
  }
  const bytes = existsSync(png) ? readFileSync(png) : null, isPng = !!bytes && bytes.length > 2000 && bytes.subarray(1, 4).toString() === "PNG";
  add("a sheet is produced", isPng, isPng ? `sheet.png, ${(bytes!.length / 1024).toFixed(0)} KB` : `npm run sheet ${ran ? `failed: ${ran}` : "wrote no sheet.png (or an empty one)"}`);
  return { pass: checks_.every((c) => c.ok), checks: checks_, ms: performance.now() - t0 };
}

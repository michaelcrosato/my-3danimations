// `node tools/procedural/carry.ts` (PLAN.md WP-6.2, D71): writes library/moves.json, the move model's moves in one unit
// system, from the pinned sources (npm run pins -- fetch puts them in .cache/src/): my-3d2dge's E.MOVES as my-3dge's
// frozen moves.json records them (spec/vectors/frozen/moves.json; the 24 the differential test checks), with
// shardfall's `about` lines (anim/moves.toml), and shardfall's seven moves my-3d2dge doesn't have. Angles become
// degrees; reach arm lengths (my-3d2dge: units over its 9.2-unit arm); heights, lunges and hops % of the hip height
// (my-3d2dge: units over its 11.6-unit hip height; shardfall: metres at its 0.0529 m a unit); kick heights, shares of
// the hip height, become %. Run it once when a source's moves change; --check compares the file.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../run/cli.ts";

type Src = Record<string, number | string | boolean | undefined>;
const r2 = (x: number) => Math.round(x * 100) / 100, r4 = (x: number) => Math.round(x * 10000) / 10000;
const deg = (rad: number) => r2((rad * 180) / Math.PI), pctU = (units: number) => r2((units / 11.6) * 100), pctM = (m: number) => pctU(m / 0.0529);

/** shardfall's moves.toml, read for the fields it uses: one table per [[move]], key = value lines. */
function toml(text: string): Src[] {
  const out: Src[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("[[move]]")) out.push({});
    const m = /^(\w+)\s*=\s*(.+)$/.exec(line.trim());
    if (m && out.length) out[out.length - 1]![m[1]!] = JSON.parse(m[2]!.replace(/\btrue\b/, "true").replace(/\bfalse\b/, "false")) as never;
  }
  return out;
}

const frozen = JSON.parse(readFileSync(join(ROOT, "spec/vectors/frozen/moves.json"), "utf8")) as { specs: Record<string, Src> };
const sf = toml(readFileSync(join(ROOT, ".cache/src/shardfall/anim/moves.toml"), "utf8"));
const about = new Map(sf.map((m) => [m.name as string, m.about as string]));
// my-3d2dge's fists (E.MOVES: "fists (jab leads with the left)"): the free hand guards the chin
const PUNCHES = ["jab", "cross", "hook", "uppercut", "haymaker", "elbow"];
// my-3d2dge's spin is shardfall's spinslash; shardfall's spin (a whirlwind) is named so here
const NAMES: Record<string, string> = { spin: "spinslash" };

const moves: Record<string, unknown>[] = [];
for (const [src, s] of Object.entries(frozen.specs)) {
  const name = NAMES[src] ?? src, kick = s.kick === true, n = (k: string) => s[k] as number | undefined;
  const reach = n("reach") ?? 7.5, r0 = n("r0") ?? reach, r1 = n("r1") ?? reach;
  const zRest = kick ? 0.1 : -7, z0 = n("z0") ?? zRest, z1 = n("z1") ?? z0, h = (z: number) => (kick ? r2(z * 100) : pctU(z));
  moves.push({
    name, about: about.get(name)!, hand: kick ? "kick" : s.hand === "L" ? "left" : s.hand === "both" ? "both" : "right", plane: s.plane === "side" ? "side" : "ground",
    from: deg(n("a0")!), to: deg(n("a1")!), ...(s.plane === "side" ? {} : { height: [h(z0), h(z1)] }), reach: [r4(r0 / 9.2), r4(r1 / 9.2)],
    // the wind draws the hand back to 0.75 of the scalar reach (7.5 units when a move gives only r0 and r1)
    ...(n("r0") !== undefined && n("reach") === undefined ? { windReach: r4((0.75 * 7.5) / 9.2) } : {}),
    wind: n("wind"), active: n("active"), recover: n("recover"), hold: n("hold") ?? 0.3, hit: 0.35,
    lunge: pctU(n("lunge") ?? (kick ? 0.4 : 1.2)), hop: pctU(n("hop") ?? 0), crouch: n("crouch") ?? (kick ? 0 : 0.15), lean: deg(n("lean") ?? (kick ? -0.22 : 0.3)), twist: n("twist") ?? 1,
    spin: s.spin === true, trail: s.blade !== 0, ...(PUNCHES.includes(name) ? { guard: true } : {}), ...(sf.find((m) => m.name === name)?.alt ? { alt: sf.find((m) => m.name === name)!.alt } : {}),
  });
}
// shardfall's own: its units (arm lengths above the shoulders, metres at 0.0529 m a unit, degrees, radians for lean)
const SF_ONLY: Record<string, string> = { spin: "whirlwind", roar: "roar", leap: "leap", lunge: "lunge", stir: "stir", stir_back: "stir_back", flick: "flick" };
for (const s of sf.filter((m) => SF_ONLY[m.name as string])) {
  const n = (k: string) => s[k] as number | number[] | undefined, pair = (v: number | number[] | undefined, d: number): [number, number] => (Array.isArray(v) ? [v[0]!, v[1]!] : [v ?? d, v ?? d]);
  const [h0, h1] = pair(n("height"), -0.76), [r0, r1] = pair(n("reach"), 0.82);
  moves.push({
    name: SF_ONLY[s.name as string], about: s.about, hand: s.hand ?? "right", plane: s.plane === "side" ? "side" : "ground", from: s.from ?? 0, to: s.to ?? 0,
    ...(s.plane === "side" ? {} : { height: [pctU(h0 * 9.2), pctU(h1 * 9.2)] }), reach: [r0, r1],
    wind: n("wind") ?? 0.06, active: n("active") ?? 0.1, recover: n("recover") ?? 0.18, hold: n("hold") ?? 0.3, hit: n("hit") ?? 0.35,
    lunge: pctM((n("lunge") as number | undefined) ?? 0.064), hop: pctM((n("hop") as number | undefined) ?? 0), crouch: n("crouch") ?? 0.15, lean: deg((n("lean") as number | undefined) ?? 0.3), twist: n("twist") ?? 1,
    spin: s.spin === true, trail: s.trail !== false, ...(s.alt ? { alt: SF_ONLY[s.alt as string] ?? s.alt } : {}),
  });
}
const about0 = "The move model's moves (PLAN.md WP-6.2, D71; @m3a/core procedural.moveClip): angles in degrees, reach in arm lengths, heights, lunges and hops in % of the hip height (a hand's height above the shoulders' centre, a kick's above the floor), times in seconds. From my-3d2dge's E.MOVES (the first 24, checked against spec/vectors/frozen/moves.json) and shardfall's anim/moves.toml (the about lines and the last 7), written by node tools/procedural/carry.ts. Shape: spec/schemas/moves.schema.json.";
const text = `{\n "about": ${JSON.stringify(about0)},\n "moves": [\n${moves.map((m) => `  ${JSON.stringify(m)}`).join(",\n")}\n ]\n}\n`;
const file = join(ROOT, "library/moves.json");
if (process.argv.includes("--check")) {
  const same = readFileSync(file, "utf8") === text;
  console.log(same ? "carry --check: library/moves.json is as the sources give it" : "carry --check: library/moves.json differs from what the sources give");
  process.exitCode = same ? 0 : 1;
} else {
  writeFileSync(file, text);
  console.log(`carry: wrote library/moves.json (${moves.length} moves)`);
}

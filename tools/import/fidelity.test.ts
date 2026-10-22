// F.13 (D135): the clips fitted within their own motion, against their captures. Core's encoder derives a nearly
// straight limb's bend from its root-to-end distance alone (packages/core/src/format/pose.ts), so a few millimetres of
// that distance flip a knee or elbow between straight and about 14° from key to key: with a clip's sway kept in more
// keys, that joint can move further than the capture's does, and on 26 of the 87 clips F.13 fitted again more than
// anything in the capture moves. The sensors pass them all. This pins which clips and how many, read from the pinned sources (run
// where they are fetched: `npm run import` fetches them), so the defect can't grow unnoticed; lower it when core's
// encoder holds such a bend (the follow-up D135 names).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { format, parseClip, type Rest } from "@m3a/core";
import { reach } from "../../packages/io/src/import.ts";
import { ROOT } from "../run/cli.ts";
import { CATALOGS, IMPORTS } from "./sets.ts";

const SETS = ["MESH2MOTION", "STYLE100_IDLE"];
const cached = existsSync(join(ROOT, ".cache/100style/verified.json")) && ["human-base-animations.glb", "human-addon-animations.glb", "human-mocap-animations.glb"].every((f) => existsSync(join(ROOT, ".cache/sources/mesh2motion", f)));
const SHOWN = format.POINTS.map((p, i) => (/^(index|pinky)/.test(p) ? -1 : i)).filter((i) => i >= 0);

/** Each re-fitted clip of `sets` (its capture reaches under twice the fit's 30 mm): its capture's reach, its decoded
 *  reach, and how much further than the capture's the decoded clip moves its worst body point (mm, from frame 0). */
function survey(sets: readonly string[]) {
  const rows: { id: string; cap: number; dec: number; excess: number; point: string }[] = [], K = format.P * 3;
  for (const spec of IMPORTS.filter((s) => sets.includes(s.set))) {
    const cat = JSON.parse(readFileSync(join(CATALOGS, spec.catalog), "utf8")), dir = join(ROOT, "library/sets", spec.set);
    const sources = (JSON.parse(readFileSync(join(dir, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources;
    for (const L of spec.read(cat)) for (const [name, cap] of Object.entries(L.clips)) {
      const file = join(dir, `${format.slug(name)}.json`);
      if (name.startsWith("_") || !existsSync(file) || reach(cap) >= 60) continue;
      const clip = parseClip(readFileSync(file, "utf8")), rest = sources[clip.restSrc]!.rest;
      const X0 = format.capSample(cap, 0, new Float32Array(K)), Y0 = format.pose(rest, clip, 0, new Float32Array(K)), X = new Float32Array(K), Y = new Float32Array(K);
      const capMove = new Float64Array(format.P), decMove = new Float64Array(format.P);
      let capFar = 0, decFar = 0;
      for (let f = 0; f < cap.n; f++) {
        format.capSample(cap, f / cap.fps, X);
        format.pose(rest, clip, f / cap.fps, Y);
        capFar = Math.max(capFar, format.error(X, X0));
        decFar = Math.max(decFar, format.error(Y, Y0));
        for (const p of SHOWN) {
          const i = p * 3;
          capMove[p] = Math.max(capMove[p]!, Math.hypot(X[i]! - X0[i]!, X[i + 1]! - X0[i + 1]!, X[i + 2]! - X0[i + 2]!));
          decMove[p] = Math.max(decMove[p]!, Math.hypot(Y[i]! - Y0[i]!, Y[i + 1]! - Y0[i + 1]!, Y[i + 2]! - Y0[i + 2]!));
        }
      }
      const worst = SHOWN.reduce((a, p) => (decMove[p]! - capMove[p]! > decMove[a]! - capMove[a]! ? p : a), SHOWN[0]!);
      rows.push({ id: clip.id, cap: capFar, dec: decFar, excess: decMove[worst]! - capMove[worst]!, point: format.POINTS[worst]! });
    }
  }
  return rows;
}

describe("the clips fitted within their own motion, against their captures (F.13, D135)", () => {
  it.skipIf(!cached)("move a knee or elbow 20 mm or more beyond the capture's on 17 clips and 1.5 times as far as the capture on 28: core's nearly straight limb bend, pinned until core holds it", () => {
    const rows = survey(SETS), wobbly = rows.filter((r) => r.excess >= 20).sort((a, b) => b.excess - a.excess);
    expect(rows.length).toBe(106);
    // 16 of the 87 clips F.13 fitted again; Glide (51.9 mm) has the keys it had before F.13, the artifact with them
    expect(wobbly.map((r) => `${r.id} ${r.point}`)).toEqual([
      "STYLE100_IDLE/Penguin_Idle kneeL", "STYLE100_IDLE/Angry_Idle kneeL", "STYLE100_IDLE/RightHop_Idle kneeR", "STYLE100_IDLE/Proud_Idle kneeL", "STYLE100_IDLE/OnPhoneLeft_Idle kneeL",
      "STYLE100_IDLE/LeftHop_Idle kneeL", "STYLE100_IDLE/GracefulArms_Idle elbowL", "STYLE100_IDLE/Tiptoe_Idle elbowR", "STYLE100_IDLE/Swimming_Idle elbowL", "STYLE100_IDLE/Rocket_Idle elbowL",
      "STYLE100_IDLE/ArmsAboveHead_Idle kneeR", "STYLE100_IDLE/OnToesCrouched_Idle elbowR", "STYLE100_IDLE/DragLeftLeg_Idle elbowL", "STYLE100_IDLE/Akimbo_Idle kneeR", "STYLE100_IDLE/DuckFoot_Idle elbowL",
      "STYLE100_IDLE/LimpLeft_Idle kneeL", "MESH2MOTION/Glide elbowR",
    ]);
    expect(Math.round(wobbly[0]!.excess)).toBe(54);
    expect(rows.filter((r) => r.excess > r.cap).length).toBe(26);
    expect(rows.filter((r) => r.dec > 1.5 * r.cap).length).toBe(28);
  }, 120_000);
});

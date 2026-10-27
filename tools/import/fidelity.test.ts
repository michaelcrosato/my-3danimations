// F.13 (D135): the clips fitted within their own motion, against their captures. Core's encoder read a nearly straight
// limb's bend from its root-to-end distance alone (packages/core/src/format/pose.ts), so the few millimetres the decoded
// hips or shoulders stand off the captured ones (whole percent of H0, whole degrees) flipped a knee or elbow between
// straight and about 15° from key to key: with a sway kept in more keys, round 1's re-fit moved one 20 to 54 mm beyond the
// capture's on 16 of its 87 clips. Round 2 encodes these clips with core's `steadyBend` (the bend read from the joint
// itself); F.19 with its `steadyRound` too (the hips' whole percent of H0 and the body's, chest's and head's whole
// degrees held at the key before's while the capture stays within 0.9 of them), which ended the six clips whose pelvis
// moved 5.5 to 7.7 mm beyond the capture's or whose joint was past it by under a millimetre. This pins the bound: no
// knee or elbow moves further beyond the capture's than the clip's own fit limit, no pelvis 4 mm beyond it; no snap at
// any shown point (the fit is `spaced`: no key one frame from a key, whose own rounding made the head, chest or a bent
// limb step); and how many clips decode to more than 1.5 times their capture's motion, and to less than 0.8 of it. Read
// from the pinned sources (run where they are fetched: `npm run import` fetches them).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { format, parseClip, type Rest } from "@m3a/core";
import type { Catalog } from "@m3a/io";
import { ROOT } from "../run/cli.ts";
import { CATALOGS, IMPORTS } from "./sets.ts";

/** The sets with clips the import fits within their own motion (every capture under 60 mm: 106 idles and poses, two
 *  locomotion loops). */
const SETS = ["MESH2MOTION", "STYLE100_RUN", "STYLE100_BACKRUN", "STYLE100_IDLE"];
/** The two locomotion loops whose captures reach less than 60 mm, read alone: every other clip of their sets reaches it
 *  (and `npm run import -- --check` holds their files), and reading those sets whole costs half a minute. */
const ONLY: Readonly<Record<string, readonly string[]>> = { STYLE100_RUN: ["WalkingStickLeft_Run"], STYLE100_BACKRUN: ["Flapping_RunBack"] };
const cached = existsSync(join(ROOT, ".cache/100style/verified.json")) && ["human-base-animations.glb", "human-addon-animations.glb", "human-mocap-animations.glb"].every((f) => existsSync(join(ROOT, ".cache/sources/mesh2motion", f)));
const SHOWN = format.POINTS.map((p, i) => (/^(index|pinky)/.test(p) ? -1 : i)).filter((i) => i >= 0);
const MID = ["kneeL", "kneeR", "elbowL", "elbowR"].map((n) => format.POINTS.indexOf(n)), PELVIS = format.POINTS.indexOf("pelvis");
const apart = (A: Float32Array, B: Float32Array, p: number) => Math.hypot(A[p * 3]! - B[p * 3]!, A[p * 3 + 1]! - B[p * 3 + 1]!, A[p * 3 + 2]! - B[p * 3 + 2]!);

/** A clip fitted within its own motion, against its capture (mm): the fit's limit, the capture's and the decoded reach,
 *  how much further than the capture's the decoded clip moves its worst knee or elbow and its pelvis (each from frame
 *  0), and its snaps: a shown body point moving more than the limit between two frames 1/30 s apart where the
 *  capture's doesn't. */
interface Row {
  id: string;
  limit: number;
  cap: number;
  dec: number;
  mid: string;
  midExcess: number;
  pelvisExcess: number;
  snaps: string[];
  frozen: boolean;
}

/** Each clip of `sets` the import fits within its own motion (`format.ownMotion`), from its file and its capture. */
function survey(sets: readonly string[]): Row[] {
  const rows: Row[] = [], K = format.P * 3;
  for (const spec of IMPORTS.filter((s) => sets.includes(s.set))) {
    const whole = JSON.parse(readFileSync(join(CATALOGS, spec.catalog), "utf8")) as Catalog, only = ONLY[spec.set], dir = join(ROOT, "library/sets", spec.set);
    const cat = only ? { ...whole, $pick: Object.fromEntries(Object.entries(whole.$pick ?? {}).filter(([n]) => only.includes(n))) } : whole;
    const sources = (JSON.parse(readFileSync(join(dir, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources;
    for (const L of spec.read(cat)) for (const [name, cap] of Object.entries(L.clips)) {
      const file = join(dir, `${format.slug(name)}.json`);
      if (name.startsWith("_") || !existsSync(file) || !format.ownMotion(cap, 30)) continue;
      const clip = parseClip(readFileSync(file, "utf8")), rest = sources[clip.restSrc]!.rest, limit = format.fitLimit(cap, 30);
      const X0 = format.capSample(cap, 0, new Float32Array(K)), Y0 = format.pose(rest, clip, 0, new Float32Array(K)), X = new Float32Array(K), Y = new Float32Array(K), Xp = new Float32Array(K), Yp = new Float32Array(K);
      const capMove = new Float64Array(format.P), decMove = new Float64Array(format.P), snaps: string[] = [];
      let capFar = 0, decFar = 0;
      for (let f = 0; f < cap.n; f++) {
        format.capSample(cap, f / cap.fps, X);
        format.pose(rest, clip, f / cap.fps, Y);
        capFar = Math.max(capFar, format.error(X, X0));
        decFar = Math.max(decFar, format.error(Y, Y0));
        for (const p of SHOWN) {
          capMove[p] = Math.max(capMove[p]!, apart(X, X0, p));
          decMove[p] = Math.max(decMove[p]!, apart(Y, Y0, p));
        }
        if (f > 0) for (const p of SHOWN) if (apart(Y, Yp, p) > limit && apart(X, Xp, p) <= limit) snaps.push(`${format.POINTS[p]} ${(f / cap.fps).toFixed(3)}`);
        Xp.set(X);
        Yp.set(Y);
      }
      const worst = MID.reduce((a, p) => (decMove[p]! - capMove[p]! > decMove[a]! - capMove[a]! ? p : a), MID[0]!);
      const k0 = JSON.stringify({ ...clip.keys[0], t: 0 });
      rows.push({ id: clip.id, limit, cap: capFar, dec: decFar, mid: format.POINTS[worst]!, midExcess: decMove[worst]! - capMove[worst]!, pelvisExcess: decMove[PELVIS]! - capMove[PELVIS]!, snaps, frozen: clip.keys.every((k) => JSON.stringify({ ...k, t: 0 }) === k0) });
    }
  }
  return rows;
}

describe("the clips fitted within their own motion, against their captures (F.13, D135)", () => {
  it.skipIf(!cached)("move no knee or elbow further beyond the capture's than their fit limit, but where the format's own resolution does; no shown point snaps", () => {
    const rows = survey(SETS), by = (r: Row) => r.id;
    expect(rows.length).toBe(108);
    // round 1: 17 clips 20 mm or more beyond, the worst 54 (Penguin_Idle's left knee); round 2 none 11 mm; F.19 none 9
    expect(Math.max(...rows.map((r) => r.midExcess))).toBeLessThan(9);
    // past the clip's own limit: none. Round 2 left six: four whose pelvis itself moved 5.5 to 7.7 mm beyond the
    // capture's (the hips' whole percent of H0, 9 to 10 mm, flipping from key to key), the knee riding on it, and two by
    // under a millimetre on a 3 mm limit (a whole degree flipping); F.19's steady rounding holds those whole numbers
    expect(rows.filter((r) => r.midExcess > r.limit).map(by)).toEqual([]);
    expect(Math.max(...rows.map((r) => r.pelvisExcess))).toBeLessThan(4);
    // no shown point snaps: the fit adds no key one frame from a key (`spaced`), so no two keys a frame apart round the
    // chest, head or a bent limb apart (before it: Aeroplane_Idle's headTop 10.9 mm in 1/30 s, Old_Idle's head 5.6,
    // Chicken_Idle's knee and head, ShieldedRight_Idle's elbows, neck and head)
    expect(rows.filter((r) => r.snaps.length).map((r) => `${r.id}: ${r.snaps.join(", ")}`)).toEqual([]);
    // round 1: 28 clips decoded to more than 1.5 times their capture's reach, the knees and elbows most; round 2 13, each
    // a capture that moves 11 mm or less whose head, feet or pelvis the format's whole degrees and percents moved a few
    // millimetres more; F.19 3, at most 1.6 times a capture of 6 to 7 mm (Cat_Idle, Lunge_Idle, Quail_Idle)
    expect(rows.filter((r) => r.dec > 1.5 * r.cap).map(by).sort()).toEqual(["STYLE100_IDLE/Cat_Idle", "STYLE100_IDLE/Lunge_Idle", "STYLE100_IDLE/Quail_Idle"]);
    expect(Math.max(...rows.filter((r) => !r.frozen).map((r) => r.dec / r.cap))).toBeLessThan(1.65);
    // the sway kept: every clip that moves decodes to 0.8 of its capture's reach or more but nine, the least 0.63
    // (OnPhoneRight_Idle; round 2 seven, the least 0.56): holding a whole number while the capture stays within it trims
    // a sway of under a unit as it trims a flip of one (84 of 103 within 0.8 to 1.25 times, 67 in round 2)
    const moving = rows.filter((r) => !r.frozen);
    expect(moving.filter((r) => r.dec < 0.8 * r.cap).length).toBe(9);
    expect(Math.min(...moving.map((r) => r.dec / r.cap))).toBeGreaterThan(0.62);
    // what the import keeps still is what its tags call a pose (MESH2MOTION's three aims, the held bow, the rest pose)
    expect(rows.filter((r) => r.frozen).map(by)).toEqual(["MESH2MOTION/Pistol_Aim_Down", "MESH2MOTION/Pistol_Aim_Neutral", "MESH2MOTION/Pistol_Aim_Up", "MESH2MOTION/Bow_Pull_Hold", "MESH2MOTION/Rest_Pose"]);
  }, 120_000);
});

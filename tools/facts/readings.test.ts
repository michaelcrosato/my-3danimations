// The contact reading a loop carries (D129, readings.ts): the rule reads the loop, its rest and its captured speed
// alone, never the rate sweep; it rejects a reading the planter pulls past 10% of H0 or that plants one foot, and keeps
// the file's with no captured speed; each of the 45 loops adopted carries its chosen reading, labelled, its pull and
// ground speed pinned; the 12 the sweep, the judge or QA turned down keep their detected contacts; and the importer's
// mechanism (the import spec's names, @m3a/library's withReading) writes each clip byte for byte and refuses a name it
// can't honour. T1 reads the rule on four loops; `npm run test:full -- tools/facts/readings.test.ts` (M3A_FULL=1) on all
// 126 it was run on: the 57 it chose another reading for, and the 69 that keep their file's.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clip as coreClip, contact, parseClip, serialize, type Clip } from "@m3a/core";
import { capturedSpeed, withReading } from "@m3a/library";
import { describe, expect, it } from "vitest";
import { specReading, unwritten } from "../import/import.ts";
import { IMPORTS } from "../import/sets.ts";
import { libraryClips } from "../qa/qa.ts";
import { ROOT } from "../run/cli.ts";
import { checkReading, chooseReading, pullOf, PULL_BAR } from "./readings.ts";

const FULL = process.env.M3A_FULL === "1";
const lib = new Map(libraryClips().map((c) => [c.clip.id, c]));
/** A library loop and its rest, its contacts as a detected reading reads them (its file's labelled ones set aside). */
const loop = (id: string) => {
  const { clip, rest } = lib.get(id)!;
  return { clip, R: rest, detected: { ...clip, contacts: { by: "detected" } } as Clip, captured: capturedSpeed(clip) };
};
/** The ground speed contactRoot reads from `contacts` (% of H0 a second). */
const ground = (clip: Clip, R: Parameters<typeof pullOf>[1], contacts = clip.contacts!) => (contact.contactRoot(clip, R, contacts).speed * 100) / R.H0;
/** Every loop an import spec names a reading for, by id, with the reading. */
const named = new Map<string, coreClip.ContactReading>(IMPORTS.flatMap((s) => Object.entries(s.contacts ?? {}).map(([slug, r]) => [`${s.set}/${slug}`, r] as const)));

describe("the rule (D129)", () => {
  it("reads the loop, its rest and its captured speed, never the rate sweep: its module imports core alone", () => {
    const src = readFileSync(join(import.meta.dirname, "readings.ts"), "utf8");
    expect([...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1])).toEqual(["@m3a/core"]);
    // its code, its comments aside, names no file, no baseline and no sweep
    expect(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")).not.toMatch(/rates|readFileSync|sweep|node:/);
    expect(chooseReading.length).toBe(3);
  });
  it("rejects a reading the planter pulls past 10% of H0: every reading of a rushed walk, whose toe dips 119 mm under the floor, so its file's stands", () => {
    const { detected, R, captured } = loop("STYLE100/Rushed_Walk"), r = chooseReading(detected, R, captured);
    expect([r.chosen, r.why, r.checks.length]).toEqual(["file", "no reading passes D108's bar: its file's stands", 13]);
    const pulled = r.checks.filter((c) => /the planter pulls an ankle/.test(c.fails ?? ""));
    expect(pulled.length).toBe(11);
    for (const c of pulled) expect(c.pulls["1"]! >= PULL_BAR, c.reading).toBe(true);
  });
  it("rejects a reading that plants one foot: a hop's every reading, so its file's stands", () => {
    const { detected, R, captured } = loop("STYLE100/LeftHop_Walk"), r = chooseReading(detected, R, captured);
    expect(r.chosen).toBe("file");
    expect(r.checks.map((c) => c.fails)).toEqual(r.checks.map(() => "1: one foot plants"));
  });
  it("keeps the file's reading where there is no captured speed to grade by: a keyed run", () => {
    const { clip, R } = loop("MESH2MOTION/Run_Female");
    expect(chooseReading(clip, R, undefined)).toEqual({ id: clip.id, checks: [], chosen: "file", why: "no captured speed: its file's reading stands" });
  });
  it("chooses, of the readings that pass, the one whose ground speed is nearest the captured speed: a run on its heels, whose file planted one foot", () => {
    const { detected, R, captured } = loop("STYLE100_RUN/Rocket_Run"), r = chooseReading(detected, R, captured);
    expect([captured, r.chosen, r.checks[0]!.fails]).toEqual([220, "sole-planted-half", "1: one foot plants"]);
    const ok = r.checks.filter((c) => !c.fails), best = r.checks.find((c) => c.reading === r.chosen)!;
    expect(ok.length).toBeGreaterThan(1);
    for (const c of ok) expect(Math.abs(c.ground - 220)).toBeGreaterThanOrEqual(Math.abs(best.ground - 220));
    // held at its own speed and each retimed one, both ways a retimed reading is read
    expect(Object.keys(best.pulls).sort()).toEqual(["0.5", "0.5 moved", "0.75", "0.75 moved", "1", "1.5", "1.5 moved", "2", "2 moved"]);
    expect(Math.max(...Object.values(best.pulls))).toBeLessThan(PULL_BAR);
    // the reading the file carries now is it, and the rule read again keeps it
    expect(best.contacts).toEqual({ ...lib.get("STYLE100_RUN/Rocket_Run")!.clip.contacts, by: "detected" });
    expect(checkReading(lib.get("STYLE100_RUN/Rocket_Run")!.clip, R, "file").fails).toBeUndefined();
  });
});

describe("the readings adopted (D129)", () => {
  // the loop, its reading, the planter's largest ankle pull over two cycles at its own speed (of H0), its ground speed
  // and its captured speed (% of H0 a second)
  const ADOPTED: [string, coreClip.ContactReading, number, number, number][] = [
      ["CMU_CURATED/Frankenstein_Walk_Loop", "sole-planted-quarter", 0.032, 43.8, 47],
      ["STYLE100/Balance_Walk", "planted-quarter", 0.01, 36.3, 36],
      ["STYLE100/Sweep_Walk", "planted-quarter", 0.026, 69.8, 69],
      ["STYLE100/TwoFootJump_Walk", "lower-quarter", 0.021, 54.7, 61],
      ["STYLE100_RUN/HandsInPockets_Run", "planted-half", 0.041, 177.8, 172],
      ["STYLE100_RUN/Lunge_Run", "planted-quarter", 0.045, 69.1, 71],
      ["STYLE100_RUN/Rocket_Run", "sole-planted-half", 0.021, 209.7, 220],
      ["STYLE100_RUN/WildLegs_Run", "planted-quarter", 0.023, 108.4, 119],
      ["STYLE100_BACK/DragRightLeg_WalkBack", "planted-quarter", 0.025, 48.6, 50],
      ["STYLE100_BACK/LeanRight_WalkBack", "planted-quarter", 0.021, 72.8, 71],
      ["STYLE100_BACK/Old_WalkBack", "planted-quarter", 0.013, 22.4, 23],
      ["STYLE100_BACK/Robot_WalkBack", "planted-quarter", 0.012, 28.2, 28],
      ["STYLE100_BACK/Rushed_WalkBack", "planted-half", 0.059, 119.8, 117],
      ["STYLE100_BACK/StartStop_WalkBack", "planted-quarter", 0.019, 18.7, 19],
      ["STYLE100_BACKRUN/DragLeftLeg_RunBack", "lower", 0.011, 98.4, 101],
      ["STYLE100_BACKRUN/Elated_RunBack", "lower-half", 0.062, 166.1, 189],
      ["STYLE100_BACKRUN/PendulumHands_RunBack", "lower", 0.021, 125, 131],
      ["STYLE100_BACKRUN/Rushed_RunBack", "planted-half", 0.05, 129.1, 129],
      ["STYLE100_BACKRUN/StartStop_RunBack", "planted-quarter", 0.018, 56, 57],
      ["STYLE100_SIDE/Balance_SideRight", "sole-planted-quarter", 0.033, 24.2, 27],
      ["STYLE100_SIDE/CrowdAvoidance_SideLeft", "planted-quarter", 0.02, 29, 31],
      ["STYLE100_SIDE/Flapping_SideRight", "planted-quarter", 0.015, 50.8, 52],
      ["STYLE100_SIDE/LeanBack_SideRight", "planted-quarter", 0.015, 42.6, 44],
      ["STYLE100_SIDE/LimpLeft_SideRight", "planted-quarter", 0.037, 41.4, 43],
      ["STYLE100_SIDE/LimpRight_SideLeft", "planted-quarter", 0.034, 54.2, 57],
      ["STYLE100_SIDE/Old_SideRight", "sole-planted-quarter", 0.016, 18.1, 18],
      ["STYLE100_SIDE/Quail_SideLeft", "sole-planted-quarter", 0.022, 41.5, 43],
      ["STYLE100_SIDE/Robot_SideLeft", "lower-quarter", 0.007, 32.5, 33],
      ["STYLE100_SIDE/Skip_SideRight", "planted-quarter", 0.021, 78.6, 75],
      ["STYLE100_SIDE/Strutting_SideLeft", "planted-quarter", 0.017, 36.5, 38],
      ["STYLE100_SIDE/TogetherStep_SideLeft", "planted-quarter", 0.019, 42.8, 45],
      ["STYLE100_SIDE/WalkingStickLeft_SideLeft", "sole-planted-quarter", 0.026, 32.3, 35],
      ["STYLE100_SIDE/WiggleHips_SideLeft", "lower-quarter", 0.027, 22.5, 24],
      ["STYLE100_SIDE/Zombie_SideLeft", "sole-planted-quarter", 0.018, 32.8, 37],
      ["STYLE100_SIDERUN/Akimbo_SideRunLeft", "planted-half", 0.069, 132.5, 126],
      ["STYLE100_SIDERUN/LawnMower_SideRunLeft", "planted-half", 0.04, 160.8, 127],
      ["STYLE100_SIDERUN/LimpRight_SideRunLeft", "sole-planted-half", 0.036, 118.6, 119],
      ["STYLE100_SIDERUN/Penguin_SideRunRight", "sole-planted", 0.03, 95.3, 95],
      ["STYLE100_SIDERUN/Proud_SideRunRight", "planted-half", 0.064, 149.7, 145],
      ["STYLE100_SIDERUN/RaisedLeftArm_SideRunLeft", "sole-planted-quarter", 0.016, 161.3, 159],
      ["STYLE100_SIDERUN/RaisedLeftArm_SideRunRight", "planted-half", 0.039, 164.4, 165],
      ["STYLE100_SIDERUN/Robot_SideRunRight", "planted-quarter", 0.017, 71.9, 72],
      ["STYLE100_SIDERUN/Rushed_SideRunLeft", "planted-half", 0.073, 160.4, 165],
      ["STYLE100_SIDERUN/Teapot_SideRunLeft", "planted-half", 0.048, 137.9, 133],
      ["STYLE100_SIDERUN/TwoFootJump_SideRunLeft", "planted-half", 0.055, 139.6, 129],
  ];
  it("names 45 loops in the import specs, each carrying its reading's contacts, labelled: both feet, held within 10% of H0, its ground speed as pinned", () => {
    expect([...named.entries()].sort()).toEqual(ADOPTED.map(([id, r]) => [id, r]).sort());
    for (const [id, reading, most, speed, captured] of ADOPTED) {
      const { clip, R } = loop(id), c = clip.contacts!;
      expect(c.by, id).toBe("labelled");
      expect({ ...c, by: "detected" }, id).toEqual(coreClip.readContacts(clip, R, reading));
      expect([Boolean(c.footL?.length && c.footR?.length), capturedSpeed(clip)], id).toEqual([true, captured]);
      expect(Math.abs(pullOf(clip, R, c) / R.H0 - most), id).toBeLessThan(0.001);
      expect(Math.abs(ground(clip, R) - speed), id).toBeLessThan(0.051);
    }
  });
  it("leaves the 12 the rate sweep, the judge or QA turned down with their detected contacts, the default chain's", () => {
    const rejected = ["QUATERNIUS_SHARDFALL/Crouch_Fwd_Loop", "STYLE100/OnPhoneRight_Walk", "STYLE100/Penguin_Walk", "STYLE100/Robot_Walk", "STYLE100/StartStop_Walk", "STYLE100_RUN/BigSteps_Run", "STYLE100_RUN/Teapot_Run", "STYLE100_RUN/WhirlArms_Run", "STYLE100_SIDE/Monk_SideLeft", "STYLE100_SIDE/Skip_SideLeft", "STYLE100_SIDERUN/Old_SideRunRight", "STYLE100_SIDERUN/WhirlArms_SideRunLeft"];
    for (const id of rejected) {
      const { clip } = loop(id);
      expect([named.has(id), clip.contacts!.by], id).toEqual([false, "detected"]);
    }
    // the 45 are the library's only labelled contacts
    const labelled = [...lib.values()].filter((c) => c.clip.contacts?.by === "labelled").map((c) => c.clip.id);
    expect(labelled.sort()).toEqual([...named.keys()].sort());
  });
  it.skipIf(!FULL)("chooses each adopted loop's reading again from its detected contacts, and the turned-down loops' as recorded", () => {
    const turnedDown: Record<string, string> = {
      "QUATERNIUS_SHARDFALL/Crouch_Fwd_Loop": "planted-quarter", "STYLE100/OnPhoneRight_Walk": "planted-quarter", "STYLE100/Penguin_Walk": "sole-lower-quarter", "STYLE100/Robot_Walk": "planted-quarter",
      "STYLE100/StartStop_Walk": "lower-quarter", "STYLE100_RUN/BigSteps_Run": "planted-half", "STYLE100_RUN/Teapot_Run": "sole-planted", "STYLE100_RUN/WhirlArms_Run": "sole-planted-quarter",
      "STYLE100_SIDE/Monk_SideLeft": "sole-lower-quarter", "STYLE100_SIDE/Skip_SideLeft": "planted-half", "STYLE100_SIDERUN/Old_SideRunRight": "lower", "STYLE100_SIDERUN/WhirlArms_SideRunLeft": "lower-quarter",
    };
    for (const [id, want] of [...named.entries(), ...Object.entries(turnedDown)]) {
      const { detected, R, captured } = loop(id);
      expect(chooseReading(detected, R, captured).chosen, id).toBe(want);
    }
  }, 600_000);
  it.skipIf(!FULL)("keeps the file's reading again on the 69 other loops it was run on: 12 with no captured speed, 20 with none that passes, 37 the nearest", () => {
    const kept = [
      "CMU_CURATED/Creep_Limp_Loop", "CMU_CURATED/Crouch_Walk_Loop", "CMU_CURATED/Limp_Loop",
      "CMU_CURATED/Wounded_Walk_Loop", "MESH2MOTION/Crouch_Walk", "MESH2MOTION/Run_Female", "MESH2MOTION/Sprint",
      "MESH2MOTION/Strafe_left", "MESH2MOTION/Strafe_right", "MESH2MOTION/Walk_Female", "MESH2MOTION/Walk_Stealth",
      "MESH2MOTION/Zombie_Walk_2", "QUATERNIUS_3D2DGE/Crouch_Fwd_Loop", "QUATERNIUS_3D2DGE/Walk_Loop",
      "QUATERNIUS_3D2DGE/Zombie_Walk_Fwd_Loop", "STYLE100/Akimbo_Walk", "STYLE100/InTheDark_Walk",
      "STYLE100/Kick_Walk", "STYLE100/LeftHop_Walk", "STYLE100/Old_Walk", "STYLE100/RightHop_Walk",
      "STYLE100/Rushed_Walk", "STYLE100/Swimming_Walk", "STYLE100/WiggleHips_Walk",
      "STYLE100_BACK/HandsBetweenLegs_WalkBack", "STYLE100_BACK/LeftHop_WalkBack", "STYLE100_BACK/Monk_WalkBack",
      "STYLE100_BACK/RightHop_WalkBack", "STYLE100_BACK/TwoFootJump_WalkBack", "STYLE100_BACK/WideLegs_WalkBack",
      "STYLE100_BACKRUN/DragRightLeg_RunBack", "STYLE100_BACKRUN/Kick_RunBack", "STYLE100_BACKRUN/LeftHop_RunBack",
      "STYLE100_BACKRUN/Morris_RunBack", "STYLE100_BACKRUN/Old_RunBack", "STYLE100_BACKRUN/RaisedLeftArm_RunBack",
      "STYLE100_BACKRUN/Skip_RunBack", "STYLE100_BACKRUN/WildArms_RunBack", "STYLE100_RUN/Dinosaur_Run",
      "STYLE100_RUN/Elated_Run", "STYLE100_RUN/OnHeels_Run", "STYLE100_RUN/Penguin_Run",
      "STYLE100_RUN/Roadrunner_Run", "STYLE100_RUN/SwingArmsRound_Run", "STYLE100_RUN/WildArms_Run",
      "STYLE100_SIDE/Balance_SideLeft", "STYLE100_SIDE/BigSteps_SideRight", "STYLE100_SIDE/Depressed_SideLeft",
      "STYLE100_SIDE/InTheDark_SideLeft", "STYLE100_SIDE/LeftHop_SideLeft", "STYLE100_SIDE/LeftHop_SideRight",
      "STYLE100_SIDE/LimpRight_SideRight", "STYLE100_SIDE/PigeonToed_SideLeft", "STYLE100_SIDE/RightHop_SideRight",
      "STYLE100_SIDE/SwingShoulders_SideLeft", "STYLE100_SIDE/TwoFootJump_SideLeft",
      "STYLE100_SIDE/TwoFootJump_SideRight", "STYLE100_SIDE/WalkingStickRight_SideLeft",
      "STYLE100_SIDE/WhirlArms_SideLeft", "STYLE100_SIDE/Zombie_SideRight",
      "STYLE100_SIDERUN/CrowdAvoidance_SideRunRight", "STYLE100_SIDERUN/LeanLeft_SideRunLeft",
      "STYLE100_SIDERUN/Morris_SideRunLeft", "STYLE100_SIDERUN/Morris_SideRunRight",
      "STYLE100_SIDERUN/Old_SideRunLeft", "STYLE100_SIDERUN/PendulumHands_SideRunLeft",
      "STYLE100_SIDERUN/RightHop_SideRunRight", "STYLE100_SIDERUN/Robot_SideRunLeft",
      "STYLE100_SIDERUN/Skip_SideRunRight",
    ];
    const why = { "no captured speed": 0, "no reading passes": 0, nearest: 0 };
    for (const id of kept) {
      const { detected, R, captured } = loop(id), r = chooseReading(detected, R, captured);
      expect(r.chosen, id).toBe("file");
      why[r.why.startsWith("no captured speed") ? "no captured speed" : r.why.startsWith("no reading passes") ? "no reading passes" : "nearest"]++;
    }
    expect([kept.length, why]).toEqual([69, { "no captured speed": 12, "no reading passes": 20, nearest: 37 }]);
  }, 600_000);
});

describe("the importer's mechanism (D129)", () => {
  it("writes each adopted loop byte for byte from its motion and its import spec's name (withReading), the name in its set's record", () => {
    for (const [id, reading] of named) {
      const [set, slug] = id.split("/") as [string, string], file = readFileSync(join(ROOT, "library/sets", set, `${slug}.json`), "utf8"), { clip, rest } = lib.get(id)!;
      expect(serialize(withReading({ ...clip, contacts: { by: "detected" } }, rest, reading)), id).toBe(file);
      expect(serialize(withReading(parseClip(file), rest, reading)), id).toBe(file);
    }
    for (const spec of IMPORTS) {
      const clips = (JSON.parse(readFileSync(join(ROOT, "library/sets", spec.set, "_import.json"), "utf8")) as { clips: Record<string, { contacts?: string }> }).clips;
      const recorded = Object.fromEntries(Object.entries(clips).filter(([, c]) => c.contacts).map(([s, c]) => [s, c.contacts]));
      expect(recorded, spec.set).toEqual(spec.contacts ?? {});
    }
  });
  it("refuses a name on an adopted clip, a one-shot, a clip with its own root or one tagged off its feet, a reading that doesn't stand, and a name for a clip the set doesn't write; the record's schema names core's readings", () => {
    const { clip, R } = loop("STYLE100_RUN/Rocket_Run");
    expect(specReading(clip, R, "planted", true)).toEqual({ error: "the import spec names its contacts' reading (planted), but the owner adopted it with its own: drop the name" });
    expect(specReading({ ...clip, loop: false }, R, "planted", false)).toEqual({ error: `the import spec's contacts "planted": ${clip.id}: a named contact reading reads a loop; a one-shot keeps its detected contacts (D108)` });
    expect("error" in specReading({ ...clip, keys: clip.keys.map((k) => ({ ...k, root: [0, 0] })) }, R, "planted", false)).toBe(true);
    expect("clip" in specReading(clip, R, "sole-planted-half", false)).toBe(true);
    expect(unwritten({ contacts: { Rocket_Run: "planted", Gone_Run: "lower" } }, new Map([["Rocket_Run.json", ""]]))).toEqual(["Gone_Run"]);
    // a reading that plants no foot, and a loop tagged off its feet: each an error of the import, not a file written
    const idle = loop("CMU_CURATED/Waiting_Loop"), climb = loop("MESH2MOTION/Climb_Wall");
    expect(specReading(idle.clip, idle.R, "planted", false)).toEqual({ error: `the import spec's contacts "planted": CMU_CURATED/Waiting_Loop: the reading "planted" doesn't stand (both feet plant, a foot down a fifth of the loop: D108), so it isn't written` });
    expect(specReading(climb.clip, climb.R, "sole-lower", false)).toEqual({ error: `the import spec's contacts "sole-lower": MESH2MOTION/Climb_Wall: tagged climb, off its feet: it keeps the strict reading, no named one (D108)` });
    const schema = JSON.parse(readFileSync(join(ROOT, "tools/import/import.schema.json"), "utf8")) as { properties: { clips: { additionalProperties: { properties: { contacts: { enum: string[] } } } } } };
    expect(schema.properties.clips.additionalProperties.properties.contacts.enum).toEqual([...coreClip.CONTACT_READINGS]);
  });
});

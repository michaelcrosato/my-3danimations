// The clip runtime (WP-2.2): sample() decodes like the tier 2 vectors; events fire once each, in order, loop-aware;
// a turning root samples continuously and composes over loop cycles; contacts wrap; and measureFacts agrees with the
// 20 clips of packages/core/fixtures/facts-truth.json, whose expectations come from sources independent of this code;
// its fallbacks (D104, D108, D122, D127) on the library loops they read again and on those they leave.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contactRoot, contactsAt, detectContacts, events, keyAt, measureFacts, OFF_FEET, parseClip, plant, retime, rootAt, rootDelta, sample, type Clip, type ClipEvent, type Key, type Rest } from "./all.ts";
import { motionOf, P } from "./contact-data.ts";
import { loadTier2, tier2Sets } from "../../../spec/conformance/runner/vectors.ts";

const LIB = join(import.meta.dirname, "../../../library/sets");
/** A library clip and the rest it decodes on. */
function libClip(id: string): { clip: Clip; R: Rest } {
  const [set, name] = id.split("/");
  const manifest = JSON.parse(readFileSync(join(LIB, set!, "_set.json"), "utf8"));
  const clip = parseClip(readFileSync(join(LIB, set!, `${name}.json`), "utf8"));
  return { clip, R: manifest.sources[clip.restSrc].rest as Rest };
}
/** A minimal key: standing, with extra fields. */
const key = (t: number, extra: Record<string, unknown> = {}): Key =>
  ({ t, hips: [0, 0, 100], body: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, -100, 0, 0], armR: [0, 0, -100, 0, 0], legL: [0, 0, -100, 0, 0], legR: [0, 0, -100, 0, 0], ...extra }) as Key;

describe("sample", () => {
  it("decodes like the tier 2 vectors: exactly (to the µm they store) at keys, within 0.001 mm between", () => {
    const out = new Float32Array(108);
    let n = 0;
    for (const set of tier2Sets()) {
      const v = loadTier2(set);
      for (const c of Object.values(v.clips)) {
        const R = v.bodies[c.restSrc] as unknown as Rest;
        for (const [list, exact] of [[c.keys, true], [c.between, false]] as const) {
          for (const s of list) {
            sample(c.clip as never, s.t, R, out);
            for (let i = 0; i < 108; i++) {
              const d = Math.abs(out[i]! * 1000 - s.at[i]!);
              if (exact ? Math.round(out[i]! * 1000) !== s.at[i] : !(d <= 1)) throw new Error(`${set} t ${s.t} [${i}]: ${out[i]} mm vs ${s.at[i]! / 1000}`);
            }
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(7000);
  });
  it("wraps a loop, holds a one-shot's ends, and interpolates every number linearly", () => {
    const clip = { dur: 1, loop: true, keys: [key(0, { hips: [0, 0, 100] }), key(1, { hips: [0, 0, 80] })] };
    expect(keyAt(clip, 0.25).hips).toEqual([0, 0, 95]);
    expect(keyAt(clip, 1.25).hips).toEqual([0, 0, 95]);
    expect(keyAt({ ...clip, loop: false }, 7).hips).toEqual([0, 0, 80]);
    expect(keyAt({ ...clip, loop: false }, -1).hips).toEqual([0, 0, 100]);
  });
});

describe("root motion", () => {
  const turning = (deg: number, travel = 0) => ({ dur: 2, loop: true, keys: [key(0, { yaw: 0, root: [0, 0] }), key(1, { yaw: deg / 2, root: [travel / 2, 0] }), key(2, { yaw: deg, root: [travel, 0] })] });
  for (const deg of [90, 360, 720]) {
    it(`a yaw turning through ${deg}° samples with no jump at ±180°`, () => {
      const c = turning(deg);
      let last = keyAt(c, 0).yaw as number, worst = 0;
      for (let t = 0.001; t < 2; t += 0.001) {
        const y = keyAt(c, t).yaw as number;
        worst = Math.max(worst, Math.abs(y - last));
        last = y;
      }
      expect(worst).toBeLessThan((deg / 2) * 0.0011);
      expect(rootAt(c, 2).yaw).toBe(deg);
    });
  }
  it("rootDelta across a loop's seam carries the cycle's turn and travel on", () => {
    const c = turning(90, 100);
    const d = rootDelta(c, 1.8, 2.2);
    expect(d.yaw).toBeCloseTo(18, 9); // 0.2 s of the end of a cycle and 0.2 s of the next, 45°/s
    // four cycles of "forward 100 while turning right 90°" come back to the start, facing ahead again (turned 360°)
    const four = rootAt(c, 8);
    expect([four.forward, four.right, four.yaw].map((x) => Math.round(x * 1e6) / 1e6 + 0)).toEqual([0, 0, 360]);
    expect(rootDelta(c, 0, 8).yaw).toBe(360);
    // backwards in time is the inverse
    const back = rootDelta(c, 2.2, 1.8);
    expect(back.yaw).toBeCloseTo(-18, 9);
    // a one-shot holds: nothing moves past its end
    expect(rootDelta({ ...c, loop: false }, 2, 5)).toEqual({ forward: 0, right: 0, yaw: 0 });
  });
  it("a straight clip's travel is its root, in the start frame", () => {
    const c = { dur: 1, loop: false, keys: [key(0, { root: [10, -4] }), key(1, { root: [60, 6] })] };
    expect(rootAt(c, 1)).toEqual({ forward: 50, right: 10, yaw: 0 });
    expect(rootDelta(c, 0.5, 1)).toEqual({ forward: 25, right: 5, yaw: 0 });
  });
});

describe("events", () => {
  const ev = (t: number, name: string): ClipEvent => ({ t, name });
  const loop = { dur: 1, loop: true, keys: [key(0), key(1)], events: [ev(0, "start"), ev(0.5, "step"), ev(1, "end")] };
  it("an event on a loop's boundary fires once per cycle, and windows that meet fire each occurrence once", () => {
    const steps: string[] = [];
    for (let i = 0; i < 40; i++) for (const f of events(loop, i * 0.1, (i + 1) * 0.1)) steps.push(`${f.event.name}@${f.t.toFixed(1)}`);
    // "start" (t 0) and "end" (t = dur) are the same moment of a loop: each fires at 0, 1, 2 and 3
    expect(steps.filter((s) => s.startsWith("start"))).toEqual(["start@0.0", "start@1.0", "start@2.0", "start@3.0"]);
    expect(steps.filter((s) => s.startsWith("end"))).toEqual(["end@0.0", "end@1.0", "end@2.0", "end@3.0"]);
    expect(steps.filter((s) => s.startsWith("step")).length).toBe(4);
    expect(events(loop, 0.4, 2.6).map((f) => `${f.event.name}@${f.t}`)).toEqual(["step@0.5", "start@1", "end@1", "step@1.5", "start@2", "end@2", "step@2.5"]);
  });
  it("plays backwards newest first, fires a one-shot's end once the playhead passes it, and nothing outside", () => {
    expect(events(loop, 1.6, 0.4).map((f) => `${f.event.name}@${f.t}`)).toEqual(["step@1.5", "start@1", "end@1", "step@0.5"]);
    const once = { ...loop, loop: false };
    expect(events(once, 0.9, 1).map((f) => f.event.name)).toEqual([]);
    expect(events(once, 1, 1.1).map((f) => f.event.name)).toEqual(["end"]);
    expect(events(once, 1.1, 5)).toEqual([]);
    expect(events({ ...once, events: undefined }, 0, 1)).toEqual([]);
  });
});

describe("contacts", () => {
  it("reads labelled intervals, a loop's wrapping one included", () => {
    const clip = { dur: 1, loop: true, keys: [key(0), key(1)], contacts: { by: "labelled" as const, footL: [[0.1, 0.4]] as [number, number][], footR: [[0.6, 1.2]] as [number, number][] } };
    expect(contactsAt(clip, 0.3)).toEqual({ footL: true, footR: false, handL: false, handR: false });
    expect(contactsAt(clip, 0.05)).toMatchObject({ footL: false, footR: true });
    expect(contactsAt(clip, 1.15)).toMatchObject({ footL: true, footR: true });
    expect(contactsAt({ ...clip, contacts: undefined }, 0.2)).toEqual({ footL: false, footR: false, handL: false, handR: false });
  });
  it("detects a walk's alternating feet with hysteresis, each foot planted once a cycle", () => {
    const { clip, R } = libClip("QUATERNIUS_3D2DGE/Walk_Loop");
    const c = measureFacts(clip, R).contacts;
    expect(c.by).toBe("detected");
    expect([c.footL?.length, c.footR?.length, c.handL, c.handR]).toEqual([1, 1, undefined, undefined]);
    for (const [a, b] of [...c.footL!, ...c.footR!]) expect(b - a).toBeGreaterThan(0.4 * clip.dur);
  });
  // D104, narrowed by D108: the library loops that had no contact. A keyed run in place whose planted foot drifts too
  // fast for the world refinement is read again with still at half the body's speed, kept when both feet plant; a body
  // on its heels is read by its whole sole, and so is a run on its heels once every other reading is erased (D122); a
  // loop whose refinement keeps one foot a moment after a height pass that held both feet down throughout is read
  // again too, where the planter holds the reading (D127); a one-shot, a clip with its own root, a clip tagged off its
  // feet and a loop only one foot of which holds still keep the strict reading, none.
  /** The planter's largest ankle pull over two cycles (mm), planting `contacts` (the measured ones unless given): where
   *  it holds a planted foot against where the motion has it. */
  const pull = (clip: Clip, R: Rest, contacts = measureFacts(clip, R).contacts) => {
    const m = motionOf(clip, R, contacts);
    let most = 0;
    for (let t = 0; t <= 2 * clip.dur; t += 1 / 60) {
      const X = plant(m, t), Y = m.points(t);
      for (const p of ["ankleL", "ankleR"]) most = Math.max(most, Math.hypot(...P(X, p).map((x, k) => x - P(Y, p)[k]!)));
    }
    return most;
  };
  it("a keyed run in place keeps a contact a step, its ground speed within 5% of its measured speed", () => {
    const { clip, R } = libClip("MESH2MOTION/Run_Female");
    const f = measureFacts(clip, R), c = f.contacts;
    expect([c.footL?.length, c.footR?.length]).toEqual([1, 1]);
    for (const [a, b] of [...c.footL!, ...c.footR!]) expect(b - a).toBeLessThan(0.25 * clip.dur);
    const own = (contactRoot(clip, R, c).speed * 100) / R.H0;
    expect(Math.abs(own / f.speed! - 1)).toBeLessThan(0.05);
  });
  it("a retargeted run backward is read again by its lower foot: both feet, its ground speed within 5% of its captured one", () => {
    const { clip, R } = libClip("STYLE100_BACKRUN/Waving_RunBack");
    const c = measureFacts(clip, R).contacts;
    expect([c.footL?.length, c.footR?.length]).toEqual([1, 1]);
    expect(Math.abs((contactRoot(clip, R, c).speed * 100) / R.H0 / 123 - 1)).toBeLessThan(0.05);
  });
  it("every loop the fallbacks give contacts plants them where the planter holds the feet within 10% of H0", () => {
    for (const id of ["MESH2MOTION/Run_Female", "STYLE100_BACKRUN/Waving_RunBack", "STYLE100_IDLE/OnHeels_Idle", "STYLE100_SIDE/OnHeels_SideLeft", "STYLE100_SIDE/OnHeels_SideRight", "STYLE100_RUN/OnHeels_Run"]) {
      const { clip, R } = libClip(id);
      expect(pull(clip, R) / R.H0, id).toBeLessThan(0.1);
    }
  });
  it("a body standing on its heels, toes raised, is read by its whole sole, the same contacts and travel its file holds", () => {
    const { clip, R } = libClip("STYLE100_IDLE/OnHeels_Idle");
    expect(detectContacts(clip, R)).toEqual({ by: "detected" });
    for (const id of ["STYLE100_IDLE/OnHeels_Idle", "STYLE100_SIDE/OnHeels_SideLeft", "STYLE100_SIDE/OnHeels_SideRight"]) {
      const { clip, R } = libClip(id), f = measureFacts(clip, R);
      expect(f.contacts, id).toEqual(clip.contacts);
      expect(f.travel, id).toEqual((clip.facts as { travel?: number[] }).travel);
    }
    const left = libClip("STYLE100_SIDE/OnHeels_SideLeft");
    expect(measureFacts(left.clip, left.R).travel).toEqual([7.8, -54.5]);
  });
  it("a run on its heels, its toes 5 to 6% of H0 up, is read again by its whole sole: a step a foot, held within 5% of H0, its ground speed within 15% of its captured one and its travel within 5%", () => {
    const { clip, R } = libClip("STYLE100_RUN/OnHeels_Run"), f = measureFacts(clip, R), c = f.contacts, captured = (clip.facts as { speed: number }).speed;
    expect(captured).toBe(127);
    // ankle, ball and toe see both feet down at some point (so the sole fallback for no contact at all doesn't read it)
    const toes = detectContacts(clip, R);
    expect([toes.footL?.length, toes.footR?.length]).toEqual([1, 1]);
    expect(c).toEqual(clip.contacts);
    expect([c.footL?.length, c.footR?.length]).toEqual([1, 1]);
    expect(pull(clip, R) / R.H0).toBeLessThan(0.05);
    expect(Math.abs((contactRoot(clip, R, c).speed * 100) / R.H0 / captured - 1)).toBeLessThan(0.15);
    expect(f.travel).toEqual((clip.facts as { travel?: number[] }).travel);
    expect(Math.abs(Math.hypot(...f.travel!) / clip.dur / captured - 1)).toBeLessThan(0.05);
    // tagged off its feet, played once, or under a root of its own that stands still, it keeps the strict reading
    expect(measureFacts({ ...clip, tags: ["fly"] }, R).contacts).toEqual({ by: "detected" });
    expect(measureFacts({ ...clip, loop: false }, R).contacts).toEqual({ by: "detected" });
    expect(measureFacts({ ...clip, keys: clip.keys.map((k) => ({ ...k, root: [0, 0] })) }, R).contacts).toEqual({ by: "detected" });
  });
  it("the sole reads again only a loop nothing else plants: a run, a run backward, a walk and a run on its heels' backward twin keep the contacts their files hold", () => {
    for (const id of ["MESH2MOTION/Run_Female", "STYLE100_BACKRUN/Waving_RunBack", "QUATERNIUS_3D2DGE/Walk_Loop", "STYLE100_BACKRUN/OnHeels_RunBack"]) {
      const { clip, R } = libClip(id);
      expect(clip.contacts?.footL ?? clip.contacts?.footR, id).toBeTruthy();
      expect(measureFacts(clip, R).contacts, id).toEqual(clip.contacts);
    }
  });
  /** The share of a clip's samples (60 a second) with a foot down by `contacts`, or both feet with `both`. */
  const downShare = (clip: Clip, contacts: Clip["contacts"], both = false) => {
    const n = Math.ceil(clip.dur * 60);
    let down = 0;
    for (let i = 0; i <= n; i++) {
      const at = contactsAt({ ...clip, contacts }, (i * clip.dur) / n);
      if (both ? at.footL && at.footR : at.footL || at.footR) down++;
    }
    return down / (n + 1);
  };
  /** A library loop at `speed`: as its file holds it, or retimed as a game retimes it (`playable` measures it again),
   *  with its captured speed scaled. */
  const atSpeed = (id: string, speed: number) => {
    const { clip, R } = libClip(id);
    return { clip: speed === 1 ? clip : retime(clip, { speed }), R, captured: (clip.facts as { speed: number }).speed * speed, name: `${id} ×${speed}` };
  };
  it("a loop whose height pass held both feet down throughout and whose refinement kept one foot a moment is read again: both feet, held within 10% of H0, its ground speed near its captured one, at its own speed and retimed (D127)", () => {
    // the loop and its speed, the share of the cycle a foot is down, the planter's pull (of H0) and the ground speed
    // (of its captured speed) its contacts give; before D127 one foot held 5 to 18% of the cycle, the ground speed 0.39
    // to 0.87 of the captured
    const read: [string, number, number, number, number][] = [
      ["STYLE100_RUN/Robot_Run", 1, 0.861, 0.016, 0.81],
      ["STYLE100_RUN/Swimming_Run", 1, 1, 0.043, 1.05],
      // retimed, the planter holds the reading too
      ["STYLE100_RUN/Robot_Run", 1.5, 0.917, 0.016, 0.79],
      ["STYLE100_SIDERUN/ArmsBehindBack_SideRunRight", 2, 0.864, 0.08, 0.91],
    ];
    for (const [id, speed, down, most, ground] of read) {
      const { clip, R, captured, name } = atSpeed(id, speed), c = measureFacts(clip, R).contacts;
      expect(downShare(clip, detectContacts(clip, R), true), name).toBe(1);
      if (speed === 1) expect(c, name).toEqual(clip.contacts);
      expect([Boolean(c.footL?.length), Boolean(c.footR?.length), Math.abs(downShare(clip, c) - down) < 0.002], name).toEqual([true, true, true]);
      expect(Math.abs(pull(clip, R, c) / R.H0 - most), name).toBeLessThan(0.002);
      expect(Math.abs((contactRoot(clip, R, c).speed * 100) / R.H0 / captured - ground), name).toBeLessThan(0.01);
    }
  });
  it("a moment's contact is read again only after a height pass that held both feet down throughout, only of one foot under a fifth of the loop, and only where the planter holds the reading: a keyed sprint, a start-stop walk, two runs and a side run that lift a foot past the band, a run backward stepping both feet a moment, a hop, and a run and a side run retimed keep their readings (D127)", () => {
    // the loop and its speed, its height pass's share of the cycle with both feet down, the feet its contacts plant and
    // their share
    const keep: [string, number, number, number, number][] = [
      // its height pass alternates feet: the body's velocity it gives is the body's, and its keyed standing foot moves
      ["MESH2MOTION/Sprint", 1, 0, 1, 0.098],
      // a foot down throughout, both 95% of it: read again, its judge's fail would move from the knight to gen-0
      ["STYLE100/StartStop_Walk", 1, 0.954, 1, 0.06],
      // runs whose height pass lifts a foot past the band a third and a fifth of the cycle
      ["STYLE100_BACKRUN/Elated_RunBack", 1, 0.632, 1, 0.053],
      ["STYLE100_RUN/Penguin_Run", 1, 0.788, 1, 0.182],
      // both feet, each a moment: a reading of a run backward, its flight between
      ["STYLE100_BACKRUN/DragLeftLeg_RunBack", 1, 1, 2, 0.179],
      // one foot, a third of the cycle (read again, it fails 12 more rate-sweep rows), and a fifth at twice its speed
      ["STYLE100_SIDERUN/Penguin_SideRunLeft", 1, 0.903, 1, 0.29],
      ["STYLE100_SIDERUN/Penguin_SideRunLeft", 2, 0.813, 1, 0.188],
      // a hop: one foot, down most of the cycle
      ["STYLE100_BACK/RightHop_WalkBack", 1, 0, 1, 0.649],
      // retimed: one foot down past a fifth of the cycle; one under it, read again pulled 10.1% of H0 by the planter
      ["STYLE100_RUN/RaisedRightArm_Run", 2, 1, 1, 0.227],
      ["STYLE100_SIDERUN/Followed_SideRunRight", 2, 1, 1, 0.158],
    ];
    for (const [id, speed, heights, feet, down] of keep) {
      const { clip, R, name } = atSpeed(id, speed), c = measureFacts(clip, R).contacts;
      expect(Math.abs(downShare(clip, detectContacts(clip, R), true) - heights), name).toBeLessThan(0.002);
      if (speed === 1) expect(c, name).toEqual(clip.contacts);
      expect([[c.footL, c.footR].filter((x) => x?.length).length, Math.abs(downShare(clip, c) - down) < 0.002], name).toEqual([feet, true]);
    }
    // where the refinement left nothing (D104's case) a reading again replaces none, and isn't held to the planter:
    // Rushed_Walk at 1.5 keeps both feet (the planter pulls 12.2% of H0; none would play still, its ground speed 0)
    const rushed = atSpeed("STYLE100/Rushed_Walk", 1.5), r = measureFacts(rushed.clip, rushed.R).contacts;
    expect([Boolean(r.footL?.length), Boolean(r.footR?.length), Math.abs(downShare(rushed.clip, r) - 0.717) < 0.002]).toEqual([true, true, true]);
  });
  it("a loop whose feet the planter can't hold has none: a run on the spot under its own root, a stance or walk one foot of which holds still", () => {
    const run = libClip("MESH2MOTION/Run_Anime");
    expect(measureFacts(run.clip, run.R).contacts).toEqual({ by: "detected" });
    for (const id of ["MESH2MOTION/Run_Stealth", "CMU_CURATED/Boxing_Guard_Loop", "STYLE100/WideLegs_Walk", "STYLE100_BACKRUN/Drunk_RunBack"]) {
      const { clip, R } = libClip(id);
      expect(measureFacts(clip, R).contacts, id).toEqual({ by: "detected" });
    }
  });
  it("each loop still without contacts is answered in library/baselines/qa.json, with the planter's pull on the feet the height pass finds and, captured, the ground speed they give (D122)", () => {
    const unplanted = JSON.parse(readFileSync(join(LIB, "../baselines/qa.json"), "utf8")).unplanted as Record<string, string>;
    // the loop, the planter's pull on the height pass's contacts (of H0), and against its captured speed the ground speed they give
    const unheld: [string, number, number?][] = [["CMU_CURATED/Boxing_Guard_Loop", 0.16], ["MESH2MOTION/Run_Anime", 1.48], ["MESH2MOTION/Run_Stealth", 1.25], ["STYLE100/WideLegs_Walk", 0.13, 0.94], ["STYLE100_BACKRUN/Drunk_RunBack", 0.3, 0.61]];
    expect(Object.keys(unplanted).sort()).toEqual(unheld.map(([id]) => id));
    for (const [id, most, ground] of unheld) {
      const { clip, R } = libClip(id), heights = detectContacts(clip, R);
      expect(unplanted[id], id).toMatch(/\(D108, D122\)$/);
      expect(heights.footL?.length && heights.footR?.length, id).toBeTruthy();
      expect(Math.abs(pull(clip, R, heights) / R.H0 - most), id).toBeLessThan(0.01);
      if (ground !== undefined) expect(Math.abs((contactRoot(clip, R, heights).speed * 100) / R.H0 / (clip.facts as { speed: number }).speed - ground), id).toBeLessThan(0.01);
    }
  });
  it("a one-shot with no contact keeps none and plays still: jump starts, slides with and without root motion, attacks", () => {
    for (const id of ["QUATERNIUS_3D2DGE/Jump_Start", "QUATERNIUS_SHARDFALL/Slide_Start_RM", "MESH2MOTION/Melee_Hook", "MESH2MOTION/Slide_Exit", "QUATERNIUS_SHARDFALL/Slide_Exit", "QUATERNIUS_SHARDFALL/Sword_Regular_A"]) {
      const { clip, R } = libClip(id);
      expect(clip.loop, id).toBe(false);
      expect(measureFacts(clip, R).contacts, id).toEqual({ by: "detected" });
    }
  });
  it("a clip its tags put off its feet keeps the strict reading: none for a run tagged as flying", () => {
    const { clip, R } = libClip("MESH2MOTION/Run_Female");
    expect(measureFacts({ ...clip, tags: ["fly"] }, R).contacts).toEqual({ by: "detected" });
    for (const id of ["MESH2MOTION/Flying_Forward", "MESH2MOTION/Climb_Wall", "MESH2MOTION/Meditate"]) {
      const { clip, R } = libClip(id);
      expect(measureFacts(clip, R).contacts, id).toEqual({ by: "detected" }); // not read by the sole either
    }
    expect(OFF_FEET).toEqual(["air", "fly", "swim", "climb", "lie", "sit"]);
  });
});

describe("measureFacts against facts-truth.json", () => {
  const truth = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/facts-truth.json"), "utf8")) as { clips: { id: string; expect: { speed?: number; distance?: number; strike?: number; loop?: boolean }; source: string }[] };
  it("holds 20 clips, each with a cited source", () => {
    expect(truth.clips.length).toBe(20);
    for (const c of truth.clips) expect(c.source).toMatch(/@[0-9a-f]{7}/);
  });
  for (const t of truth.clips) {
    it(`${t.id}: ${Object.keys(t.expect).join(", ")}`, () => {
      const { clip, R } = libClip(t.id);
      const f = measureFacts(clip, R);
      const e = t.expect;
      if (e.speed !== undefined) expect(Math.abs(f.speed! / e.speed - 1), `speed ${f.speed} vs ${e.speed}`).toBeLessThanOrEqual(0.15);
      if (e.distance !== undefined) {
        const d = Math.hypot(...f.travel!);
        expect(Math.abs(d - e.distance), `distance ${d} vs ${e.distance}`).toBeLessThanOrEqual(Math.max(0.02 * e.distance, 1));
      }
      if (e.strike !== undefined) expect(Math.abs(f.strike![0]! - e.strike), `strike ${f.strike} vs ${e.strike}`).toBeLessThanOrEqual(0.08);
      if (e.loop !== undefined) {
        expect(clip.loop).toBe(e.loop);
        if (e.loop) expect(f.seam).toBeLessThanOrEqual(40);
      }
    });
  }
  it("measures height from the keys and names its tool", () => {
    const { clip, R } = libClip("QUATERNIUS_3D2DGE/Crouch_Idle_Loop");
    const f = measureFacts(clip, R);
    expect(f.height[1]).toBeLessThan(90);
    expect(f.by).toMatch(/^m3a-core@\d+\.\d+\.\d+$/);
    expect(readdirSync(LIB).length).toBe(Object.keys(JSON.parse(readFileSync(join(LIB, "../sets.lock.json"), "utf8")).sets).length);
  });
});

// Lint and fix (WP-3.5): each operator removes its planted defect (WP-3.6's runs) without pushing any other metric
// past its threshold, and leaves a valid clip; a step that would make any metric worse is not applied; no operator
// changes `dur`, an event, a contact or a key without reporting it, and stored facts are measured again when the
// motion changed; each operator's own cases (a flip at a straight limb, whole turns, a loop's flip, a hovering foot, a
// seam whose speeds alone differ); re-fit keeps a budget within its tolerance, the root's travel included; lint lists
// what fix would change, naming the operator for each kind of finding.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clip as clipNs, format, validate, type Clip, type Key } from "@m3a/core";
import { checks, fix, fixes, lint, metrics } from "../src/index.ts";
import { libraryClips } from "../../../tools/qa/qa.ts";
import { plant, type Defect } from "../../../tools/plant/plant.ts";
import { testClip } from "./raster-pose.ts";

const runs = (JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/planted/runs.json"), "utf8")) as { runs: { clip: string; defect: Defect; seed: number; metric: string; t0: number; t1: number; where?: string }[] }).runs;
const lib = new Map(libraryClips().map((c) => [c.clip.id, c]));
const OPS: [Defect, fixes.FixName][] = [["slide", "footLocks"], ["sink", "penetration"], ["pop", "jitter"], ["twistFlip", "twistFlips"], ["seam", "seam"]];
/** The metrics that find a defect: a sliding foot shows as its slide or its skate. */
const finds = (metric: string) => (metric === "slide" ? ["slide", "skate"] : [metric]);

describe("each operator removes its planted defect, pushing no other metric past its threshold, its clip valid", () => {
  for (const [defect, op] of OPS) {
    it(`${op} on every planted ${defect}`, () => {
      const bad: string[] = [];
      let n = 0;
      for (const r of runs.filter((x) => x.defect === defect)) {
        const c = lib.get(r.clip)!, p = plant(r.defect, c.clip, c.rest, r.seed), out = fix(p.clip, c.rest, { ops: [op] }), clean = metrics(c.clip, c.rest);
        n++;
        // the defect: no finding of its metric where it was planted
        const still = out.after.findings.filter((x) => finds(r.metric).includes(x.metric) && x.t0 <= r.t1 + 0.05 && x.t1 >= r.t0 - 0.05 && (!r.where || x.where === r.where));
        // any other metric: under its warn level in the clip as planted and as it was clean, so it is over it after
        const m = checks.motionOf(p.clip, c.rest);
        const pushed = checks.METRICS.filter((k) => !finds(r.metric).includes(k) && !out.before.off.includes(k) && Math.max(out.before.values[k], clean.values[k]) < checks.levels(m, k).warn && out.after.values[k] >= checks.levels(m, k).warn);
        // and the fixed clip is a valid clip: whole numbers within their ranges
        const errors = validate(JSON.parse(JSON.stringify(out.clip))).errors.map((e) => `${e.code} ${e.message}`);
        if (still.length || pushed.length || errors.length) bad.push(`${r.clip} [${r.t0}–${r.t1}]: ${still.map((x) => x.message).join("; ")}${pushed.length ? ` pushed ${pushed.map((k) => `${k} ${out.before.values[k]} → ${out.after.values[k]}`).join(", ")}` : ""}${errors.length ? ` ${errors.length} errors: ${errors[0]}` : ""}`);
      }
      expect(n).toBeGreaterThanOrEqual(8);
      expect(bad, bad.join("\n")).toEqual([]);
    }, 120_000);
  }
});

describe("nothing changes silently", () => {
  const { clip: punch, R } = testClip("Punch_Jab");
  const marked: Clip = { ...punch, events: [{ t: 0.2, name: "wind" }, { t: 0.4, name: "hit" }], contacts: { by: "labelled", footL: [[0, punch.dur]], footR: [[0, punch.dur]] } };
  const DEFECT: Record<fixes.FixName, Defect> = { twistFlips: "twistFlip", jitter: "pop", penetration: "sink", footLocks: "slide", seam: "seam", refit: "pop" };
  it("every operator keeps dur, the events and the contacts", () => {
    for (const op of fixes.FIXES) {
      // a clip of WP-3.6's runs that takes the defect the operator answers, with events and labelled contacts
      const r = runs.find((x) => x.defect === DEFECT[op])!, c = lib.get(r.clip)!, events = [{ t: Math.min(0.2, c.clip.dur), name: "wind" }];
      const contacts = { by: "labelled" as const, footL: [[0, c.clip.dur]] as [number, number][] };
      const out = fix({ ...plant(r.defect, c.clip, c.rest, r.seed).clip, events, contacts }, c.rest, { ops: [op] });
      expect([out.clip.dur, out.clip.events, out.clip.contacts], op).toEqual([c.clip.dur, events, contacts]);
      expect(out.steps.flatMap((s) => s.changes).filter((x) => /^(dur|events|contacts) /.test(x)), op).toEqual([]);
    }
  });
  it("leaves a clip with nothing to fix exactly as it was, keys included", () => {
    // a closed loop, and a clean clip, through every operator with a report that finds nothing
    for (const id of ["QUATERNIUS_3D2DGE/Walk_Loop", "CMU_CURATED/Boxing_Guard_Loop", "MESH2MOTION/Idle_A"]) {
      const c = lib.get(id)!, clean = { ...metrics(c.clip, c.rest), findings: [], folded: [] };
      for (const op of fixes.FIXES.filter((o) => o !== "refit")) {
        const out = fixes.OPERATORS[op](c.clip, c.rest, clean, {});
        expect([out.changes, out.clip.keys], `${id} ${op}`).toEqual([[], c.clip.keys]);
      }
    }
  });
  it("reports an operator of your own that moves dur, the events or the contacts", () => {
    const stretch: fixes.Operator = (clip) => ({ clip: { ...clip, dur: clip.dur + 0.5, events: [{ t: 0.25, name: "wind" }, ...(clip.events ?? []).slice(1)], contacts: { ...clip.contacts!, footL: [[0.1, clip.dur]] } }, changes: [] });
    const out = fix(marked, R, { ops: [stretch] });
    expect(out.steps[0]!.changes).toEqual([`dur ${marked.dur} → ${marked.dur + 0.5} s`, expect.stringMatching(/^events \[.*"t":0\.2,.*\] → \[.*"t":0\.25,.*\]$/), expect.stringMatching(/^contacts \{.*\[0,[\d.]+\].*\} → \{.*\[0\.1,[\d.]+\].*\}$/)]);
  });
  it("doesn't apply a step that would push a metric past a level it was under, and says which", () => {
    const { clip: sparse, R: r } = testClip("Idle_Loop");
    const idle = { ...sparse, keys: Array.from({ length: Math.round(sparse.dur * 30) + 1 }, (_, i) => fixes.tidy({ ...(format.keyAt(sparse, i / 30) as Key), t: i / 30 } as never) as Key) } as Clip;
    // an operator of your own that throws the left fist out at one key: a pop
    const poke: fixes.Operator = (clip) => {
      const c = structuredClone(clip), k = c.keys[Math.floor(c.keys.length / 2)]!;
      k.armL = [k.armL[0]!, k.armL[1]! + 60, k.armL[2]!, k.armL[3]!, k.armL[4] ?? 0];
      return { clip: c, changes: ["the left fist thrown out"] };
    };
    const out = fix(idle, r, { ops: [poke] });
    expect(out.steps[0]!.rejected).toEqual([expect.stringMatching(/^pop [\d.]+ → [\d.]+, past its (warn|fail) level$/), ...Array(out.steps[0]!.rejected!.length - 1).fill(expect.any(String))]);
    expect([out.steps[0]!.changes, out.clip.keys, out.after.verdict]).toEqual([[], idle.keys, out.before.verdict]);
    expect(out.text).toMatch(/\npoke: not applied, it would push pop /);
  });
  it("throws for an operator name it doesn't know, naming the closest", () => {
    expect(() => fix(marked, R, { ops: ["twistFlip" as fixes.FixName] })).toThrow(/no operator "twistFlip"; did you mean "twistFlips"\?/);
  });
  it("measures stored facts again when the motion changed, and says what they say differently", () => {
    const walk = lib.get("STYLE100/Neutral_Walk")!, p = plant("pop", walk.clip, walk.rest, 3).clip;
    expect(p.facts).toBeDefined();
    const out = fix(p, walk.rest, { ops: ["jitter"] });
    expect(out.steps.at(-1)!.op).toBe("facts");
    expect(out.steps.at(-1)!.changes.every((x) => /^facts\.\w+ .+ → .+$/.test(x))).toBe(true);
    expect(out.clip.facts).not.toEqual(p.facts);
    // nothing changed: the stored facts stay as they were
    expect(fix(walk.clip, walk.rest, { ops: ["refit"] }).steps.map((s) => s.op)).toEqual(["refit"]);
  });
});

describe("the operators' own cases", () => {
  const { clip: idle, R } = testClip("Idle_Loop");
  const keys = (n: number, edit: (k: Key, t: number) => void) => Array.from({ length: n + 1 }, (_, i) => {
    const k = structuredClone(idle.keys[0]!);
    k.t = Math.round((i / n) * 1000) / 1000;
    edit(k, k.t);
    return k;
  });
  it("twist flips: a bent knee's twist jumping 170° and staying is undone from that key on", () => {
    const flipped = { ...idle, loop: false, dur: 1, keys: keys(30, (k, t) => (k.legL = [k.legL[0]!, k.legL[1]!, k.legL[2]!, 45, (k.legL[4] ?? 0) + (t > 0.5 ? 170 : 0)])) } as Clip;
    const out = fix(flipped, R, { ops: ["twistFlips"] });
    expect(out.steps[0]!.changes).toEqual([expect.stringMatching(/^legL: twist's 170° jump at 0\.50–0\.53 s undone from 0\.53 s on$/)]);
    expect(out.clip.keys.map((k) => k.legL[4])).toEqual(idle.keys.slice(0, 1).flatMap(() => Array(31).fill(idle.keys[0]!.legL[4] ?? 0)));
    expect(out.after.findings.filter((f) => f.metric === "twistFlip" || f.metric === "jointLimit")).toEqual([]);
  });
  it("twist flips: at a straight limb the jump is spread over the stretch where nothing shows it", () => {
    // a straight knee (bend 5°) whose twist jumps 170° at 0.5 s: the knee's direction is undefined, so turning it slowly
    // there shows nothing
    const flipped = { ...idle, loop: false, dur: 1, keys: keys(30, (k, t) => (k.legL = [k.legL[0]!, k.legL[1]!, k.legL[2]!, 5, (k.legL[4] ?? 0) + (t > 0.5 ? 170 : 0)])) } as Clip;
    const out = fix(flipped, R, { ops: ["twistFlips"] });
    expect(out.steps[0]!.changes).toEqual([expect.stringMatching(/^legL: twist 0\.50–0\.53 s spread over [\d.]+–[\d.]+ s, where the limb is straight$/)]);
    const tw = out.clip.keys.map((k) => k.legL[4]!), steps = tw.slice(1).map((v, i) => Math.abs(v - tw[i]!));
    expect([tw[0], tw.at(-1), Math.max(...steps) < 170 / 4]).toEqual([flipped.keys[0]!.legL[4], flipped.keys.at(-1)!.legL[4], true]);
  });
  it("twist flips: whole turns come out first, moving nothing", () => {
    const turned = { ...idle, loop: false, dur: 1, keys: keys(30, (k, t) => (k.legL = [k.legL[0]!, k.legL[1]!, k.legL[2]!, 45, (k.legL[4] ?? 0) + (t > 0.5 ? 360 : 0)])) } as Clip;
    const report = metrics(turned, R);
    // the metric reads a whole turn as no jump; handed one, the operator takes the turn out
    const out = fixes.twistFlips(turned, R, { ...report, findings: [{ ...report.findings[0]!, metric: "twistFlip", where: "legL", t0: 0.5, t1: 0.533, value: 360, level: "fail", message: "", repair: "" } as checks.Finding], folded: [] }, {});
    expect(out.changes).toEqual([expect.stringMatching(/^legL: twist 0\.50–0\.53 s, −360° from 0\.53 s on \(whole turns\)$/)]);
    expect(out.clip.keys.map((k) => k.legL[4])).toEqual(Array(31).fill(idle.keys[0]!.legL[4] ?? 0));
  });
  it("twist flips: in a loop the undoing eases back out, so the cycle still closes", () => {
    // a closed loop: the knee's twist jumps 170° at 0.2 s, holds, and turns slowly back by the cycle's end
    const back = (t: number) => (t <= 0.2 ? 0 : t <= 0.5 ? 170 : 170 * (1 - (t - 0.5) / 0.5));
    const flipped = { ...idle, loop: true, dur: 1, keys: keys(30, (k, t) => (k.legL = [k.legL[0]!, k.legL[1]!, k.legL[2]!, 45, (k.legL[4] ?? 0) + Math.round(back(t))])) } as Clip;
    const m = checks.motionOf(flipped, R);
    const out = fixes.twistFlips(flipped, R, metrics(flipped, R), {}), tw = out.clip.keys.map((k) => k.legL[4]!);
    expect(out.changes).toEqual([expect.stringMatching(/^legL: twist's 170° jump at 0\.20–0\.23 s undone at 0\.23 s and eased back out by the cycle's end \(1\.00 s\)$/)]);
    // the jump gone and the loop still closed: the last key's twist the first's
    expect([tw.at(-1)! - tw[0]!, Math.abs(tw[7]! - tw[6]!) < 10]).toEqual([0, true]);
    const after = metrics(out.clip, R);
    expect([after.values.seam < checks.levels(m, "seam").warn, after.findings.filter((f) => f.metric === "twistFlip")]).toEqual([true, []]);
  });
  it("penetration: a foot the lift leaves hanging is set back on the floor by its leg", () => {
    // the body lowered 100 mm for 0.4 s with the right knee bent so the right foot stays on the floor: the left foot
    // goes 100 mm under it. The lift raises the body 100 mm, and the right foot, standing still, goes up with it
    const { clip: stand, R: r } = testClip("Idle_Loop");
    const c = { ...stand, loop: false, dur: 1.5, keys: Array.from({ length: 16 }, (_, i) => ({ ...structuredClone(stand.keys[0]!), t: i / 10 })) } as Clip;
    for (const k of c.keys) {
      const w = k.t >= 0.6 && k.t <= 0.9 ? 1 : k.t > 0.4 && k.t < 0.6 ? (k.t - 0.4) / 0.2 : k.t > 0.9 && k.t < 1.1 ? (1.1 - k.t) / 0.2 : 0;
      if (!w) continue;
      const X = format.decodePose(r, k as never, new Float32Array(format.P * 3));
      for (let i = 0; i < format.P; i++) if (!/^(ankle|ball|toe)R$/.test(format.POINTS[i]!)) X[i * 3 + 2] = X[i * 3 + 2]! - 100 * w;
      Object.assign(k, format.encodePose(r, X, k as never), { t: k.t });
    }
    const out = fix(c, r, { ops: ["penetration"] });
    expect(out.steps[0]!.changes).toEqual([expect.stringMatching(/^body raised up to \d+ mm over/), expect.stringMatching(/^feet set on the floor by their legs at [\d.]+–[\d.]+ s$/)]);
    const m = checks.motionOf(out.clip, r), lowR = m.frames.map((X) => Math.min(...["ankleR", "ballR", "toeR"].map((n) => X[format.IDX[n]! * 3 + 2]! - (n === "ankleR" ? r.ankleZ : 0))));
    expect(Math.max(...lowR)).toBeLessThan(25);
    expect(out.after.findings.filter((f) => f.metric === "penetration")).toEqual([]);
  });
  it("seam: a loop whose poses meet but whose speeds don't has its speeds matched, when the metrics find it", () => {
    // the pelvis swaying forward and back once a cycle, leaving at 3.5 m/s and arriving at 3.5 m/s the other way
    const sway = { ...idle, loop: true, dur: 1, keys: keys(30, (k, t) => (k.hips = [k.hips[0]! + Math.round(400 * t * (1 - t)), k.hips[1]!, k.hips[2]!])) } as Clip;
    const before = metrics(sway, R), m = checks.motionOf(sway, R);
    expect([before.values.seam < checks.levels(m, "seam").warn, before.findings.some((f) => f.metric === "seamVelocity")]).toEqual([true, true]);
    expect(lint(sway, R, before).items.map((i) => i.op)).toContain("seam");
    const out = fix(sway, R, { ops: ["seam"] });
    expect(out.steps[0]!.changes).toEqual([expect.stringMatching(/^hips: the poses meet, its speeds \(.*\) matched over the cycle's ends/), expect.stringMatching(/^keys \d+ → \d+/)].slice(0, out.steps[0]!.changes.length));
    expect(out.after.values.seamVelocity).toBeLessThan(before.values.seamVelocity / 2);
    expect(out.after.values.seam).toBeLessThan(checks.levels(m, "seam").warn);
  });
  it("seam: a loop that ends somewhere else, still moving, meets its start at the same speed", () => {
    // the pelvis drifting forward faster and faster: 1.8 m from the start by the end, arriving at 3.7 m/s
    const drift = { ...idle, loop: true, dur: 1, keys: keys(30, (k, t) => (k.hips = [k.hips[0]! + 200 * t * t, k.hips[1]!, k.hips[2]!])) } as Clip;
    const before = metrics(drift, R), out = fix(drift, R, { ops: ["seam"] }), m = checks.motionOf(drift, R);
    expect([before.values.seam > checks.levels(m, "seam").fail, before.values.seamVelocity > checks.levels(m, "seamVelocity").warn]).toEqual([true, true]);
    expect(out.after.values.seam).toBeLessThan(checks.levels(m, "seam").warn);
    expect(out.after.values.seamVelocity).toBeLessThan(checks.levels(m, "seamVelocity").warn);
    // the speeds matched, not only the poses: what's left is a quarter of the jump at most
    expect(out.after.values.seamVelocity).toBeLessThan(before.values.seamVelocity / 4);
  });
});

describe("re-fit keeps a budget within its tolerance", () => {
  const { clip: idle, R } = testClip("Idle_Loop");
  // the idle's keys, every 1/60 s: far more than the motion needs
  const dense = { ...idle, keys: Array.from({ length: Math.round(idle.dur * 60) + 1 }, (_, i) => ({ ...(format.keyAt(idle, i / 60) as Key), t: Math.round((i / 60) * 1000) / 1000 })) } as Clip;
  it("drops the keys the in-betweens make within 5 mm, keeping the first and last", () => {
    const out = fixes.refit(dense, R, metrics(dense, R), {});
    expect(out.clip.keys.length).toBeLessThan(dense.keys.length / 4);
    expect([out.clip.keys[0]!.t, out.clip.keys.at(-1)!.t]).toEqual([0, dense.keys.at(-1)!.t]);
    expect(out.changes[0]).toMatch(/^keys \d+ → \d+, each dropped pose within 5\.0 mm$/);
    let worst = 0;
    for (const k of dense.keys) {
      const a = format.pose(R, dense, Math.min(k.t, dense.dur * (1 - 1e-12))), b = format.pose(R, out.clip, Math.min(k.t, dense.dur * (1 - 1e-12)));
      for (let i = 0; i < a.length; i += 3) worst = Math.max(worst, Math.hypot(a[i]! - b[i]!, a[i + 1]! - b[i + 1]!, a[i + 2]! - b[i + 2]!));
    }
    expect(worst).toBeLessThanOrEqual(5);
    expect(metrics(out.clip, R).verdict).toBe(metrics(dense, R).verdict);
  });
  it("counts the root's travel and turn: a clip whose root speeds up keeps the keys its travel needs", () => {
    // the idle's first pose held 2 s while the root accelerates forward (50 t² % of H0) and turns (20 t² degrees)
    const travel = { ...idle, loop: false, dur: 2, keys: Array.from({ length: 61 }, (_, i) => ({ ...structuredClone(idle.keys[0]!), t: Math.round((i / 30) * 1000) / 1000, root: [Math.round(50 * (i / 30) ** 2), 0], yaw: Math.round(20 * (i / 30) ** 2) })) } as Clip;
    const out = fixes.refit(travel, R, metrics(travel, R), {});
    let worst = 0;
    for (let t = 0; t <= 2; t += 1 / 60) {
      const a = clipNs.rootAt(travel as never, t), b = clipNs.rootAt(out.clip as never, t);
      worst = Math.max(worst, (Math.hypot(a.forward - b.forward, a.right - b.right) * R.H0) / 100);
    }
    expect(out.clip.keys.length).toBeGreaterThan(4);
    expect(worst).toBeLessThanOrEqual(5 + R.H0 / 200);
  });
  it("holds a key budget, raising its tolerance to fit it", () => {
    const free = fix(dense, R, { ops: ["refit"] }).clip.keys.length, out = fix(dense, R, { ops: ["refit"], maxKeys: 3 });
    expect(free).toBeGreaterThan(3);
    expect(out.clip.keys.length).toBeLessThanOrEqual(3);
    expect(out.steps[0]!.changes[0]).toMatch(/^keys \d+ → [23], each dropped pose within (\d+\.\d|\d+) mm$/);
    expect(out.clip.dur).toBe(dense.dur);
  });
});

describe("lint", () => {
  const c = lib.get(runs.find((r) => r.defect === "pop")!.clip)!, r = runs.find((x) => x.defect === "pop")!, p = plant("pop", c.clip, c.rest, r.seed).clip;
  it("lists what fix would change and why, in at most 20 lines, and fix changes it", () => {
    const l = lint(p, c.rest);
    expect(l.items.map((i) => i.op)).toContain("jitter");
    expect(l.items.find((i) => i.op === "jitter")!.why.some((w) => w.startsWith("pop: "))).toBe(true);
    expect(l.text.split("\n").length).toBeLessThanOrEqual(20);
    const out = fix(p, c.rest);
    expect(out.steps.map((s) => s.op).filter((o) => o !== "facts")).toEqual(l.items.map((i) => i.op));
    expect(out.after.findings.some((f) => f.metric === "pop" && f.t0 <= r.t1 + 0.05 && f.t1 >= r.t0 - 0.05)).toBe(false);
    expect(out.text.split("\n").length).toBeLessThanOrEqual(20);
  });
  it("names the operator that answers each kind of finding", () => {
    const { clip: idle, R } = testClip("Idle_Loop");
    const base = metrics(idle, R), one = (metric: string, where?: string) => lint(idle, R, { ...base, findings: [{ ...(base.findings[0] ?? {}), metric, where, t0: 0.2, t1: 0.4, value: 1, level: "warn", message: "x", repair: "y" } as checks.Finding] }).items.map((i) => i.op);
    expect([one("slide", "footL"), one("skate", "footL"), one("penetration", "footL"), one("jitter", "head"), one("pop", "head"), one("twistFlip", "legL"), one("seam"), one("seamVelocity")]).toEqual([["footLocks"], ["footLocks"], ["penetration"], ["jitter"], ["jitter"], ["twistFlips"], ["seam"], ["seam"]]);
  });
  it("suggests a re-fit for keys denser than 30 a second", () => {
    const { clip: idle, R } = testClip("Idle_Loop");
    const dense = { ...idle, keys: Array.from({ length: Math.round(idle.dur * 60) + 1 }, (_, i) => ({ ...(format.keyAt(idle, i / 60) as Key), t: Math.round((i / 60) * 1000) / 1000 })) } as Clip;
    expect(lint(dense, R).items.find((i) => i.op === "refit")?.why[0]).toMatch(/keys in .* s, more than 30 a second/);
    expect(lint(idle, R).items.some((i) => i.op === "refit")).toBe(false);
  });
});

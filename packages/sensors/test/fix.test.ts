// Lint and fix (WP-3.5): each operator removes its planted defect (WP-3.6's runs) without pushing any other metric
// past its threshold, and leaves a valid clip; a step that would make any metric worse is not applied; no operator
// changes `dur`, an event, a contact or a key without reporting it, and stored facts are measured again when the
// motion changed (the ones its source gave kept); each operator's own cases (a flip at a straight limb, whole turns, a
// loop's flip, a hovering foot, a seam whose speeds alone differ); re-fit keeps a budget within its tolerance, the root's
// travel included; lint lists what fix would change, naming the operator for each kind of finding.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clip as clipNs, format, validate, type Clip, type Key } from "@m3a/core";
import { checks, fix, fixes, lint, metrics } from "../src/index.ts";
import { libraryClips } from "../../../tools/qa/qa.ts";
import { plant, type Defect } from "../../../tools/plant/plant.ts";
import { worse } from "../src/fix/fix.ts";
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
    expect(out.text).toMatch(/\npoke: not applied, it would make worse: pop /);
  });
  it("doesn't apply a step that takes a metric from under its warn level to warn", () => {
    const { clip: sparse, R: r } = testClip("Idle_Loop");
    const idle = { ...sparse, keys: Array.from({ length: Math.round(sparse.dur * 30) + 1 }, (_, i) => fixes.tidy({ ...(format.keyAt(sparse, i / 30) as Key), t: i / 30 } as never) as Key) } as Clip;
    // the smallest poke that reads as a pop at warn, not fail
    const poke = (d: number): fixes.Operator => (clip) => {
      const c = structuredClone(clip), k = c.keys[Math.floor(c.keys.length / 2)]!;
      k.armL = [k.armL[0]!, k.armL[1]! + d, k.armL[2]!, k.armL[3]!, k.armL[4] ?? 0];
      return { clip: c, changes: ["poked"] };
    };
    const m = checks.motionOf(idle, r), level = (c: Clip) => metrics(c, r).values.pop;
    const d = [4, 6, 8, 10, 12, 14, 16, 20, 24].find((x) => {
      const v = level(poke(x)(idle, r, metrics(idle, r), {}).clip);
      return v >= checks.levels(m, "pop").warn && v < checks.levels(m, "pop").fail;
    })!;
    expect(d).toBeDefined();
    const out = fix(idle, r, { ops: [poke(d)] });
    expect(out.steps[0]!.rejected!.some((x) => /^pop [\d.]+ → \d+, past its warn level$/.test(x)), JSON.stringify(out.steps[0]!.rejected)).toBe(true);
  });
  it("counts as worse a metric at warn raised over 5%, more findings, or none of the metrics an operator answers lowered", () => {
    const { clip: c, R: r } = testClip("Idle_Loop");
    const before = metrics(c, r), m = checks.motionOf(c, r), { warn, fail } = checks.levels(m, "pop");
    const at = (pop: number, findings = before.findings) => ({ ...before, values: { ...before.values, pop }, findings });
    expect([before.values.pop < warn, warn * 1.06 < fail]).toEqual([true, true]);
    // at warn already: up 4% is allowed, up 6% isn't
    expect(worse(m, at(warn), at(warn * 1.04))).toEqual([]);
    expect(worse(m, at(warn), at(warn * 1.06))).toEqual([expect.stringMatching(/^pop [\d.]+ → [\d.]+, past its warn level already and up more than 5%$/)]);
    // one finding more, every value as it was
    const extra = { metric: "slide", where: "footL", t0: 0.1, t1: 0.2, value: 1, unit: "mm", level: "warn", message: "" } as checks.Finding;
    expect(worse(m, before, at(before.values.pop, [...before.findings, extra]))).toEqual([`findings ${before.findings.length} → ${before.findings.length + 1}`]);
    // an operator answering pop, found: pop not lowered is worse, lowered isn't; one answering a metric not found has
    // nothing to lower
    const found = at(warn, [...before.findings, { ...extra, metric: "pop", where: "fistL" }]);
    expect(worse(m, found, found, ["pop", "jitter"])).toEqual(["pop not lowered"]);
    expect(worse(m, found, at(warn * 0.9, found.findings), ["pop", "jitter"])).toEqual([]);
    expect(worse(m, before, before, ["jitter"])).toEqual([]);
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
    // a fact the source gave (`captured`) is kept, not measured again
    const given = fix({ ...p, facts: { ...p.facts!, speed: 123, captured: ["speed"] } }, walk.rest, { ops: ["jitter"] });
    expect([given.clip.facts!.speed, given.steps.at(-1)!.changes.some((x) => x.startsWith("facts.speed"))]).toEqual([123, false]);
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
  it("tidy: a key as the format keeps it, whole numbers within their ranges, a direction scaled back or kept alive", () => {
    const k = { t: 0.1234, hips: [1.4, -2.6, 1200.2], armL: [180, 60, 30, 190, 3.6], legL: [0.2, 0.1, 0.15, 20, 0], yaw: 12.6 } as unknown as Key;
    expect(fixes.tidy(k as never)).toEqual({ t: 0.123, hips: [1, -3, 1000], armL: [100, 33, 17, 180, 4], legL: [1, 0, 0, 20, 0], yaw: 13 });
  });
  it("twist flips: in a loop a flip that jumps back later is undone until it does", () => {
    const flipped = { ...idle, loop: true, dur: 1, keys: keys(30, (k, t) => (k.legL = [k.legL[0]!, k.legL[1]!, k.legL[2]!, 45, (k.legL[4] ?? 0) + (t > 0.2 && t <= 0.6 ? 170 : 0)])) } as Clip;
    const out = fixes.twistFlips(flipped, R, metrics(flipped, R), {});
    expect(out.changes).toEqual([expect.stringMatching(/^legL: twist's 170° jump at 0\.20–0\.23 s undone until it jumps back at 0\.60 s$/)]);
    expect(new Set(out.clip.keys.map((k) => k.legL[4]))).toEqual(new Set([idle.keys[0]!.legL[4] ?? 0]));
  });
  it("twist flips: a heading winding nearly round where the foot points down is spread the short way", () => {
    // a straight leg (its twist undefined) whose twist winds -15 → -325 over four keys, two of them 130° jumps: 50° the
    // short way
    const at: Record<string, number> = { "0.433": -40, "0.467": -170, "0.5": -300 };
    const wind = { ...idle, loop: false, dur: 1, keys: keys(30, (k, t) => (k.legL = [k.legL[0]!, k.legL[1]!, k.legL[2]!, 5, t <= 0.4 ? -15 : (at[String(t)] ?? -325)])) } as Clip;
    const report = metrics(wind, R), flip = report.findings.find((f) => f.metric === "twistFlip");
    expect(flip).toBeDefined();
    const out = fixes.twistFlips(wind, R, report, {}), tw = out.clip.keys.map((k) => k.legL[4]!);
    expect(Math.max(...tw.slice(1).map((v, i) => Math.abs(v - tw[i]!)))).toBeLessThan(30);
    expect(Math.abs(tw.at(-1)! - tw[0]!)).toBeLessThanOrEqual(180);
  });
  it("seam: a speed change at the seam no larger than at the clip's own keys is left, even when the metrics find one", () => {
    // the head turning back and forth key by key (a corner at every key): the seam's corner is one more
    const zig = { ...idle, loop: true, dur: 1, keys: keys(30, (k, t) => (k.head = [k.head[0]! + (Math.round(t * 30) % 2 ? 6 : 0), k.head[1]!, k.head[2]!])) } as Clip;
    const r = metrics(zig, R), found = { ...r, findings: [...r.findings, { metric: "seamVelocity", where: "head", t0: 1, t1: 1, value: 9999, unit: "°/s²", level: "warn", message: "" } as checks.Finding] };
    expect(fixes.seam(zig, R, found, {}).changes).toEqual([]);
  });
  it("seam: a key at the seam within 5 ms of the clip's own is that key", () => {
    // the last key 3 ms before the end and one 3 ms past it (a capture's last frame): the seam's key is the 0.997 one
    const ks = keys(30, (k, t) => (k.armR = [Math.round(k.armR[0]! + 60 * t * t), k.armR[1]!, k.armR[2]!, k.armR[3]!, k.armR[4] ?? 0]));
    ks[ks.length - 1]!.t = 0.997;
    const near = { ...idle, loop: true, dur: 1, keys: [...ks, { ...structuredClone(ks.at(-1)!), t: 1.003 }] } as Clip;
    const out = fixes.seam(near, R, metrics(near, R), {}), ts = out.clip.keys.map((k) => k.t);
    expect(out.changes.length).toBeGreaterThan(0);
    expect(Math.min(...ts.slice(1).map((t, i) => t - ts[i]!))).toBeGreaterThanOrEqual(0.005);
  });
  it("jitter: a shake, every key out of place by turns, moves halfway rather than flipping", () => {
    const shake = { ...idle, loop: false, dur: 1, keys: keys(30, (k, t) => (k.head = [k.head[0]! + (t > 0.3 && t < 0.7 ? (Math.round(t * 30) % 2 ? 8 : -8) : 0), k.head[1]!, k.head[2]!])) } as Clip;
    const before = metrics(shake, R), out = fixes.jitter(shake, R, before, {}), turn = out.clip.keys.filter((k) => k.t > 0.35 && k.t < 0.65).map((k) => k.head[0]! - idle.keys[0]!.head[0]!);
    expect(before.findings.some((f) => f.metric === "jitter")).toBe(true);
    expect(Math.max(...turn.map(Math.abs))).toBeLessThanOrEqual(2);
  });
  it("jitter: a shake its point's own fields don't make is smoothed in the torso that does", () => {
    // the chest rolling 5° back and forth key by key: the top of the head shakes, its own field (head) is still
    const shake = { ...idle, loop: false, dur: 1, keys: keys(30, (k, t) => (k.chest = [k.chest![0]!, k.chest![1]! + (t > 0.3 && t < 0.7 ? (Math.round(t * 30) % 2 ? 5 : -5) : 0), k.chest![2]!])) } as Clip;
    const before = metrics(shake, R), out = fixes.jitter(shake, R, before, {});
    expect(before.findings.filter((f) => f.metric === "jitter").map((f) => f.where)).toEqual(["headTop"]);
    expect(out.changes).toEqual([expect.stringMatching(/^jitter on headTop at [\d.–]+ s: head, hips, body, chest smoothed over /)]);
    expect(metrics(out.clip, R).findings.filter((f) => f.metric === "jitter")).toEqual([]);
  });
  it("re-fit counts the root's sideways travel and its turn", () => {
    const run = (root: (t: number) => [number, number], yaw: (t: number) => number) => {
      const c = { ...idle, loop: false, dur: 2, keys: Array.from({ length: 61 }, (_, i) => ({ ...structuredClone(idle.keys[0]!), t: Math.round((i / 30) * 1000) / 1000, root: root(i / 30), yaw: Math.round(yaw(i / 30)) })) } as Clip;
      const out = fixes.refit(c, R, metrics(c, R), {});
      let far = 0, turn = 0;
      for (let t = 0; t <= 2; t += 1 / 60) {
        const a = clipNs.rootAt(c as never, t), b = clipNs.rootAt(out.clip as never, t);
        far = Math.max(far, (Math.hypot(a.forward - b.forward, a.right - b.right) * R.H0) / 100);
        turn = Math.max(turn, Math.abs(a.yaw - b.yaw));
      }
      return { far, turn };
    };
    expect(run((t) => [0, Math.round(50 * t * t)], () => 0).far).toBeLessThanOrEqual(5 + R.H0 / 200);
    expect(run(() => [0, 0], (t) => 20 * t * t).turn).toBeLessThanOrEqual(1);
  });
  it("foot locks: every contact with allContacts, only the sliding ones without", () => {
    const stand = { ...idle, loop: false, dur: 1.5, keys: keys(45, () => {}) } as Clip;
    expect(fixes.footLocks(stand, R, metrics(stand, R), {}).changes).toEqual([]);
    expect(fixes.footLocks(stand, R, metrics(stand, R), { allContacts: true }).changes).toEqual([expect.stringMatching(/^footL held still where it landed/), expect.stringMatching(/^footR held still where it landed/)]);
  });
  it("foot locks: an in-place loop that steps is left as it is, and says why", () => {
    const { clip: walk } = testClip("Walk_Loop"), out = fixes.footLocks(walk, R, metrics(walk, R), { allContacts: true });
    expect([out.changes, out.clip.keys, out.skipped]).toEqual([[], walk.keys, expect.stringMatching(/^an in-place loop that steps: its feet set its treadmill/)]);
    expect(fix(walk, R, { ops: ["footLocks"], allContacts: true }).text).toMatch(/\nfootLocks: not run, an in-place loop that steps/);
  });
  it("penetration: a one-key drop is lifted along a slope, starting before it", () => {
    // standing, keys every 0.1 s; at 1.009 s alone (between two 60 Hz frames) the body drops 150 mm through the floor
    const drop = { ...idle, loop: false, dur: 2, keys: Array.from({ length: 21 }, (_, i) => ({ ...structuredClone(idle.keys[0]!), t: i === 10 ? 1.009 : i / 10 })) } as Clip;
    const k = drop.keys[10]!;
    k.hips = [k.hips[0]!, k.hips[1]!, k.hips[2]! - Math.round((150 * 100) / R.H0)];
    const out = fixes.penetration(drop, R, metrics(drop, R), {}), up = (t: number) => ((out.clip.keys.find((x) => Math.abs(x.t - t) < 1e-6)!.hips[2]! - idle.keys[0]!.hips[2]!) * R.H0) / 100;
    // at most 0.75 H0 a second: the lift starts a key or two either side of the drop, most of the way up a key away
    const ramp = 150 - 0.75 * R.H0 * 0.1 - 10;
    expect([up(0.9) >= ramp, up(1.1) >= ramp, up(0.8) > 0, up(1.2) > 0]).toEqual([true, true, true, true]);
    // each key lifted by its own pose's depth (read at the nearest 60 Hz frame, 1.009 s reads less): no sole under
    const sole = (key: Key) => {
      const X = format.decodePose(R, key as never, new Float32Array(format.P * 3)), z = (n: string) => X[format.IDX[n]! * 3 + 2]!;
      return Math.min(z("ankleL") - R.ankleZ, z("ballL"), z("toeL"), z("ankleR") - R.ankleZ, z("ballR"), z("toeR"));
    };
    expect(Math.min(...out.clip.keys.map(sole))).toBeGreaterThan(-2);
    // its corners rounded: from one key to the next the slope changes by under a third of the drop
    const lift = [0.6, 0.7, 0.8, 0.9].map(up), bends = lift.slice(2).map((v, i) => Math.abs(v - 2 * lift[i + 1]! + lift[i]!));
    expect(Math.max(...bends)).toBeLessThan(50);
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
    // the right arm swinging up and forward faster and faster, ending far from where it started and still moving
    const drift = { ...idle, loop: true, dur: 1, keys: keys(30, (k, t) => (k.armR = [Math.round(k.armR[0]! + 90 * t ** 4), k.armR[1]!, Math.round(k.armR[2]! + 90 * t ** 4), k.armR[3]!, k.armR[4] ?? 0])) } as Clip;
    const before = metrics(drift, R), out = fix(drift, R, { ops: ["seam"] }), m = checks.motionOf(drift, R);
    expect(before.values.seam).toBeGreaterThan(checks.levels(m, "seam").fail);
    expect(out.after.values.seam).toBeLessThan(checks.levels(m, "seam").warn);
    expect(out.after.values.seamVelocity).toBeLessThan(checks.levels(m, "seamVelocity").warn);
    // the speeds matched too, to the keys' resolution (a large correction curves sharply between keys 1/30 s apart):
    // what's left is under half the change
    expect(out.after.values.seamVelocity).toBeLessThan(before.values.seamVelocity / 2);
    // over a quarter of the cycle at either end: the keys between are as they were
    const mid = (x: Clip) => x.keys.filter((k) => k.t > 0.3 && k.t < 0.7);
    expect(mid(out.clip)).toEqual(mid(drift));
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

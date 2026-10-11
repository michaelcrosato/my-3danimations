// Lint and fix (WP-3.5): each operator removes its planted defect (WP-3.6's runs) without pushing any other metric
// past its threshold; no operator changes `dur`, an event or a contact without reporting it, and stored facts are
// measured again when the motion changed; re-fit keeps a budget within its tolerance; lint lists what fix would change.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { format, type Clip, type Key } from "@m3a/core";
import { checks, fix, fixes, lint, metrics } from "../src/index.ts";
import { libraryClips } from "../../../tools/qa/qa.ts";
import { plant, type Defect } from "../../../tools/plant/plant.ts";
import { testClip } from "./raster-pose.ts";

const runs = (JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/planted/runs.json"), "utf8")) as { runs: { clip: string; defect: Defect; seed: number; metric: string; t0: number; t1: number; where?: string }[] }).runs;
const lib = new Map(libraryClips().map((c) => [c.clip.id, c]));
const OPS: [Defect, fixes.FixName][] = [["slide", "footLocks"], ["sink", "penetration"], ["pop", "jitter"], ["twistFlip", "twistFlips"], ["seam", "seam"]];
/** The metrics that find a defect: a sliding foot shows as its slide or its skate. */
const finds = (metric: string) => (metric === "slide" ? ["slide", "skate"] : [metric]);

describe("each operator removes its planted defect, pushing no other metric past its threshold", () => {
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
        if (still.length || pushed.length) bad.push(`${r.clip} [${r.t0}–${r.t1}]: ${still.map((x) => x.message).join("; ")}${pushed.length ? ` pushed ${pushed.map((k) => `${k} ${out.before.values[k]} → ${out.after.values[k]}`).join(", ")}` : ""}`);
      }
      expect(n).toBeGreaterThanOrEqual(8);
      expect(bad, bad.join("\n")).toEqual([]);
    }, 120_000);
  }
});

describe("nothing changes silently", () => {
  const { clip: punch, R } = testClip("Punch_Jab");
  const marked: Clip = { ...punch, events: [{ t: 0.2, name: "wind" }, { t: 0.4, name: "hit" }], contacts: { by: "labelled", footL: [[0, punch.dur]], footR: [[0, punch.dur]] } };
  it("every operator keeps dur, the events and the contacts", () => {
    for (const op of fixes.FIXES) {
      const planted = plant(op === "seam" ? "seam" : op === "footLocks" ? "slide" : op === "penetration" ? "sink" : op === "twistFlips" ? "twistFlip" : "pop", marked, R, 1).clip;
      const out = fix({ ...planted, events: marked.events, contacts: marked.contacts }, R, { ops: [op] });
      expect([out.clip.dur, out.clip.events, out.clip.contacts], op).toEqual([marked.dur, marked.events, marked.contacts]);
      expect(out.steps.flatMap((s) => s.changes).filter((x) => /^(dur|events|contacts) /.test(x)), op).toEqual([]);
    }
  });
  it("reports an operator of your own that moves them", () => {
    const stretch: fixes.Operator = (clip) => ({ clip: { ...clip, dur: clip.dur + 0.5, events: [{ t: 0.25, name: "wind" }, ...(clip.events ?? []).slice(1)] }, changes: [] });
    const out = fix(marked, R, { ops: [stretch] });
    expect(out.steps[0]!.changes).toEqual([`dur ${marked.dur} → ${marked.dur + 0.5} s`, expect.stringMatching(/^events \[.*"t":0\.2,.*\] → \[.*"t":0\.25,.*\]$/)]);
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
  it("suggests a re-fit for keys denser than 30 a second", () => {
    const { clip: idle, R } = testClip("Idle_Loop");
    const dense = { ...idle, keys: Array.from({ length: Math.round(idle.dur * 60) + 1 }, (_, i) => ({ ...(format.keyAt(idle, i / 60) as Key), t: Math.round((i / 60) * 1000) / 1000 })) } as Clip;
    expect(lint(dense, R).items.find((i) => i.op === "refit")?.why[0]).toMatch(/keys in .* s, more than 30 a second/);
    expect(lint(idle, R).items.some((i) => i.op === "refit")).toBe(false);
  });
});

// The Animator (WP-2.6): a fixed-step clock with events in order and root motion; hashes that a second run, skipped
// presentation poses or poses at lower detail never change; exact poses that are the same however presentation was
// posed; saving at any step and restoring into a new Animator, through JSON, continues exactly; a changed or missing
// clip is refused by name; and the cost of one character's step and pose, measured. Node against Chromium is the e2e
// test `animator-parity`. It uses core through its public API (src/index.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as core from "../src/index.ts";
import { Animator, AnimatorError, bind, type AnimClip, type AnimatorSave, type Key } from "../src/index.ts";
import { scriptData } from "./animator-data.ts";
import { dtAt, EXACT, LENGTH, runScript, start } from "./animator-script.ts";

const { ops, format, contact, clip: clipNs } = core;
const data = scriptData();
const [walk, jog, punch, flinch] = data.clips as [AnimClip, AnimClip, AnimClip, AnimClip];
const straight = runScript(core, data);
const rig = bind(data.skeleton);
/** A clip of `dur` seconds with walk's first two keys at its ends, and these events. */
const synthetic = (id: string, dur: number, loop: boolean, events: { t: number; name: string }[]): AnimClip => ({ id, dur, loop, events, keys: [{ ...walk.keys[0]!, t: 0 }, { ...walk.keys[1]!, t: dur }] as Key[] });

describe("step", () => {
  it("runs whole fixed steps and carries the rest: 1/120 twice is one step, a stall stops at maxSteps", () => {
    const a = new Animator(rig).layer("base", { clip: walk });
    expect(a.step(1 / 120).steps).toBe(0);
    expect(a.step(1 / 120).steps).toBe(1);
    expect(a.step(0.1).steps).toBe(6);
    expect(a.step(0).steps).toBe(0);
    expect(a.time).toBeCloseTo(7 / 60, 12);
    const b = new Animator(rig, { maxSteps: 3 }).layer("base", { clip: walk });
    expect(b.step(1).steps).toBe(3);
    expect(b.save().carry).toBeLessThan(1 / 60);
  });
  it("fires each event once, in the order the playheads pass them: loops every cycle, a one-shot's end once, backward too", () => {
    const loop = synthetic("loop", 1, true, [{ t: 0, name: "a" }, { t: 0.5, name: "b" }, { t: 1, name: "a-again" }]);
    const once = synthetic("once", 0.5, false, [{ t: 0, name: "start" }, { t: 0.25, name: "mid" }, { t: 0.5, name: "end" }]);
    const a = new Animator(rig).layer("l", { clip: loop }).layer("o", { clip: once, weight: 0.5 });
    const fired = [];
    for (let i = 0; i < 100; i++) fired.push(...a.step(1 / 60).events);
    // an event at a loop's end is the same moment as its start: each fires once a cycle, in the clip's order
    expect(fired.filter((e) => e.layer === "l").map((e) => `${e.name}@${e.cycle}`)).toEqual(["a@0", "a-again@0", "b@0", "a@1", "a-again@1", "b@1"]);
    expect(fired.find((e) => e.name === "a-again")!.t).toBe(0);
    expect(fired.filter((e) => e.layer === "o").map((e) => e.name)).toEqual(["start", "mid", "end"]);
    expect(fired.map((e) => e.at)).toEqual([...fired.map((e) => e.at)].sort((x, y) => x - y));
    // backward from the end: end, mid, start, each once, however long it then holds
    const back = new Animator(rig).layer("o", { clip: once, speed: -1, time: 0.5 }), seen = [];
    for (let i = 0; i < 90; i++) seen.push(...back.step(1 / 60).events.map((e) => e.name));
    expect(seen).toEqual(["end", "mid", "start"]);
    // a layer at weight 0 fires nothing
    const quiet = new Animator(rig).layer("l", { clip: loop }).layer("o", { clip: once, weight: 0 });
    expect(quiet.step(0.9).events.map((e) => e.layer)).toEqual(["l", "l", "l"]);
  });
  it("fires a loop's events once a cycle at any speed, backward too, however many cycles one step covers", () => {
    for (const [dur, speed] of [[1.4, -1], [0.7, -2.2], [0.3, -40], [1 / 3, 25], [1.4, 1], [0.25, 7], [1.4, -1.3]] as const) {
      const loop = synthetic(`loop-${dur}`, dur, true, [{ t: 0, name: "seam" }, { t: 0.123 * dur, name: "mid" }, { t: dur, name: "end-is-start" }]);
      const a = new Animator(rig).layer("l", { clip: loop, speed }), fired = [];
      for (let i = 0; i < 1200; i++) fired.push(...a.step(1 / 60).events);
      const covered = Math.abs(speed) * 20, label = `dur ${dur} speed ${speed}`;
      for (const name of ["seam", "mid", "end-is-start"]) {
        const cycles = fired.filter((e) => e.name === name).map((e) => e.cycle);
        // each crossing once: the cycles run one by one, none twice, none skipped
        cycles.forEach((c, j) => j > 0 && expect(c - cycles[j - 1]!, `${label}: ${name}`).toBe(Math.sign(speed)));
        expect(Math.abs(cycles.length - covered / dur), `${label}: ${name}`).toBeLessThanOrEqual(1.01);
      }
      expect(fired.map((e) => e.at)).toEqual([...fired.map((e) => e.at)].sort((x, y) => x - y));
      expect(a.layers[0]!.time).toBeGreaterThanOrEqual(0);
      expect(a.layers[0]!.time).toBeLessThanOrEqual(dur);
    }
    // a loop of no length plays still and fires nothing
    const zero = new Animator(rig).layer("z", { clip: synthetic("zero", 0, true, [{ t: 0, name: "z" }]) });
    expect(zero.step(1).events).toEqual([]);
  });
  it("fires a one-shot's ends once when the playhead turns round at them", () => {
    const once = synthetic("once", 0.5, false, [{ t: 0, name: "start" }, { t: 0.25, name: "mid" }, { t: 0.5, name: "end" }]);
    const a = new Animator(rig).layer("o", { clip: once }), names = (n: number) => Array.from({ length: n }, () => a.step(1 / 60).events.map((e) => e.name)).flat();
    expect(names(45)).toEqual(["start", "mid", "end"]);
    a.layer("o", { speed: -1 });
    expect(names(45)).toEqual(["mid", "start"]);
    a.layer("o", { speed: 1 });
    expect(names(45)).toEqual(["mid", "end"]);
    // and the remembered end survives a save and restore
    a.layer("o", { speed: -1 });
    const b = new Animator(rig).restore(JSON.parse(JSON.stringify(a.save())), [once]);
    expect(Array.from({ length: 45 }, () => b.step(1 / 60).events.map((e) => e.name)).flat()).toEqual(["mid", "start"]);
  });
  it("reports each call's turn without a whole-turn jump where the heading crosses ±180°", () => {
    const turning: AnimClip = { ...walk, id: "turning", contacts: undefined, keys: walk.keys.map((k) => ({ ...k, root: [0, 0], yaw: 90 * k.t })) as Key[] };
    const a = new Animator(rig).layer("base", { clip: turning });
    let heading = 0;
    for (let i = 0; i < 300; i++) {
      const r = a.step(1 / 60).root;
      expect(Math.abs(r.yaw)).toBeLessThan(5);
      heading += r.yaw;
    }
    expect(heading).toBeCloseTo(450, 0);
    expect(Math.abs(a.root.yaw)).toBeLessThanOrEqual(180);
  });
  it("moves the root by the clips: an in-place walk by its feet, a clip with its own travel by that", () => {
    const a = new Animator(rig).layer("base", { clip: walk });
    for (let i = 0; i < 120; i++) a.step(1 / 60);
    const speed = contact.contactRoot(walk, rig.rest, walk.contacts!).speed;
    expect(speed).toBeGreaterThan(500);
    expect(a.root.forward / 2).toBeCloseTo(speed, -1);
    expect(Math.abs(a.root.right)).toBeLessThan(0.05 * a.root.forward);
    // a one-shot carrying its own travel (2% of H0 a key), played past its end: the root goes where its root went
    const own: AnimClip = { ...walk, id: "own", loop: false, keys: walk.keys.map((k, i) => ({ ...k, root: [i * 2, i * 0.5] })) };
    const b = new Animator(rig).layer("base", { clip: own });
    for (let i = 0; i < Math.ceil(own.dur * 60) + 5; i++) b.step(1 / 60);
    const end = clipNs.rootAt(own, own.dur);
    expect(end.forward).toBeGreaterThan(10);
    expect(b.root.forward).toBeCloseTo((end.forward * rig.rest.H0) / 100, 6);
    expect(b.root.right).toBeCloseTo((end.right * rig.rest.H0) / 100, 6);
  });
  it("gives the same hashes and events on every run of the same script", () => {
    expect(straight.hashes).toHaveLength(LENGTH);
    // every iteration that takes a step changes the state (a dt of 0 takes none)
    straight.hashes.forEach((h, i) => i > 0 && dtAt(i) > 0 && expect(h).not.toBe(straight.hashes[i - 1]));
    expect(straight.events.length).toBeGreaterThan(20);
    expect(straight.events.some((e) => e.includes(" hit upper "))).toBe(true);
    expect(runScript(core, data)).toEqual(straight);
  });
});

describe("pose", () => {
  it("never changes the hashes or events, taken every step or at alternating detail", () => {
    expect(runScript(core, data, { poses: "every" })).toEqual(straight);
    expect(runScript(core, data, { poses: "lod" })).toEqual(straight);
  });
  it("gives an exact pose bit for bit, however presentation was posed (or not) before it", () => {
    expect(Object.keys(straight.exact).map(Number)).toEqual(EXACT);
    const every = runScript(core, data, { poses: "every" }).exact, lod = runScript(core, data, { poses: "lod" }).exact;
    expect(every).toEqual(straight.exact);
    expect(lod).toEqual(straight.exact);
  });
  it("mixes the layers as the pose operations do: the base whole, a masked layer blended, an additive one added", () => {
    const a = new Animator(rig).layer("base", { clip: walk, time: 0.3 }).layer("upper", { clip: punch, mask: "upper", weight: 0.7, time: 0.2 });
    a.layer("flinch", { clip: flinch, additive: true, weight: 0.5, time: 0.1 });
    const mixed = ops.blend(format.keyAt(walk, 0.3), format.keyAt(punch, 0.2), 0.7, ops.mask("upper"));
    expect(a.key()).toEqual(ops.addDelta(mixed, ops.delta(format.keyAt(flinch, 0.1), format.keyAt(flinch, 0)), 0.5));
    expect(() => new Animator(rig).pose()).toThrow(AnimatorError);
  });
  it("keeps a planted foot still in the world while the Animator walks (at most 10 mm per contact)", () => {
    const a = new Animator(rig).layer("base", { clip: walk });
    const pt = (X: Float64Array, n: string) => [X[format.IDX[n]! * 3]!, X[format.IDX[n]! * 3 + 1]!, X[format.IDX[n]! * 3 + 2]!];
    // the contact point: the lowest sole point (the heel below the ankle, the ball, the toe) at each step's start
    const lowest = (X: Float64Array, s: string) => ["ankle", "ball", "toe"].reduce((m, p) => (pt(X, p + s)[2]! - (p === "ankle" ? rig.rest.ankleZ : 0) < pt(X, m + s)[2]! - (m === "ankle" ? rig.rest.ankleZ : 0) ? p : m));
    const slid: Record<string, number | null> = { L: null, R: null };
    let worst = 0, contacts = 0, prev = a.step(1 / 60) && a.pose();
    for (let i = 0; i < 240; i++) {
      a.step(1 / 60);
      const p = a.pose(), on = clipNs.contactsAt(walk as never, a.layers[0]!.time);
      for (const s of ["L", "R"]) {
        if (!on[`foot${s}` as "footL"]) {
          slid[s] = null;
          continue;
        }
        if (slid[s] === null) [slid[s], contacts] = [0, contacts + 1];
        const n = lowest(prev.points, s) + s, w0 = contact.toWorld(prev.root, pt(prev.points, n)), w1 = contact.toWorld(p.root, pt(p.points, n));
        slid[s]! += Math.hypot(w1[0] - w0[0], w1[1] - w0[1]);
        worst = Math.max(worst, slid[s]!);
      }
      prev = p;
    }
    expect(contacts).toBeGreaterThan(5);
    expect(worst).toBeLessThanOrEqual(10);
  });
});

describe("a clip's library (spec/MOTION.md §3.3, D55)", () => {
  const lib = join(import.meta.dirname, "../../../library/sets");
  const load = (id: string) => {
    const [set, name] = id.split("/") as [string, string], m = JSON.parse(readFileSync(join(lib, set, "_set.json"), "utf8")), clip = core.parseClip(readFileSync(join(lib, set, `${name}.json`), "utf8"));
    return { clip, R: m.sources[clip.restSrc].rest as core.Rest };
  };
  const at = (X: ArrayLike<number>, n: string) => [0, 1, 2].map((i) => X[core.format.IDX[n]! * 3 + i]!);
  const neck = (X: ArrayLike<number>) => at(X, "neck").map((x, i) => x - at(X, "pelvis")[i]!);
  it("bends the spine with its library's shares (playable): the neck where the clip puts it on this body, not 60 mm off", () => {
    const rig = bind(scriptData().skeleton);
    // a Quaternius, a CMU and a 100STYLE clip: their shares [0, 0, 0.5, 1], [0.25, 0.65, 1, 1] and [0, 0.45, 0.75, 1];
    // the CMU's lowest segment, which the hips carry, takes a share, so the segments above bend further to keep the neck
    for (const [id, close] of [["QUATERNIUS_SHARDFALL/Pistol_Aim_Down", 0.1], ["CMU_CURATED/Hurt_Stomach_Walk_Loop", 2], ["STYLE100/Monk_Walk", 0.1]] as const) {
      const { clip, R } = load(id), want = { ...rig.rest, spineW: R.spineW, neckW: R.neckW }, ready = core.playable(clip, R);
      expect(ready.contacts).toEqual(core.measureFacts(clip, R).contacts);
      expect(ready.shares).toEqual({ spineW: R.spineW, neckW: R.neckW });
      let kept = 0, lost = 0;
      for (const t of [0.1, 0.4, 0.7, 1]) {
        const target = neck(core.format.decodePose(want, core.format.keyAt(clip, t), new Array(108)));
        const off = (c: AnimClip) => Math.hypot(...neck(new Animator(rig).layer("b", { clip: c, time: t }).pose().points).map((x, i) => x - target[i]!));
        kept = Math.max(kept, off(ready));
        lost = Math.max(lost, off({ ...clip, contacts: ready.contacts }));
      }
      expect(kept, id).toBeLessThan(close);
      expect(lost, id).toBeGreaterThan(50);
    }
  });
});

describe("save and restore", () => {
  it("continues exactly from a save at any step, through JSON: the same later hashes, events and exact poses", () => {
    const saves: string[] = [];
    runScript(core, data, {
      each: (_, a) => {
        // the save survives JSON exactly (no −0, no undefined, nothing JSON can't write)
        const save = a.save(), text = JSON.stringify(save);
        expect(JSON.parse(text)).toEqual(save);
        saves.push(text);
      },
    });
    const K = 40;
    for (let i = 0; i < LENGTH - 1; i++) {
      const saved = JSON.parse(saves[i]!) as AnimatorSave;
      const b = start(core, data).restore(saved, data.clips);
      expect(b.hash()).toBe(straight.hashes[i]);
      const to = Math.min(LENGTH, i + 1 + K), run = runScript(core, data, { animator: b, from: i + 1, to });
      expect(run.hashes, `saved at ${i}`).toEqual(straight.hashes.slice(i + 1, to));
      expect(run.events, `saved at ${i}`).toEqual(straight.events.filter((e) => +e.split(" ")[0]! > i && +e.split(" ")[0]! < to));
      for (const [n, h] of Object.entries(run.exact)) expect(h).toBe(straight.exact[+n]);
    }
  }, 60_000);
  it("refuses a changed clip or a missing one by name, a different step size, and data that isn't a save", () => {
    const a = new Animator(rig).layer("base", { clip: walk }).layer("upper", { clip: punch, mask: "upper" });
    a.step(0.5);
    const saved = JSON.parse(JSON.stringify(a.save())) as AnimatorSave;
    const edited = { ...punch, keys: punch.keys.map((k, i) => (i === 3 ? { ...k, head: [k.head[0]! + 1, k.head[1]!, k.head[2]!] } : k)) };
    const err = (f: () => unknown) => {
      try {
        f();
      } catch (e) {
        return e as AnimatorError;
      }
      throw new Error("no error");
    };
    const changed = err(() => new Animator(rig).restore(saved, [walk, edited]));
    expect([changed.code, changed.clip]).toEqual(["E_CLIP_CHANGED", punch.id]);
    expect(changed.message).toContain(punch.id);
    const missing = err(() => new Animator(rig).restore(saved, { [walk.id]: walk }));
    expect([missing.code, missing.clip]).toEqual(["E_CLIP_MISSING", punch.id]);
    expect(err(() => new Animator(rig, { step: 1 / 30 }).restore(saved, [walk, punch])).code).toBe("E_STEP_SIZE");
    expect(err(() => new Animator(rig).restore({ format: "x" } as never, [])).code).toBe("E_SAVE");
    expect(err(() => a.step(Number.NaN)).code).toBe("E_STEP");
    expect(err(() => a.layer("x", { mask: "tail" })).code).toBe("E_LAYER");
    // a clip edited in place since it was played is refused too
    const own = JSON.parse(JSON.stringify(punch)) as AnimClip, b = new Animator(rig).layer("p", { clip: own });
    b.step(0.2);
    const kept = JSON.parse(JSON.stringify(b.save())) as AnimatorSave;
    (own.keys[3]!.head as number[])[0]! += 30;
    expect(err(() => new Animator(rig).restore(kept, [own])).code).toBe("E_CLIP_CHANGED");
    // a save made on another body is refused: root motion scales with the body
    const tall = bind({ ...data.skeleton, bones: data.skeleton.bones.map((x) => ({ ...x, head: x.head!.map((v) => v * 1.2) as [number, number, number] })) });
    expect(err(() => new Animator(tall).restore(saved, [walk, punch])).code).toBe("E_BODY_CHANGED");
    // a layer that doesn't read as a save's is refused before anything changes
    expect(err(() => new Animator(rig).restore({ ...saved, layers: [{ ...saved.layers[0]!, speed: "fast" as never }] }, [walk, punch])).code).toBe("E_SAVE");
    // the same clip's content under a new object restores fine, and an edit that changes nothing it plays is no change
    expect(new Animator(rig).restore(saved, (id) => JSON.parse(JSON.stringify(id === walk.id ? walk : punch))).hash()).toBe(a.hash());
  });
});

describe("−0", () => {
  it("keeps no −0 in its state, so a save through JSON restores to the same hash", () => {
    const a = new Animator(rig).layer("base", { clip: walk, speed: -1 * 0, time: -0 }).layer("up", { clip: punch, mask: { chest: -0, head: 1 }, weight: -0 });
    a.step(0.1);
    const b = new Animator(rig).restore(JSON.parse(JSON.stringify(a.save())), [walk, punch]);
    expect(b.hash()).toBe(a.hash());
    a.step(0.5);
    b.step(0.5);
    expect(b.hash()).toBe(a.hash());
  });
});

describe("cost", () => {
  it("measures one character's step() and pose() (stated in D38)", () => {
    const a = new Animator(rig, { ground: (f) => f * 0.03 }).layer("base", { clip: walk }).layer("run", { clip: jog, weight: 0.5 });
    a.layer("upper", { clip: punch, mask: "upper", weight: 0.7 }).layer("flinch", { clip: flinch, additive: true, weight: 0.5 });
    const time = (n: number, f: () => void) => {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) f();
      return ((performance.now() - t0) * 1000) / n;
    };
    time(300, () => (a.step(1 / 60), a.pose()));
    const step = time(3000, () => a.step(1 / 60)), full = time(600, () => (a.step(1 / 60), a.pose())) - step;
    const exact = time(600, () => (a.step(1 / 60), a.pose(undefined, { exact: true }))) - step, lod = time(600, () => (a.step(1 / 60), a.pose(undefined, { lod: 1 }))) - step;
    console.log(`animator cost, 4 layers, one character: step ${step.toFixed(1)} µs, pose ${full.toFixed(0)} µs (exact ${exact.toFixed(0)}, lod 1 ${lod.toFixed(0)})`);
    expect(step).toBeLessThan(1000);
    expect(full).toBeLessThan(20_000);
  }, 30_000);
});

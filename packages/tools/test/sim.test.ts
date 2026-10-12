// Simulation (WP-6.5, D75; spec/SIM.md): the example script's walk-to-run-to-jump trace is its expected trace exactly,
// on bodies of other proportions too; stride warping keeps a walk in place from sliding from 0.5× to 1.8× its own
// speed; hit windows from events; the root's two modes; the script's checks and their codes; a run the same twice;
// a filmstrip of it. On the tiny conformance rig, so it needs no three.js.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { bind, contact, type AnimClip, type graph as G } from "@m3a/core";
import { checks, raster } from "@m3a/sensors";
import { rigSkeleton } from "../../../spec/conformance/runner/skeleton.ts";
import { clipSource } from "../../../tools/sim/load.ts";
import { sim } from "../src/index.ts";

const ROOT = join(import.meta.dirname, "../../.."), spec = <T>(f: string) => JSON.parse(readFileSync(join(ROOT, "spec", f), "utf8")) as T;
const locomotion = spec<G.Graph>("graphs/Locomotion.json"), combo = spec<G.Graph>("graphs/Sword_Combo.json"), script = spec<sim.SimScript>("sims/Walk_Run_Jump.json");
const clips = clipSource(), body = bind(rigSkeleton()), Q = "QUATERNIUS_3D2DGE/";
const run = (s: Partial<sim.SimScript>, g = locomotion, c: (id: string) => AnimClip | undefined = clips, poses = true) => sim.simulate({ graph: g, script: { format: "2.0", id: "SIMS/Test", dur: 2, input: [], ...s }, body, clips: c, poses });

describe("a simulation", () => {
  it("runs the walk-to-run-to-jump script into its expected trace exactly, on bodies of other proportions too", () => {
    const expected = spec<sim.Trace>("sims/Walk_Run_Jump.trace.json"), r = sim.simulate({ graph: locomotion, script, body, clips });
    expect(sim.compareTraces(expected, r.trace)).toBeNull();
    expect(r.trace.states.map((s) => `${s.layer}:${s.state}`)).toEqual(["base:idle", "upper:none", "base:move", "base:jump", "base:air", "base:land", "base:move", "upper:jab", "upper:none", "base:idle"]);
    // the root follows the animation, so the states come at the same steps on a body twice as tall in the legs
    for (const p of [{ legs: 1.3, arms: 0.8 }, { all: 0.5, head: 1.4 }]) expect(sim.compareTraces(expected, sim.simulate({ graph: locomotion, script, body: bind(rigSkeleton(p)), clips, poses: false }).trace)).toBeNull();
    // and the jab's strike, which has no hit event, is named
    expect(r.warnings).toEqual([`${Q}Punch_Jab plays (jab) with a measured strike at 0.147 s and no hit event, so no hit window opens: add one (a recipe's events step)`]);
    // a different trace is named at its first difference
    expect(sim.compareTraces(expected, { ...r.trace, states: r.trace.states.map((s, i) => (i === 3 ? { ...s, step: 271 } : s)) })).toMatch(/^states\[3\]: expected .*"step":270.*, got .*"step":271/);
  }, 30_000);
  it("keeps a walk in place from sliding, stride warped, from 0.5× to 1.8× its own speed; unwarped, it slides", () => {
    const walk = clips(`${Q}Walk_Loop`)!, own = contact.contactRoot(walk as never, body.rest, walk.contacts!).speed / 1000;
    const slide = (k: number, warp: boolean) => {
      const r = run({ dur: 3, root: "in-place", ...(warp ? { warp: "warp" } : {}), input: [{ t: 0, set: { speed: 1.4 }, move: k * own }] });
      // read once the fade into the walk is done
      const m = checks.motionOfFrames(r.frames.slice(60), body.rest, { root: r.root.slice(60) });
      return { slide: checks.slide(m).value, warn: checks.levels(m, "slide").warn, rate: r.rates.at(-1)?.rate ?? 1 };
    };
    for (const k of [0.5, 0.75, 1, 1.25, 1.5, 1.8]) {
      const w = slide(k, true);
      expect([k, w.slide < w.warn, Math.round(w.rate * 1000) / 1000]).toEqual([k, true, k]);
    }
    // unwarped, the feet go back with the ground slower or faster than they step (at 0.5× and 1.8× so fast the
    // sensors don't read them as standing at all)
    for (const k of [0.75, 1.5]) expect([k, slide(k, false).slide > 150]).toEqual([k, true]);
  }, 30_000);
  it("opens a hit window at each hit event: for its dur, to its clip's hit_end, or for its step", () => {
    const jab = clips(`${Q}Punch_Jab`)!, strike = { ...jab, events: [{ t: 0.147, name: "hit", dur: 0.1 }] };
    const sword = (slug: string, events: AnimClip["events"]) => ({ ...clips(Q + slug)!, events });
    const c = (id: string) => (id === `${Q}Punch_Jab` ? strike : id === `${Q}Sword_Regular_A` ? sword("Sword_Regular_A", [{ t: 0.2, name: "hit" }, { t: 0.3, name: "hit_end" }]) : id === `${Q}Sword_Regular_B` ? sword("Sword_Regular_B", [{ t: 0.25, name: "hit" }]) : clips(id));
    const jabs = run({ dur: 1, input: [{ t: 0.1, trigger: "punch" }] }, locomotion, c, false);
    // the jab, entered at step 6, plays at 1.2: its strike 0.147 s in passes in step 6 + 7, open 0.1 s of the clip (5
    // steps at 1.2)
    expect(locomotion.layers![0]!.states.jab!.speed).toBe(1.2);
    expect(jabs.trace.hits).toEqual([{ open: 13, close: 18, t0: 0.216667, t1: 0.3, layer: "upper", state: "jab", clip: `${Q}Punch_Jab` }]);
    expect(jabs.warnings).toEqual([]);
    const combos = run({ dur: 1.5, input: [{ t: 0, trigger: "attack" }, { t: 0.3, trigger: "attack" }] }, combo, c, false);
    expect(combos.trace.hits.map((x) => [x.state, x.close - x.open])).toEqual([["a", 6], ["b", 1]]);
    expect(combos.trace.events.filter((e) => e.name.startsWith("hit")).map((e) => `${e.name} ${e.state}`)).toEqual(["hit a", "hit_end a", "hit b"]);
  });
  it("moves the root by the animation, or in place at the ground speed given (eased over a row's seconds)", () => {
    const rooted = run({ dur: 2, input: [{ t: 0, set: { speed: 1.4 } }] }), last = rooted.path.at(-1)!;
    expect([last.forward > 1000, rooted.root.at(-1)!.forward === last.forward || Math.abs(rooted.root.at(-1)!.forward - last.forward) < 0.1]).toEqual([true, true]);
    const placed = run({ dur: 2, root: "in-place", input: [{ t: 0, move: 1 }, { t: 1, move: 2, over: 0.5 }] });
    // 1 m/s for a second, eased to 2 over half a second, then 2 for the half left: 2.75 m, as the sim steps it
    expect(Math.abs(placed.path.at(-1)!.forward - 2750)).toBeLessThan(20);
    expect(placed.root.every((r) => r.right === 0 && r.yaw === 0)).toBe(true);
  });
  it("is the same run twice: the same trace, frames and sensors", () => {
    const s: Partial<sim.SimScript> = { dur: 1.5, input: [{ t: 0.2, set: { speed: 2.5 }, over: 0.4 }, { t: 1, trigger: "jump" }] };
    const a = run(s), b = run(s);
    expect([b.trace, b.path, b.sensors]).toEqual([a.trace, a.path, a.sensors]);
    expect(b.frames.every((f, i) => f.every((x, j) => x === a.frames[i]![j]))).toBe(true);
  });
  it("draws a filmstrip of the run, each frame labelled with its time and the states playing", () => {
    const r = run({ dur: 1.5, input: [{ t: 0.2, set: { speed: 1.4 } }, { t: 0.8, trigger: "punch" }] }), img = sim.filmstrip(r, 4, 120);
    expect([img.width, img.height]).toEqual([4 * 120 + 3 * 2, 150]);
    raster.assertNotBlank(img);
  });
  it("checks a script, each issue with its code, where and a fix; the schema says what JSON Schema can", () => {
    const codes = (s: unknown, g: G.Graph | undefined = locomotion) => sim.validateScript(s, g).map((i) => i.code);
    expect([codes(script), codes(spec("sims/Walk_In_Place.json"))]).toEqual([[], []]);
    const base = { format: "2.0", id: "SIMS/T", dur: 2, input: [{ t: 0, set: { speed: 1 } }] };
    const cases: [string, unknown, G.Graph?][] = [
      ["S-E001", { ...base, id: "nope" }],
      ["S-E002", { ...base, input: [{ t: 1, set: { speed: 1 } }, { t: 0.5, set: { speed: 2 } }] }],
      ["S-E002", { ...base, input: [{ t: 1 }] }],
      ["S-E003", { ...base, input: [{ t: 0, set: { pace: 1 } }] }],
      ["S-E003", { ...base, input: [{ t: 0, set: { grounded: 1 } }] }],
      ["S-E003", { ...base, input: [{ t: 0, trigger: "jmup" }] }],
      ["S-E004", { ...base, dur: 0 }],
      ["S-E004", { ...base, input: [{ t: 0, move: -1 }] }],
      ["S-E005", { ...base, warp: "warp" }],
      ["S-E005", { ...base, root: "in-place", warp: "speed" }],
      ["S-E006", { ...base, inptu: [] }],
      ["S-E007", { ...base, graph: "GRAPHS/Other" }],
    ];
    for (const [code, s, g] of cases) expect([code, codes(s, g)]).toEqual([code, [code]]);
    expect(sim.validateScript(cases[5]![1], locomotion)[0]!.fix).toBe("jump, punch");
    expect(Object.keys(sim.SIM_RULES)).toEqual(["S-E001", "S-E002", "S-E003", "S-E004", "S-E005", "S-E006", "S-E007"]);
    const ajv = new Ajv2020({ strict: false, allErrors: true }), schema = ajv.compile(spec("schemas/sim.schema.json")), trace = ajv.compile(spec("schemas/sim-trace.schema.json"));
    expect([schema(script), schema(spec("sims/Walk_In_Place.json")), trace(spec("sims/Walk_Run_Jump.trace.json"))]).toEqual([true, true, true]);
    for (const [code, s] of cases.filter(([c], i) => ["S-E001", "S-E006"].includes(c) || [2, 6, 7].includes(i))) expect([code, schema(s)]).toEqual([code, false]);
    expect(() => run({ input: [{ t: 0, trigger: "jmup" }] })).toThrow(/S-E003 input.0.trigger GRAPHS\/Locomotion has no trigger "jmup" \(jump, punch\)/);
  });
});

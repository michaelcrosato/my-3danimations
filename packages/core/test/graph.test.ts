// Graphs (WP-6.4, spec/GRAPH.md): the checks and their codes; blend weights; the two example graphs' scripted runs (the
// states they go through, the same after a save and restore); transitions (conditions, exit, cancel windows, triggers
// kept until used, sync, interrupts); layers (pass, masks, additive); blend spaces in phase; events to callbacks; and
// the Animator's refusals. Node and Chromium give the same runs bit for bit: tests/e2e/animator-parity.e2e.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import * as core from "../src/index.ts";
import { Animator, AnimatorError, bind, graph as G, type AnimClip } from "../src/index.ts";
import { graphData } from "./graph-data.ts";
import { runGraph } from "./graph-script.ts";

const data = graphData(), Q = "QUATERNIUS_3D2DGE/";
const clip = (slug: string) => data.clips.find((c) => c.id === Q + slug)! as AnimClip;
const animator = () => new Animator(bind(data.skeleton), { step: 1 / 60 });
/** A graph of one layer from states and transitions (and parameters). */
const graphOf = (states: Record<string, G.GraphState>, transitions: G.GraphTransition[], parameters: Record<string, G.GraphParameter> = {}, start = Object.keys(states)[0]!): G.Graph => ({ format: "2.0", id: "GRAPHS/Test", parameters, start, states, transitions });
const codes = (g: unknown, clips?: (id: string) => unknown) => G.validateGraph(g, clips ? { clips } : {}).map((i) => i.code);
const seconds = (a: Animator, s: number) => {
  for (let i = 0; i < Math.round(s * 60); i++) a.step(1 / 60);
};

describe("a graph's checks", () => {
  it("pass the two example graphs, and the Animator's clips are all there", () => {
    for (const g of [data.locomotion, data.combo]) expect([g.id, G.validateGraph(g, { clips: (id) => data.clips.find((c) => c.id === id) })]).toEqual([g.id, []]);
  });
  it("name each problem with its code, where it is and a fix", () => {
    const idle = { clip: Q + "Idle_Loop" }, walk = { clip: Q + "Walk_Loop" }, p = { speed: { type: "number" as const }, go: { type: "trigger" as const }, on: { type: "bool" as const } };
    const ok = graphOf({ idle, walk }, [{ from: "idle", to: "walk", when: [{ param: "speed", op: ">", value: 1 }] }], p);
    expect(codes(ok)).toEqual([]);
    const cases: [string, unknown][] = [
      ["G-E001", { format: "2.0", id: "GRAPHS/X", states: {}, transitions: [] }],
      ["G-E002", graphOf({ idle: { clip: Q + "Idle_Loop", recipe: "RECIPES/X" }, walk }, [{ from: "idle", to: "walk" }])],
      ["G-E002", graphOf({ idle, walk: { blend: { param: "speed", points: [{ at: 2, clip: Q + "Walk_Loop" }, { at: 1, clip: Q + "Jog_Fwd_Loop" }] } } }, [{ from: "idle", to: "walk" }], p)],
      ["G-E002", graphOf({ idle: { pass: true }, walk }, [{ from: "idle", to: "walk" }])],
      ["G-E003", graphOf({ idle, walk }, [{ from: "idle", to: "run" }, { from: "idle", to: "walk" }])],
      ["G-E003", graphOf({ idle, walk: { blend: { param: "pace", points: [{ at: 1, clip: Q + "Walk_Loop" }, { at: 2, clip: Q + "Jog_Fwd_Loop" }] } } }, [{ from: "idle", to: "walk" }], p)],
      ["G-E004", graphOf({ idle, walk }, [{ from: "idle", to: "walk", when: [{ param: "pace", op: ">", value: 1 }] }], p)],
      ["G-E004", graphOf({ idle, walk }, [{ from: "idle", to: "walk", when: [{ param: "go", op: "==", value: true }] }], p)],
      ["G-E004", graphOf({ idle, walk }, [{ from: "idle", to: "walk", when: [{ param: "on", op: ">", value: 1 }] }], p)],
      ["G-E005", graphOf({ idle, walk }, [{ from: "idle", to: "walk", fade: -1 }])],
      ["G-E005", graphOf({ idle, walk }, [{ from: "idle", to: "walk", window: [0.5, 0.2] }])],
      ["G-E005", graphOf({ idle, walk }, [{ from: "idle", to: "walk", exit: 2 }])],
      ["G-E006", graphOf({ idle, walk }, [{ from: "idle", to: "walk" }], { speed: { type: "float" } } as never)],
      ["G-E006", graphOf({ idle, walk }, [{ from: "idle", to: "walk" }], { on: { type: "bool", value: 1 } } as never)],
      ["G-E007", graphOf({ idle, walk }, [{ from: "idle", to: "walk", fdae: 0.2 } as never])],
      ["G-E008", graphOf({ idle, walk }, [])],
      ["G-E010", { ...graphOf({ idle, walk }, [{ from: "idle", to: "walk" }]), layers: [{ name: "base", start: "a", states: { a: idle }, transitions: [] }] }],
      ["G-E010", { ...graphOf({ idle, walk }, [{ from: "idle", to: "walk" }]), layers: [{ name: "up", mask: "wings", start: "a", states: { a: idle }, transitions: [] }] }],
    ];
    for (const [code, g] of cases) expect([code, codes(g)]).toEqual([code, [code]]);
    // what JSON Schema can say, spec/schemas/graph.schema.json says too
    const schema = new Ajv2020({ strict: false, allErrors: true }).compile(JSON.parse(readFileSync(join(import.meta.dirname, "../../../spec/schemas/graph.schema.json"), "utf8")) as object);
    expect([schema(data.locomotion), schema(data.combo), schema(ok)]).toEqual([true, true, true]);
    for (const [code, g] of cases.filter(([c], i) => ["G-E001", "G-E006", "G-E007"].includes(c) || i === 1 || i === 9 || i === 11)) expect([code, schema(g)]).toEqual([code, false]);
    expect(G.validateGraph(cases[14]![1])[0]!.fix).toBe('"fade"');
    expect(codes(ok, (id) => (id === Q + "Walk_Loop" ? clip("Walk_Loop") : undefined))).toEqual(["G-E009"]);
    expect(Object.keys(G.GRAPH_RULES)).toEqual(["G-E001", "G-E002", "G-E003", "G-E004", "G-E005", "G-E006", "G-E007", "G-E008", "G-E009", "G-E010"]);
  });
});

describe("blend weights", () => {
  it("on one parameter: linear between the points either side, the ends held", () => {
    const at = [1.4, 3.2, 6];
    expect(G.weights1D(at, 0)).toEqual([1, 0, 0]);
    expect(G.weights1D(at, 9)).toEqual([0, 0, 1]);
    expect(G.weights1D(at, 2.3).map((w) => Math.round(w * 1e9) / 1e9)).toEqual([0.5, 0.5, 0]);
    expect(G.weights1D(at, 3.2)).toEqual([0, 1, 0]);
  });
  it("on two, by gradient bands: a point alone at itself, the rest summing to 1, mirrored inputs mirrored", () => {
    const at: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    expect(G.weights2D(at, [1, 0])).toEqual([0, 1, 0, 0, 0]);
    for (const p of [[0.3, 0.2], [-0.7, 0.5], [2, 2]] as [number, number][]) {
      const w = G.weights2D(at, p);
      expect(Math.abs(w.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-12);
      expect(w.every((x) => x >= 0)).toBe(true);
      const m = G.weights2D(at, [-p[0], p[1]]);
      expect([m[0], m[1], m[2]].map((x) => Math.round(x! * 1e9))).toEqual([w[0], w[2], w[1]].map((x) => Math.round(x! * 1e9)));
    }
  });
});

describe("the example graphs, scripted", () => {
  // the transitions taken, in order, from the states' entries
  const taken = (r: { events: string[] }) => r.events.filter((e) => e.startsWith("enter ")).map((e) => `${e.split(" ")[1]}:${e.split(" ").at(-1)}`);
  it("locomotion goes from standing through a walk, a jog and a sprint into a jump, lands, jabs and stands again", () => {
    const r = runGraph(core, data, "locomotion");
    expect(taken(r)).toEqual(["base:idle>move", "base:move>jump", "base:jump>land", "base:land>move", "upper:none>jab", "upper:jab>none", "base:move>idle", "upper:none>jab", "upper:jab>none", "base:idle>move"]);
    // each strike of the jab lands once; the walk's feet fall
    expect([r.events.filter((e) => e.startsWith("hit ")).length, r.events.filter((e) => e.startsWith("step ")).length > 10]).toEqual([2, true]);
  }, 30_000);
  it("the combo chains a strike pressed within its window, and recovers to guard from one pressed outside", () => {
    const r = runGraph(core, data, "combo");
    expect(taken(r)).toEqual(["base:guard>a", "base:a>b", "base:b>c", "base:c>guard", "base:guard>a", "base:a>a_rec", "base:a_rec>guard", "base:guard>a", "base:a>b", "base:b>b_rec", "base:b_rec>guard", "base:guard>a", "base:a>a_rec", "base:a_rec>b", "base:b>b_rec", "base:b_rec>guard"]);
  }, 30_000);
  it("carries on after a save and a restore (as JSON) exactly: the same hashes, events and states", () => {
    for (const w of ["locomotion", "combo"] as const) {
      const a = runGraph(core, data, w), b = runGraph(core, data, w, { restoreAt: 300 });
      expect([w, b.hashes, b.events, b.states, b.exact]).toEqual([w, a.hashes, a.events, a.states, a.exact]);
    }
  }, 60_000);
});

describe("a graph playing", () => {
  const two = (t: Partial<G.GraphTransition>) => graphOf({ a: { clip: Q + "Sword_Regular_A" }, b: { clip: Q + "Sword_Regular_B" } }, [{ from: "a", to: "b", fade: 0, ...t }], { go: { type: "trigger" }, n: { type: "number" } });
  it("takes a transition only when its conditions hold, once the state has played its exit share, within its window", () => {
    const a = animator().play(two({ exit: 0.5 }), data.clips);
    seconds(a, 0.15);
    expect(a.graph!.states[0]!.state).toBe("a");
    seconds(a, 0.15);
    expect(a.graph!.states[0]!.state).toBe("b");
    // a window [0.1, 0.2] s: a press before it waits; one after it is too late, and stays set
    const w = animator().play(two({ when: [{ param: "go" }], window: [0.1, 0.2] }), data.clips);
    w.trigger("go");
    seconds(w, 0.05);
    expect(w.graph!.states[0]!.state).toBe("a");
    seconds(w, 0.1);
    expect(w.graph!.states[0]!.state).toBe("b");
    const late = animator().play(two({ when: [{ param: "go" }], window: [0.1, 0.2] }), data.clips);
    seconds(late, 0.3);
    late.trigger("go");
    seconds(late, 0.2);
    expect([late.graph!.states[0]!.state, late.graph!.params.go]).toEqual(["a", true]);
    // a number condition
    const n = animator().play(two({ when: [{ param: "n", op: ">=", value: 2 }] }), data.clips);
    n.set("n", 1.5);
    seconds(n, 0.1);
    n.set("n", 2);
    seconds(n, 0.05);
    expect(n.graph!.states[0]!.state).toBe("b");
  });
  it("uses a trigger once, never restarts a state from *, starts in step when it syncs, and lets an interruptible fade be cut", () => {
    const loops = graphOf({ walk: { clip: Q + "Walk_Loop" }, jog: { clip: Q + "Jog_Fwd_Loop" }, idle: { clip: Q + "Idle_Loop" } }, [
      { from: "*", to: "walk", when: [{ param: "w" }], fade: 0.1 },
      { from: "walk", to: "jog", when: [{ param: "j" }], fade: 0.3, sync: true, interruptible: true },
      { from: "jog", to: "idle", when: [{ param: "i" }], fade: 0.2 },
      { from: "idle", to: "walk", when: [{ param: "w" }] },
    ], { w: { type: "trigger" }, j: { type: "trigger" }, i: { type: "trigger" } }, "walk");
    const a = animator().play(loops, data.clips);
    a.trigger("w");
    seconds(a, 0.2);
    // * doesn't restart the walk it is in, and the trigger waits for a state it can leave by it
    expect([a.graph!.states[0]!.state, a.graph!.params.w]).toEqual(["walk", true]);
    seconds(a, 0.5);
    const walkPhase = a.layers.find((L) => L.name.startsWith("@base/1/"))!.time / clip("Walk_Loop").dur;
    a.trigger("j");
    a.step(1 / 60);
    // the jog starts at the walk's phase (a step on, at the walk's speed)
    const jog = a.layers.find((L) => L.name.startsWith("@base/2/"))!;
    expect(Math.abs(jog.time / clip("Jog_Fwd_Loop").dur - walkPhase)).toBeLessThan(2 / 60 / clip("Jog_Fwd_Loop").dur);
    // mid-fade, interruptible: the jog's transitions are read at once, and the waiting w takes * into the walk first
    a.trigger("i");
    a.step(1 / 60);
    expect(a.graph!.states[0]).toEqual({ layer: "base", state: "walk", from: "jog", fade: 1 / 60 / 0.1 });
    expect(a.graph!.params).toEqual({ i: true });
  });
  it("plays a layer over the base: nothing in a pass state, only its masked fields in one with a clip, added when additive", () => {
    const loco = data.locomotion, a = animator().play(loco, data.clips), b = animator().play({ ...loco, layers: [] }, data.clips);
    seconds(a, 0.5);
    seconds(b, 0.5);
    // passing, the layer shows the base through: the same key as without the layer
    expect(a.key()).toEqual(b.key());
    a.trigger("punch");
    seconds(a, 0.4);
    seconds(b, 0.4);
    const ka = a.key()!, kb = b.key()!;
    expect([JSON.stringify(ka.armR) !== JSON.stringify(kb.armR), ka.legL, ka.legR, ka.hips]).toEqual([true, kb.legL, kb.legR, kb.hips]);
    // added: a nod's change over the base, at the layer's weight
    const add = animator().play({ ...loco, layers: [{ name: "nod", additive: true, weight: 0.5, start: "n", states: { n: { clip: Q + "Punch_Jab" } }, transitions: [] }] }, data.clips);
    expect(add.layers.at(-1)).toMatchObject({ additive: true, weight: 0.5 });
  });
  it("keeps a blend space's clips in phase, each at the speed that keeps it there", () => {
    const a = animator().play(data.locomotion, data.clips).set("speed", 2.3);
    seconds(a, 1.5);
    const move = a.layers.filter((L) => L.name.startsWith("@base/2/") && L.weight > 0);
    expect(move.map((L) => L.clip)).toEqual([Q + "Walk_Loop", Q + "Jog_Fwd_Loop"]);
    const phases = move.map((L) => L.time / clip(L.clip!.split("/")[1]!).dur);
    expect(Math.abs(phases[0]! - phases[1]!)).toBeLessThan(1e-9);
    // the walk and the jog at half each: the jog's layer over the walk's at a half
    expect(move.map((L) => Math.round(L.weight * 1e9) / 1e9)).toEqual([1, 0.5]);
  });
  it("delivers events to callbacks in order, a state's entry among them, and a callback's trigger plays from the next step", () => {
    const a = animator().play(data.combo, data.clips), seen: string[] = [];
    const off = a.on("hit", (e) => {
      seen.push(`${e.name} ${e.clip}`);
      a.trigger("attack");
    });
    a.on("enter", (e) => seen.push(`enter ${String(e.event.from)}>${String(e.event.state)}`));
    a.trigger("attack");
    seconds(a, 0.3);
    expect(seen).toEqual(["enter guard>a", `hit ${Q}Sword_Regular_A`, "enter a>b"]);
    // undone, the callback hears no more: the strike it pressed on lands unheard
    off();
    seconds(a, 0.6);
    expect([seen.filter((s) => s.startsWith("hit")).length, seen.at(-1)]).toEqual([1, "enter b>b_rec"]);
  });
  it("refuses what it can't play, saying why", () => {
    const err = (f: () => unknown) => {
      try {
        f();
      } catch (e) {
        return [(e as AnimatorError).code, (e as Error).message.slice(0, 60)];
      }
      return null;
    };
    expect(err(() => animator().play(graphOf({ a: { clip: Q + "Idle_Loop" } }, [{ from: "a", to: "b" }]), data.clips))?.[0]).toBe("E_GRAPH");
    expect(err(() => animator().play(data.combo, data.clips.slice(0, 2)))?.[0]).toBe("E_GRAPH");
    expect(err(() => animator().set("speed", 1))?.[0]).toBe("E_GRAPH");
    const a = animator().play(data.locomotion, data.clips);
    expect([err(() => a.set("pace", 1))?.[0], err(() => a.set("speed", true))?.[0], err(() => a.trigger("speed"))?.[0], err(() => a.layer("@base/1/0", {}))?.[0]]).toEqual(["E_PARAM", "E_PARAM", "E_PARAM", "E_LAYER"]);
    a.step(0.5);
    const saved = JSON.parse(JSON.stringify(a.save()));
    expect(err(() => animator().restore(saved, data.clips))?.[0]).toBe("E_GRAPH_MISSING");
    expect(err(() => animator().restore(saved, data.clips, { ...data.locomotion, desc: "another" }))?.[0]).toBe("E_GRAPH_CHANGED");
    // stopped, its layers go and a save carries no graph
    a.stop();
    expect([a.layers.length, a.graph, a.save().graph]).toEqual([0, null, undefined]);
  });
});

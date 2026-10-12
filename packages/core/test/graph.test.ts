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
      // what an agent may write: layers by name, as states are; a mask naming a group as a field, or a field misspelt
      ["G-E010", { ...graphOf({ idle, walk }, [{ from: "idle", to: "walk" }]), layers: {} }],
      ["G-E010", { ...graphOf({ idle, walk }, [{ from: "idle", to: "walk" }]), layers: "upper" }],
      ["G-E010", { ...graphOf({ idle, walk }, [{ from: "idle", to: "walk" }]), layers: [{ name: "up", mask: { upper: 1 }, start: "a", states: { a: idle }, transitions: [] }] }],
      ["G-E010", { ...graphOf({ idle, walk }, [{ from: "idle", to: "walk" }]), layers: [{ name: "up", mask: { armr: 1 }, start: "a", states: { a: idle }, transitions: [] }] }],
      ["G-E002", graphOf({ idle, walk: { blend: { param: "speed", points: [null, { at: 2, clip: Q + "Jog_Fwd_Loop" }] } } } as never, [{ from: "idle", to: "walk" }], p)],
      ["G-E006", graphOf({ idle, walk }, [{ from: "idle", to: "walk", when: [{ param: "go" }] }], { go: { type: "trigger", buffer: -1 } })],
      ["G-E001", { ...ok, tags: "locomotion" }],
      ["G-E001", { ...ok, name: 3 }],
    ];
    for (const [code, g] of cases) expect([code, codes(g)]).toEqual([code, [code]]);
    // what JSON Schema can say, spec/schemas/graph.schema.json says too
    const schema = new Ajv2020({ strict: false, allErrors: true }).compile(JSON.parse(readFileSync(join(import.meta.dirname, "../../../spec/schemas/graph.schema.json"), "utf8")) as object);
    expect([schema(data.locomotion), schema(data.combo), schema(ok)]).toEqual([true, true, true]);
    for (const [code, g] of cases.filter(([c], i) => ["G-E001", "G-E006", "G-E007"].includes(c) || i === 1 || i === 9 || i === 11 || (i >= 18 && i <= 22))) expect([code, schema(g)]).toEqual([code, false]);
    expect([G.validateGraph(cases[20]![1])[0]!.fix, G.validateGraph(cases[21]![1])[0]!.fix]).toEqual(['"mask": "upper"', '"armR"']);
    // a one-shot played backward never reaches its exit: refused, with the clips that tell it is one
    expect(codes(graphOf({ idle, walk: { clip: Q + "Jump_Start", speed: -1 } }, [{ from: "idle", to: "walk" }]), (id) => data.clips.find((c) => c.id === id))).toEqual(["G-E005"]);
    // every issue says how to fix it
    expect(cases.flatMap(([, g]) => G.validateGraph(g)).filter((i) => !i.fix)).toEqual([]);
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
    expect(taken(r)).toEqual(["base:idle>move", "base:move>jump", "base:jump>air", "base:air>land", "base:land>move", "upper:none>jab", "upper:jab>none", "base:move>idle", "upper:none>jab", "upper:jab>none", "base:idle>move"]);
    // each strike of the jab lands once; the walk's feet fall
    expect([r.events.filter((e) => e.startsWith("hit ")).length, r.events.filter((e) => e.startsWith("step ")).length > 10]).toEqual([2, true]);
  }, 30_000);
  it("the combo chains a strike pressed within its window, and recovers to guard when none is", () => {
    const r = runGraph(core, data, "combo");
    expect(taken(r)).toEqual(["base:guard>a", "base:a>b", "base:b>c", "base:c>guard", "base:guard>a", "base:a>a_rec", "base:a_rec>guard", "base:guard>a", "base:a>b", "base:b>b_rec", "base:b_rec>guard", "base:guard>a", "base:a>a_rec", "base:a_rec>b", "base:b>b_rec", "base:b_rec>guard"]);
  }, 30_000);
  it("carries on after a save and a restore (as JSON) exactly: mid-blend, with a trigger waiting, inside a fade that may be cut", () => {
    for (const w of ["locomotion", "combo"] as const) {
      // the first step with a press waiting, and the first inside an interruptible fade (the land's into the move)
      let waiting = -1, cut = -1;
      const a = runGraph(core, data, w, {
        onStep: (x, i) => {
          const g = x.save().graph!;
          if (waiting < 0 && i > 0 && Object.keys(g.triggers).length) waiting = i + 1;
          if (cut < 0 && g.layers.some((L) => L.out.length && L.interruptible)) cut = i + 1;
        },
      });
      // (the locomotion script's presses are each used at the next step)
      expect([w, w === "locomotion" || waiting > 0, w === "combo" || cut > 0]).toEqual([w, true, true]);
      for (const at of w === "combo" ? [waiting, 300] : [cut]) {
        const b = runGraph(core, data, w, { restoreAt: at });
        expect([w, at, b.hashes, b.events, b.states, b.exact]).toEqual([w, at, a.hashes, a.events, a.states, a.exact]);
      }
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
  it("plays a state faded into from its first step, its share linear over the fade, so its first events fire", () => {
    const b = { ...clip("Sword_Regular_B"), id: "TEST/B", events: [{ t: 0, name: "start" }, { t: 0.01, name: "early" }, { t: 0.05, name: "later" }] };
    const g = graphOf({ a: { clip: Q + "Sword_Idle" }, b: { clip: "TEST/B" } }, [{ from: "a", to: "b", when: [{ param: "go" }], fade: 0.1 }], { go: { type: "trigger" } });
    const a = animator().play(g, [...data.clips, b]), seen: string[] = [];
    a.on("*", (e) => seen.push(e.name));
    a.trigger("go");
    const shares: number[] = [];
    for (let i = 0; i < 7; i++) {
      a.step(1 / 60);
      shares.push(a.layers.find((L) => L.name === "@base/2/0")?.weight ?? -1);
    }
    expect(seen).toEqual(["enter", "start", "early", "later"]);
    // a sixth more each step, and done on the sixth: the state left goes at the next
    expect(shares.map((w) => Math.round(w * 1e9) / 1e9)).toEqual([1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1, 1].map((w) => Math.round(w * 1e9) / 1e9));
    expect(a.layers.map((L) => L.name)).toEqual(["@base/2/0"]);
  });
  it("leaves a loop at its exit share even when a step carries it past, within the cycle", () => {
    // the jog is 56 steps: its phases are k/56, and 55/56 is under 0.99, so the share is stepped over at the seam
    const g = graphOf({ w: { clip: Q + "Jog_Fwd_Loop" }, b: { clip: Q + "Sword_Idle" } }, [{ from: "w", to: "b", exit: 0.99, fade: 0 }]);
    const a = animator().play(g, data.clips);
    let left = -1;
    for (let i = 0; i < 120 && left < 0; i++) {
      a.step(1 / 60);
      if (a.graph!.states[0]!.state === "b") left = i;
    }
    expect(left).toBe(56);
  });
  it("cuts a fade without a jump: what it was fading out goes on fading out from where it was", () => {
    const g = graphOf({ idle: { clip: Q + "Idle_Loop" }, strike: { clip: Q + "Sword_Regular_C" }, guard: { clip: Q + "Sword_Idle" } }, [
      { from: "idle", to: "strike", when: [{ param: "go" }], fade: 0.5, interruptible: true },
      { from: "strike", to: "guard", when: [{ param: "stop" }], fade: 0.5 },
    ], { go: { type: "trigger" }, stop: { type: "trigger" } });
    const a = animator().play(g, data.clips), moves: number[] = [];
    let last: Record<string, readonly number[]> | null = null;
    const step = () => {
      a.step(1 / 60);
      const j = a.pose(undefined, { exact: true }).joints;
      if (last) moves.push(Math.max(...Object.keys(j).map((k) => Math.hypot(...j[k]!.map((v, i) => v - last![k]![i]!)))));
      last = j;
    };
    a.trigger("go");
    for (let i = 0; i < 6; i++) step();
    a.trigger("stop");
    for (let i = 0; i < 6; i++) step();
    // the most a joint moves in a step as the fade is cut, against the most before it
    expect(a.save().graph!.layers[0]!.out.map((o) => [o.state, Math.round(o.w * 1e6) / 1e6])).toEqual([["idle", Math.round((1 - 6 / 30) * 1e6) / 1e6], ["strike", Math.round((6 / 30) * 1e6) / 1e6]]);
    expect(Math.max(...moves.slice(5))).toBeLessThan(2 * Math.max(...moves.slice(0, 5)));
  });
  it("keeps a trigger for its buffer, clears it when set false, and keeps an unbuffered one until it is used", () => {
    const g = graphOf({ a: { clip: Q + "Sword_Regular_A" }, b: { clip: Q + "Sword_Regular_B" } }, [{ from: "a", to: "b", when: [{ param: "go" }, { param: "late" }], window: [0.4, 0.43], fade: 0 }], { go: { type: "trigger", buffer: 0.1 }, late: { type: "trigger" } });
    const a = animator().play(g, data.clips);
    a.trigger("go").trigger("late");
    seconds(a, 0.1);
    expect(a.graph!.params).toEqual({ go: true, late: true });
    a.step(1 / 60);
    expect(a.graph!.params).toEqual({ late: true });
    a.set("late", false);
    expect(a.graph!.params).toEqual({});
    a.set("go", true);
    expect(a.graph!.params).toEqual({ go: true });
  });
  it("plays an upper layer's fade at its weight, and an additive one's at the weight times each share", () => {
    const sw = (a: Animator, prefix: string) => a.layers.filter((L) => L.name.startsWith(prefix)).map((L) => L.weight);
    const layer = (extra: Partial<G.GraphLayer>): G.Graph => ({ ...graphOf({ idle: { clip: Q + "Idle_Loop" } }, []), parameters: { go: { type: "trigger" } }, layers: [{ name: "up", weight: 0.5, start: "x", states: { x: { clip: Q + "Punch_Jab" }, y: { clip: Q + "Sword_Regular_A" } }, transitions: [{ from: "x", to: "y", when: [{ param: "go" }], fade: 0.1 }], ...extra }] });
    for (const additive of [false, true]) {
      const a = animator().play(layer({ additive }), data.clips);
      a.trigger("go");
      for (let i = 0; i < 3; i++) a.step(1 / 60);
      const [wOut, wIn] = sw(a, "@up/") as [number, number], f = 3 / 6;
      // over the base: the base keeps 1 − 0.5, the state left 0.5 × (1 − f), the one entered 0.5 × f
      const shares = additive ? [wOut, wIn] : [wOut * (1 - wIn), wIn];
      expect([additive, ...shares.map((x) => Math.round(x * 1e9))]).toEqual([additive, Math.round(0.5 * (1 - f) * 1e9), Math.round(0.5 * f * 1e9)]);
    }
  });
  it("reads an unsynced blend's exit on its heaviest point, starts a clip state at its `at`", () => {
    const g = graphOf({ m: { blend: { param: "s", sync: false, points: [{ at: 0, clip: Q + "Walk_Loop" }, { at: 1, clip: Q + "Jog_Fwd_Loop" }] } }, b: { clip: Q + "Sword_Regular_B", at: 0.3 } }, [{ from: "m", to: "b", exit: 0.5, fade: 0 }], { s: { type: "number", value: 0.8 } });
    const a = animator().play(g, data.clips);
    // the jog (0.933 s) is the heavier: half of it is 28 steps, where half the walk would be 40
    let left = -1;
    for (let i = 0; i < 60 && left < 0; i++) {
      a.step(1 / 60);
      if (a.graph!.states[0]!.state === "b") left = i;
    }
    expect(left).toBe(28);
    expect(a.layers[0]!.time).toBeCloseTo(0.3 + 1 / 60, 9);
  });
  it("runs a callback's trigger from the next fixed step, inside one long step too; puts its layers under the host's", () => {
    const a = animator().play(data.combo, data.clips), at: number[] = [];
    a.on("enter", (e) => at.push(Math.round(e.at * 60)));
    a.on("hit", () => a.trigger("attack"));
    a.trigger("attack");
    // one step of half a second: the strike pressed on by the hit is entered the fixed step after the hit's, not after
    // the half second (the hit passes in the step whose playhead first reaches it, the strike's first at time h)
    const hit = Math.ceil(clip("Sword_Regular_A").events![0]!.t * 60 - 1e-9) - 1;
    a.step(0.5);
    expect(at).toEqual([0, hit + 1]);
    a.layer("host", { clip: clip("Idle_Loop"), weight: 0.2 });
    a.step(1 / 60);
    expect(a.layers.at(-1)!.name).toBe("host");
    // played again over itself, its layers start over
    a.play(data.combo, data.clips);
    expect(a.layers.map((L) => L.name)).toEqual(["@base/1/0", "host"]);
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
    expect([err(() => a.set("pace", 1))?.[0], err(() => a.set("speed", true))?.[0], err(() => a.trigger("speed"))?.[0], err(() => a.layer("@base/1/0", {}))?.[0], err(() => a.remove("@base/1/0"))?.[0]]).toEqual(["E_PARAM", "E_PARAM", "E_PARAM", "E_LAYER", "E_LAYER"]);
    expect(err(() => a.set("speed", NaN))).toEqual(["E_PARAM", '"speed" is a number, not NaN']);
    expect(err(() => a.trigger("jmup"))).toEqual(["E_PARAM", 'graph "GRAPHS/Locomotion" has no trigger "jmup": jump, punch']);
    a.step(0.5);
    const saved = JSON.parse(JSON.stringify(a.save()));
    expect(err(() => animator().restore(saved, data.clips))?.[0]).toBe("E_GRAPH_MISSING");
    expect(err(() => animator().restore(saved, data.clips, { ...data.locomotion, desc: "another" }))?.[0]).toBe("E_GRAPH_CHANGED");
    // a clip the graph names but isn't playing, edited since: refused, by name
    const edited = data.clips.map((c) => (c.id === Q + "Jump_Land" ? { ...c, dur: c.dur + 0.1 } : c));
    expect(err(() => animator().restore(saved, edited, data.locomotion))?.[0]).toBe("E_CLIP_CHANGED");
    // a save whose graph state the graph can't have
    const tamper = (f: (g: G.GraphSave) => void) => {
      const s = JSON.parse(JSON.stringify(saved)) as typeof saved;
      f(s.graph);
      return err(() => animator().restore(s, data.clips, data.locomotion))?.[0];
    };
    expect([tamper((g) => (g.layers[0]!.state = "nope")), tamper((g) => (g.params.speed = "fast" as never)), tamper((g) => (g.triggers = { nope: 0 })), tamper((g) => (g.layers[0]!.out = [{ state: "nope", entry: 1, w: 1 }]))]).toEqual(["E_SAVE", "E_SAVE", "E_SAVE", "E_SAVE"]);
    // stopped, its layers go and a save carries no graph
    a.stop();
    expect([a.layers.length, a.graph, a.save().graph]).toEqual([0, null, undefined]);
  });
});

describe("what the verifier's second round pinned", () => {
  const r9 = (x: number) => Math.round(x * 1e9) / 1e9;
  /** The graph's base states each step: its layer's state, as `layer:state`, from a script of `steps`. */
  const statesOf = (g: G.Graph, steps: number, script: (a: Animator, i: number) => void = () => {}) => {
    const a = animator().play(g, data.clips), out: string[] = [];
    for (let i = 0; i < steps; i++) {
      script(a, i);
      a.step(1 / 60);
      out.push(a.graph!.states.map((s) => `${s.layer}:${s.state}`).join(" "));
    }
    return out;
  };
  it("fades a blend in at each point's weight times the fade's share, keeping a point at weight 0 out of the events", () => {
    const a = animator().play(data.locomotion, data.clips).set("speed", 2.3);
    for (let i = 0; i < 3; i++) a.step(1 / 60);
    expect(a.layers.map((L) => `${L.name}:${r9(L.weight)}`)).toEqual(["@base/1/0:1", "@base/2/0:0.111111111", "@base/2/1:0.1", "@base/2/2:0"]);
    // at 5.5 the walk weighs nothing: only the jog and the sprint step
    const b = animator().play(data.locomotion, data.clips).set("speed", 5.5), steps: Record<string, number> = {};
    b.on("step", (e) => void (steps[e.clip.split("/")[1]!] = (steps[e.clip.split("/")[1]!] ?? 0) + 1));
    seconds(b, 3);
    expect(steps).toEqual({ Jog_Fwd_Loop: 9, Sprint_Loop: 9 });
  });
  it("keeps a synced blend at the weighted mean of its clips' lengths, and starts a blend synced into at the phase left", () => {
    const a = animator().play(data.locomotion, data.clips).set("speed", 2.3);
    seconds(a, 1);
    expect(a.layers.filter((L) => L.name.startsWith("@base/2/")).map((L) => r9(L.speed))).toEqual([1.176522507, 0.823477493, 0.58870256]);
    const g = graphOf({ i: { clip: Q + "Idle_Loop" }, m: { blend: { param: "s", points: [{ at: 0, clip: Q + "Walk_Loop" }, { at: 1, clip: Q + "Jog_Fwd_Loop" }] } } }, [{ from: "i", to: "m", when: [{ param: "go" }], sync: true, fade: 0 }], { s: { type: "number", value: 0.5 }, go: { type: "trigger" } });
    const b = animator().play(g, data.clips);
    for (let i = 0; i < 40; i++) b.step(1 / 60);
    b.trigger("go");
    b.step(1 / 60);
    expect(b.layers.map((L) => r9(L.time / clip(L.clip!.split("/")[1]!).dur))).toEqual([0.281376876, 0.281376876]);
    expect(G.weights2D([[0, 0], [2, 0], [0, 2]], [0.5, 0.5]).map(r9)).toEqual([0.6, 0.2, 0.2]);
  });
  it("leaves a loop at its exit share at any speed, restarts a state a transition names as its own, and starts over when played again", () => {
    const g = graphOf({ w: { clip: Q + "Jog_Fwd_Loop", rate: "r" }, b: { clip: Q + "Sword_Idle" } }, [{ from: "w", to: "b", exit: 0.99, fade: 0 }], { r: { type: "number", value: 1.9 } });
    expect(statesOf(g, 100).findIndex((s) => s === "base:b")).toBe(30);
    const self = graphOf({ a: { clip: Q + "Walk_Loop" } }, [{ from: "a", to: "a", when: [{ param: "go" }], fade: 0 }], { go: { type: "trigger" } });
    const a = animator().play(self, data.clips);
    for (let i = 0; i < 10; i++) a.step(1 / 60);
    a.trigger("go");
    a.step(1 / 60);
    expect(a.layers.map((L) => `${L.name}:${r9(L.time)}`)).toEqual(["@base/2/0:0.016666667"]);
    const c = animator().play(data.combo, data.clips);
    seconds(c, 0.5);
    c.play(data.combo, data.clips);
    expect(c.layers.map((L) => `${L.name}:${L.time}`)).toEqual(["@base/1/0:0"]);
  });
  it("compares at a value and either side of it, each op", () => {
    const at = (op: G.Condition["op"], v: number) => statesOf(graphOf({ a: { clip: Q + "Walk_Loop" }, b: { clip: Q + "Sword_Idle" } }, [{ from: "a", to: "b", when: [{ param: "n", op, value: 2 }], fade: 0 }], { n: { type: "number", value: v } }), 1)[0]!.slice(5);
    expect((["==", "!=", "<", "<=", ">", ">="] as const).map((op) => `${op} ${[1.9, 2, 2.1].map((v) => at(op, v)).join("")}`)).toEqual(["== aba", "!= bab", "< baa", "<= bba", "> aab", ">= abb"]);
  });
  it("carries on exactly after a save and restore at every step of a graph with what the examples lack", () => {
    // a 2D blend space, an additive layer, a mask by field weights, cuts six deep, rate, sync and windows, its triggers
    // and parameters set by a seeded script: every step saved, sent through JSON and restored, against the run unbroken
    const g: G.Graph = {
      format: "2.0", id: "GRAPHS/Rich",
      parameters: { x: { type: "number" }, y: { type: "number", value: 0.5 }, r: { type: "number", value: 1 }, go: { type: "trigger", buffer: 0.25 }, cut: { type: "trigger" }, on: { type: "bool" } },
      start: "m",
      states: {
        m: { blend: { params: ["x", "y"], points: [{ at: [0, 0], clip: Q + "Idle_Loop" }, { at: [0, 1], clip: Q + "Walk_Loop" }, { at: [1, 1], clip: Q + "Jog_Fwd_Loop" }, { at: [1, 0], clip: Q + "Sprint_Loop" }, { at: [0.5, 0.5], clip: Q + "Jump_Loop" }] }, rate: "r" },
        a: { clip: Q + "Sword_Regular_A", speed: 1.3 }, b: { clip: Q + "Sword_Regular_B", at: 0.05 }, c: { clip: Q + "Sword_Regular_C", rate: "r" }, g: { clip: Q + "Sword_Idle" },
      },
      transitions: [
        { from: "*", to: "g", when: [{ param: "cut" }], fade: 0.4, interruptible: true },
        { from: ["m", "g"], to: "a", when: [{ param: "go" }], fade: 0.15, interruptible: true },
        { from: "a", to: "b", when: [{ param: "go" }], window: [0.15, 0.4], fade: 0.1, sync: true },
        { from: "a", to: "m", exit: 1, fade: 0.3 },
        { from: "b", to: "c", when: [{ param: "on", op: "==", value: true }], exit: 0.6, fade: 0.2, interruptible: true },
        { from: "b", to: "m", exit: 1, fade: 0.2 },
        { from: "c", to: "m", exit: 0.9, fade: 0.25 },
        { from: "g", to: "m", when: [{ param: "x", op: ">", value: 0.2 }], fade: 0.5, sync: true, interruptible: true },
      ],
      layers: [
        { name: "arm", mask: { armR: 1, handR: 1, shR: 0.5, head: 0.25 }, weight: 0.8, start: "none", states: { none: { pass: true }, jab: { clip: Q + "Punch_Jab", speed: 1.1 } }, transitions: [{ from: "none", to: "jab", when: [{ param: "on", op: "==", value: true }], fade: 0.1 }, { from: "jab", to: "none", exit: 0.95, fade: 0.2 }] },
        { name: "add", additive: true, weight: 0.6, start: "n", states: { n: { pass: true }, nod: { clip: Q + "Punch_Jab" } }, transitions: [{ from: "n", to: "nod", when: [{ param: "x", op: ">=", value: 0.7 }], fade: 0.2 }, { from: "nod", to: "n", when: [{ param: "x", op: "<", value: 0.7 }], fade: 0.2, interruptible: true }] },
      ],
    };
    expect(G.validateGraph(g, { clips: (id) => data.clips.find((c) => c.id === id) })).toEqual([]);
    const rnd = (i: number, k: number) => ((Math.imul(((i * 2246822519 + k * 3266489917) >>> 0), 1103515245) + 12345) >>> 0) / 4294967296;
    const script = (a: Animator, i: number) => {
      const u = rnd(i, 1);
      if (u < 0.05) a.trigger("go");
      else if (u < 0.07) a.trigger("cut");
      else if (u < 0.1) a.set("on", !(a.graph!.params.on === true));
      if (rnd(i, 2) < 0.08) a.set("x", Math.round(rnd(i, 3) * 140 - 20) / 100).set("y", Math.round(rnd(i, 4) * 140 - 20) / 100);
      if (rnd(i, 5) < 0.1) a.set("r", 0.5 + rnd(i, 6) * 1.5);
    };
    const body = bind(data.skeleton), run = (restore: boolean) => {
      let a = new Animator(body, { step: 1 / 60 }).play(g, data.clips);
      const hashes: string[] = [];
      // (the verifier's mutants of the trigger ages and the cut fades restored went astray by steps 18 and 22)
      for (let i = 0; i < 150; i++) {
        if (restore) a = new Animator(body, { step: 1 / 60 }).restore(JSON.parse(JSON.stringify(a.save())), data.clips, g);
        script(a, i);
        a.step(1 / 60);
        hashes.push(a.hash());
      }
      return hashes;
    };
    const plain = run(false), restored = run(true);
    expect(restored.findIndex((h, i) => h !== plain[i])).toBe(-1);
  }, 30_000);
  it("plays its own copy of the graph: one edited after play neither breaks the run nor changes it, and a -0 is 0", () => {
    const g = structuredClone(data.combo), a = animator().play(g, data.clips), b = animator().play(data.combo, data.clips);
    a.step(0.1);
    b.step(0.1);
    g.transitions[0]!.to = "nope";
    g.desc = "edited";
    a.trigger("attack");
    b.trigger("attack");
    for (let i = 0; i < 30; i++) {
      a.step(1 / 60);
      b.step(1 / 60);
    }
    expect(a.hash()).toBe(b.hash());
    // a state starting at -0 hashes as at 0, after a save through JSON too
    const z = graphOf({ w: { clip: Q + "Walk_Loop", at: -0 } }, []), s = animator().play(z, data.clips);
    s.step(1 / 60);
    expect(animator().restore(JSON.parse(JSON.stringify(s.save())), data.clips, z).hash()).toBe(s.hash());
  });
  it("starts a loop's `at` round its cycle, and opens a window narrower than a step when the step goes over it", () => {
    const w = clip("Walk_Loop").dur, a = animator().play(graphOf({ w: { clip: Q + "Walk_Loop", at: w + 0.25 } }, []), data.clips);
    expect(r9(a.layers[0]!.time)).toBe(0.25);
    // [0.21, 0.23] s of the swing: never a step's end at 30 a second (0.2, 0.233)
    const g = graphOf({ a: { clip: Q + "Sword_Regular_A" }, b: { clip: Q + "Sword_Idle" } }, [{ from: "a", to: "b", when: [{ param: "go" }], window: [0.21, 0.23], fade: 0 }], { go: { type: "trigger", buffer: 1 } });
    const b = animator().play(g, data.clips);
    b.trigger("go");
    for (let i = 0; i < 10; i++) b.step(1 / 30);
    expect(b.graph!.states[0]!.state).toBe("b");
  });
  it("refuses what would never play or never stop: a one-shot at speed 0, a rate starting at 0, a pass state's exit, a state into itself waiting on nothing", () => {
    const has = (id: string) => data.clips.find((c) => c.id === id) ?? (id === "MESH2MOTION/Two-hand_Blast" ? clip("Sword_Idle") : undefined);
    const issues = (g: G.Graph) => G.validateGraph(g, { clips: has }).map((i) => `${i.code} ${i.field}`);
    expect(issues(graphOf({ i: { clip: Q + "Sword_Idle" }, a: { clip: Q + "Sword_Regular_A", speed: 0 } }, [{ from: "i", to: "a" }]))).toEqual(["G-E005 states.a.speed"]);
    expect(issues(graphOf({ w: { clip: Q + "Walk_Loop", rate: "warp" } }, [], { warp: { type: "number" } }))).toEqual(["G-E006 parameters.warp.value"]);
    expect(issues(graphOf({ w: { clip: Q + "Walk_Loop" } }, [{ from: "w", to: "w" }]))).toEqual(["G-E003 transitions.0"]);
    const layered: G.Graph = { ...graphOf({ w: { clip: Q + "Walk_Loop" } }, []), layers: [{ name: "up", start: "n", states: { n: { pass: true }, j: { clip: Q + "Punch_Jab" } }, transitions: [{ from: "n", to: "j", exit: 0.5 }, { from: "j", to: "n", exit: 1 }] }] };
    expect(issues(layered)).toEqual(["G-E003 layers.0.transitions.0.exit"]);
    // a clip id with a hyphen, as the library's are
    expect(issues(graphOf({ b: { clip: "MESH2MOTION/Two-hand_Blast" } }, []))).toEqual([]);
  });
  it("names each rule's problem, one graph breaking each, and plays parameters, a start state's `at` and a fade by their defaults", () => {
    const idle = { clip: Q + "Idle_Loop" }, walk = { clip: Q + "Walk_Loop" }, P = { s: { type: "number" as const }, t: { type: "trigger" as const }, b: { type: "bool" as const } };
    const ok = graphOf({ idle, walk }, [{ from: "idle", to: "walk" }], P), to = (states: object) => graphOf(states as never, [{ from: "idle", to: "walk" }], P);
    const lay = (L: object) => ({ ...ok, layers: [{ name: "up", start: "a", states: { a: idle }, transitions: [], ...L }] });
    const has = (id: string) => data.clips.find((c) => c.id === id);
    const cases: [string[], unknown][] = [
      [["G-E001"], { ...ok, format: "3.0" }],
      [["G-E001"], { ...ok, desc: 3 }],
      [["G-E001"], { ...ok, tags: ["Loco"] }],
      [["G-E001", "G-E003"], lay({ states: {} })],
      [["G-E006"], { ...ok, parameters: { ...P, t: { type: "trigger", buffer: 11 } } }],
      [["G-E006"], { ...ok, parameters: { ...P, "1x": { type: "number" } } }],
      [["G-E005"], lay({ weight: 2 })],
      [["G-E005"], lay({ additive: "yes" })],
      [["G-E002"], graphOf({ idle, "my state": walk }, [{ from: "idle", to: "my state" }], P)],
      [["G-E002"], lay({ states: { a: { pass: false } } })],
      [["G-E002", "G-E006"], lay({ states: { a: { pass: true, rate: "s" } } })],
      [["G-E005"], to({ idle: { ...idle, speed: 101 }, walk })],
      [["G-E003"], to({ idle: { ...idle, rate: "b" }, walk })],
      [["G-E005"], to({ idle: { ...idle, at: -1 }, walk })],
      [["G-E002"], to({ idle, walk: { blend: { param: "s", points: [{ at: 0, clip: Q + "Walk_Loop" }, { at: 1, clip: Q + "Jog_Fwd_Loop" }] }, at: 0.2 } })],
    ];
    for (const [want, g] of cases) expect([want, codes(g)]).toEqual([want, want]);
    // every clip a blend names is looked for, not only its first
    expect(codes(to({ idle, walk: { blend: { param: "s", points: [{ at: 0, clip: Q + "Walk_Loop" }, { at: 1, clip: "X/Nope" }] } } }), has)).toEqual(["G-E009"]);
    // a number starts at 0 and a bool false; a start state at its `at`; a fade of 0.2 s unless one is given (12 steps)
    const states = (when: G.Condition[]) => {
      const a = animator();
      a.play(graphOf({ idle, walk }, [{ from: "idle", to: "walk", when, fade: 0 }], P), data.clips);
      a.step(1 / 60);
      return a.graph!.states.map((s) => s.state);
    };
    expect([states([{ param: "s", op: "<", value: 0.5 }]), states([{ param: "b" }])]).toEqual([["walk"], ["idle"]]);
    const a = animator();
    a.play(graphOf({ w: { ...walk, at: 0.5 } }, []), data.clips);
    expect(a.layers.map((L) => [L.name, L.time])).toEqual([["@base/1/0", 0.5]]);
    const f = animator();
    f.play(graphOf({ idle, walk }, [{ from: "idle", to: "walk", when: [{ param: "t" }] }], P), data.clips);
    f.trigger("t");
    const fading: boolean[] = [];
    for (let i = 0; i < 14; i++) {
      f.step(1 / 60);
      fading.push(!!f.graph!.states[0]!.from);
    }
    expect(fading.indexOf(false)).toBe(12);
    // a trigger is pressed, or set false to clear it; nothing else
    expect(() => f.set("t", 5)).toThrow(/"t" is a trigger: trigger\("t"\), or set it false/);
  });
});

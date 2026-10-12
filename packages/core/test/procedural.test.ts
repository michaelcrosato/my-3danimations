// Procedural sources (WP-6.2, D71): the move model against my-3d2dge's own numbers (spec/vectors/frozen/moves.json,
// its 24 moves on its three builds), moves that begin and end at any start pose, library/moves.json's shape and
// checks, the gait's foot path and loop, and the idle's planted feet and closed loop.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { parseClip, procedural as PR, validate, type Clip, type Rest } from "../src/index.ts";
import { P, POINTS } from "../src/format/body.ts";
import { decodePose, type KeyLike } from "../src/format/pose.ts";
import { keyAt } from "../src/format/sample.ts";
import { rootAt } from "../src/clip/sample.ts";
import { quantize } from "../src/recipe/compile.ts";

const ROOT = join(import.meta.dirname, "../../.."), LIB = join(ROOT, "library/sets");
const MOVES = JSON.parse(readFileSync(join(ROOT, "library/moves.json"), "utf8")) as { about: string; moves: PR.Move[] };
function load(id: string): { clip: Clip; rest: Rest } {
  const [set, slug] = id.split("/") as [string, string], clip = parseClip(readFileSync(join(LIB, set, `${slug}.json`), "utf8"));
  const manifest = JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> };
  return { clip, rest: manifest.sources[clip.restSrc]!.rest };
}
/** The points of a key (or pose) on a rest. */
function points(rest: Rest, k: object): Float32Array {
  const X = new Float32Array(P * 3);
  decodePose(rest, k as KeyLike, X);
  return X;
}
/** The farthest any point is between two sets of points, mm. */
const farthest = (A: Float32Array, B: Float32Array) => Math.max(...Array.from({ length: P }, (_, i) => Math.hypot(A[i * 3]! - B[i * 3]!, A[i * 3 + 1]! - B[i * 3 + 1]!, A[i * 3 + 2]! - B[i * 3 + 2]!)));
const at = (X: Float32Array, n: string): [number, number, number] => {
  const i = POINTS.indexOf(n as never) * 3;
  return [X[i]!, X[i + 1]!, X[i + 2]!];
};

describe("the move model", () => {
  // my-3d2dge's builds (engine/my-3d2dge.js:1758, BUILDS; chibi is the Humanoid's defaults), in its units
  const chibi = { legUpper: 6, legLower: 6, hipZ: 11.6, hipHalf: 1.9, footSpread: 1.9, torso: 8, shoulderHalf: 3.3, armUpper: 4.6, armLower: 4.6, ref: 11.6 };
  const BUILDS: Record<string, PR.MoveBody> = {
    chibi,
    heroic: { ...chibi, legUpper: 7.4, legLower: 7.4, hipZ: 14.3, torso: 9.6, shoulderHalf: 3.5, armUpper: 5.5, armLower: 5.4, hipHalf: 1.8 },
    bulky: { ...chibi, legUpper: 6.4, legLower: 6.2, hipZ: 12.2, torso: 9.4, shoulderHalf: 4.6, armUpper: 5.2, armLower: 5.2, hipHalf: 2.4, footSpread: 2.4 },
  };
  it("places the hands, the blade's tip and the kicking foot where my-3d2dge does, within 1 cm mean and 3 cm worst", () => {
    const F = JSON.parse(readFileSync(join(ROOT, "spec/vectors/frozen/moves.json"), "utf8")) as { points: string[]; records: { build: string; move: string; phase: PR.Phase; samples: number[][] }[] };
    // my-3d2dge's spin is the library's spinslash (shardfall's name); there are no exceptions to list
    const NAMES: Record<string, string> = { spin: "spinslash" }, EXCEPTIONS: string[] = [];
    let sum = 0, n = 0, worst = 0;
    for (const r of F.records) {
      const m = MOVES.moves.find((x) => x.name === (NAMES[r.move] ?? r.move))!, b = BUILDS[r.build]!;
      expect(m, r.move).toBeDefined();
      for (const smp of r.samples) {
        // the source's raw easing (settle off), its points turned by a spin, the blade 11 units along its direction
        const J = PR.placeMove(m, PR.moveState(m, r.phase, smp[0]!, { settle: false }), b, undefined, { settle: false }), c = Math.cos(J.spin), s = Math.sin(J.spin);
        const pts = [J.handR, J.handL, J.handR.map((x, i) => x + J.bladeDir[i]! * 11), J.footR];
        pts.forEach((p, k) => {
          const x = p[0]! * c - p[1]! * s, y = p[0]! * s + p[1]! * c, cm = (Math.hypot(x - smp[1 + k * 3]!, y - smp[2 + k * 3]!, p[2]! - smp[3 + k * 3]!) / 16) * 100;
          sum += cm;
          n++;
          worst = Math.max(worst, cm);
        });
      }
    }
    expect(n).toBe(216 * 21 * 4);
    expect(EXCEPTIONS).toEqual([]);
    expect(sum / n).toBeLessThan(1);
    expect(worst).toBeLessThan(3);
    // in fact to well under a millimetre: the units reconciled, not just near
    expect(worst).toBeLessThan(0.05);
  });
  it("settles where a clip needs it: every phase eased in and out, and the strike connecting where `hit` says", () => {
    const slash = MOVES.moves.find((m) => m.name === "slash")!;
    for (const phase of PR.PHASES) {
      const a = PR.moveState(slash, phase, 0, { settle: true }), b = PR.moveState(slash, phase, 0.001, { settle: true });
      expect([phase, Math.abs(b.theta - a.theta) < 1e-3]).toEqual([phase, true]);
    }
    const clip = PR.moveClip(slash, load("MESH2MOTION/Idle_A").rest, { restSrc: load("MESH2MOTION/Idle_A").clip.restSrc });
    const t = PR.MIN_PHASE.wind + slash.hit * Math.max(slash.active, PR.MIN_PHASE.active);
    expect(clip.events).toEqual([{ t: Math.round(t * 1000) / 1000, name: "hit" }]);
  });
});

describe("a move as a clip", () => {
  const idle = load("MESH2MOTION/Idle_A"), style = load("STYLE100/Neutral_Walk");
  const { t: _t, root: _r, yaw: _y, ...idleStart } = idle.clip.keys[0] as unknown as Record<string, unknown>;
  it("begins at the start pose it is given, and ends there, whichever it is", () => {
    for (const [rest, src, start] of [[idle.rest, idle.clip.restSrc, PR.standingOn(idle.rest)], [idle.rest, idle.clip.restSrc, idleStart], [style.rest, style.clip.restSrc, PR.standingOn(style.rest)]] as const) {
      const S = points(rest, quantize(start as never));
      for (const m of MOVES.moves) {
        const c = PR.moveClip(m, rest, { restSrc: src, start: start as never });
        expect([m.name, validate(c).errors]).toEqual([m.name, []]);
        expect([m.name, farthest(points(rest, c.keys[0]!), S) < 1]).toEqual([m.name, true]);
        expect([m.name, farthest(points(rest, keyAt(c, c.dur) as never), S) < 15]).toEqual([m.name, true]);
      }
    }
  });
  it("is procedural and CC0 in its provenance, named and described from the move", () => {
    const c = PR.moveClip(MOVES.moves[0]!, idle.rest, { restSrc: idle.clip.restSrc });
    expect([c.id, c.name, c.loop, c.provenance.method, c.provenance.license, c.provenance.ai]).toEqual(["PROCEDURAL/Slash", "Slash", false, "procedural", "CC0-1.0", "algorithmicMedia"]);
    expect(c.desc).toBe(MOVES.moves[0]!.about.charAt(0).toUpperCase() + MOVES.moves[0]!.about.slice(1));
    expect(PR.moveClip(MOVES.moves[0]!, idle.rest, { restSrc: idle.clip.restSrc, id: "MINE/Cut" }).id).toBe("MINE/Cut");
  });
});

describe("library/moves.json", () => {
  const schema = new Ajv2020({ strict: true, allErrors: true }).compile(JSON.parse(readFileSync(join(ROOT, "spec/schemas/moves.schema.json"), "utf8")) as object);
  const codes = (d: unknown) => PR.validateMoves(d).map((i) => i.code);
  const edit = (f: (m: Record<string, unknown>[]) => void) => {
    const d = JSON.parse(JSON.stringify(MOVES)) as { about: string; moves: Record<string, unknown>[] };
    f(d.moves);
    return d;
  };
  it("is the schema's shape and checks clean: 31 moves, each with an about line, in one unit system", () => {
    expect([schema(MOVES), schema.errors ?? null]).toEqual([true, null]);
    expect(PR.validateMoves(MOVES)).toEqual([]);
    expect(MOVES.moves).toHaveLength(31);
    expect(MOVES.moves.every((m) => m.about.length > 10)).toBe(true);
  });
  it("names each problem with its code, and the schema refuses the shape problems too", () => {
    expect(codes(null)).toEqual(["MV-E001"]);
    expect(codes({ about: "x", moves: [] })).toEqual(["MV-E001"]);
    const cases: [string, Record<string, unknown>][] = [
      ["MV-E002", edit((m) => delete m[0]!.reach)],
      ["MV-E002", edit((m) => (m[0]!.spin = "yes"))],
      ["MV-E003", edit((m) => (m[0]!.hold = 1))],
      ["MV-E003", edit((m) => (m[0]!.hand = "foot"))],
      ["MV-E004", edit((m) => (m[3]!.name = m[2]!.name))],
      ["MV-E004", edit((m) => (m[2]!.name = "Over Head"))],
      ["MV-E005", edit((m) => (m[0]!.alt = "nothing"))],
      ["MV-E006", edit((m) => (m[0]!.speed = 2))],
      ["MV-E007", edit((m) => delete m[0]!.height)],
      ["MV-E007", edit((m) => (m.find((x) => x.plane === "side")!.height = [0, 0]))],
    ];
    for (const [code, data] of cases) expect([code, codes(data)]).toEqual([code, [code]]);
    // what JSON Schema can say, it says too
    for (const [code, data] of cases.filter(([c]) => ["MV-E002", "MV-E003", "MV-E006"].includes(c))) expect([code, schema(data)]).toEqual([code, false]);
    expect(Object.keys(PR.MOVES_RULES)).toEqual(["MV-E001", "MV-E002", "MV-E003", "MV-E004", "MV-E005", "MV-E006", "MV-E007"]);
  });
});

describe("a gait", () => {
  it("puts a foot still in the world through its stance, its lift-off and its set-down, and nowhere near the floor between", () => {
    // in the root's frame, which moves at the ground speed: a standing foot goes back at that speed
    const stance = 0.6, stride = 400, lift = 120, clear = 40, speed = stride / stance;
    const world = (v: number) => PR.footAt(v, stance, stride, lift, clear)[0] + speed * v;
    for (const v of [0, 0.1, 0.3, 0.59]) expect(world(v)).toBeCloseTo(world(0), 6);
    // the first and last tenth of the swing hold still, rising and setting straight down
    const s = (u: number) => stance + u * (1 - stance);
    expect(world(s(0.09))).toBeCloseTo(world(s(0)), 6);
    expect(world(s(0.91))).toBeCloseTo(world(s(1)), 6);
    expect(PR.footAt(s(0.1), stance, stride, lift, clear)[1]).toBeCloseTo(clear, 6);
    // moving, it is never lower than its clearance and peaks at `lift`; it comes down one stride on
    const ups = Array.from({ length: 81 }, (_, i) => PR.footAt(s(0.1 + i * 0.01), stance, stride, lift, clear)[1]);
    expect(Math.min(...ups)).toBeGreaterThanOrEqual(clear - 1e-9);
    expect(Math.max(...ups)).toBeCloseTo(lift, 0);
    expect(world(1 - 1e-9) - world(0)).toBeCloseTo(speed, 3);
  });
  it("is a travelling loop of one cycle with a contact for each foot, from any rest", () => {
    for (const id of ["MESH2MOTION/Idle_A", "STYLE100/Neutral_Walk"]) {
      const src = load(id);
      for (const g of PR.GAITS) {
        const c = PR.gaitClip(g, src.rest, { restSrc: src.clip.restSrc });
        expect([g.name, validate(c).errors]).toEqual([g.name, []]);
        expect([c.loop, c.dur, c.id]).toEqual([true, g.cycle, `PROCEDURAL/${g.name.charAt(0).toUpperCase()}${g.name.slice(1)}`]);
        expect([g.name, c.contacts?.footL?.length, c.contacts?.footR?.length]).toEqual([g.name, 1, 1]);
        // the root goes speed × cycle (% of the hip height) each cycle
        expect(rootAt(c, c.dur).forward).toBe(Math.round(g.speed * g.cycle));
      }
    }
  });
  it("limps: the weak leg stands for less, and a foot is always down", () => {
    const src = load("MESH2MOTION/Idle_A"), limp = PR.gaitClip(PR.GAITS.find((g) => g.name === "limp")!, src.rest, { restSrc: src.clip.restSrc });
    const span = (iv: [number, number][]) => iv.reduce((a, [x, y]) => a + y - x, 0);
    expect(span(limp.contacts!.footL!)).toBeLessThan(span(limp.contacts!.footR!) * 0.8);
    const down = (t: number) => (["footL", "footR"] as const).some((f) => limp.contacts![f]!.some(([a, b]) => (a <= t && b >= t) || (b > limp.dur && t <= b - limp.dur)));
    for (let t = 0; t < limp.dur; t += 0.02) expect([t, down(t)]).toEqual([t, true]);
  });
});

describe("an idle", () => {
  it("breathes and shifts its weight on planted feet, a loop that closes", () => {
    const src = load("MESH2MOTION/Idle_A");
    for (const i of PR.IDLES) {
      const c = PR.idleClip(i, src.rest, { restSrc: src.clip.restSrc }), first = points(src.rest, c.keys[0]!);
      expect([i.name, validate(c).errors, c.loop, c.dur]).toEqual([i.name, [], true, i.shift ?? 6.8]);
      expect(c.contacts?.footL).toEqual([[0, c.dur]]);
      let feet = 0, sway = 0;
      for (let t = 0; t <= c.dur; t += 0.05) {
        const X = points(src.rest, keyAt(c, t) as never);
        feet = Math.max(feet, ...["ankleL", "ankleR"].map((n) => Math.hypot(...at(X, n).map((v, k) => v - at(first, n)[k]!))));
        sway = Math.max(sway, Math.abs(at(X, "pelvis")[1] - at(first, "pelvis")[1]));
      }
      // the feet stay put to within the keys' rounding (a leg's direction in hundredths: 8.5 mm at the foot of an 850 mm
      // leg, its nearest of 16 roundings chosen); the pelvis sways its share of the hip height, in the format's whole %
      expect(feet).toBeLessThan(8);
      expect(sway).toBeGreaterThan(((Math.round(i.sway ?? 2) * src.rest.H0) / 100) * 0.9);
      expect(farthest(points(src.rest, keyAt(c, c.dur) as never), first)).toBeLessThan(1);
    }
  });
});

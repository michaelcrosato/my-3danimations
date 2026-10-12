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
    // the step comes in eased through the wind too, from nothing to half
    const cross = MOVES.moves.find((m) => m.name === "cross")!, step = (u: number) => PR.moveState(cross, "wind", u).step;
    expect([step(0.001) < 1e-5, step(0.999) > 0.5 - 1e-5]).toEqual([true, true]);
    // the hold stays inside the recovery whatever it says (shardfall's clamp): 0 divides by nothing, 0.99 never lets go
    const none = PR.moveState({ ...slash, hold: 0 }, "recover", 0), late = PR.moveState({ ...slash, hold: 0.99 }, "recover", 0.97);
    expect([Number.isFinite(none.theta), Number.isFinite(none.arm), late.arm < 1]).toEqual([true, true, true]);
  });
  it("steps the lead foot only while it is lifted, and guards with a punch's free fist where my-3d2dge does", () => {
    // my-3d2dge's chibi build, in its units (u = 1): a cross leads with the left foot, stepping 1.3 of its lunge
    const cross = MOVES.moves.find((m) => m.name === "cross")!, jab = MOVES.moves.find((m) => m.name === "jab")!, b = BUILDS.chibi!;
    const st = PR.moveState(cross, "wind", 0), foot = (x: number) => PR.placeMove(cross, { ...st, step: x }, b).footL, d = ((cross.lunge * b.ref) / 100) * 1.3;
    const [f0, f25, f50, f75] = [foot(0), foot(0.25), foot(0.5), foot(0.75)];
    expect([f25[0]! - f0[0]!, f50[0]! - f0[0]!, f75[0]! - f0[0]!].map((x) => Math.round((x / d) * 1000) / 1000)).toEqual([0, 0.5, 1]);
    expect(f50[2]! - f0[2]!).toBeGreaterThan(0.09 * b.ref);
    // engine/my-3d2dge.js:1967, the boxer's guard: the lead fist out at chin height, the other tucked
    const aims = (m: PR.Move) => PR.placeMove(m, PR.moveState(m, "active", 1), b, undefined, { guard: true });
    const c = aims(cross), j = aims(jab);
    expect([c.aims.handL.at.map((x, i) => Math.round((x - c.shC[i]!) * 100) / 100), j.aims.handR.at.map((x, i) => Math.round((x - j.shC[i]!) * 100) / 100)]).toEqual([
      [3.8, -1, 0.4],
      [2.3, 1.5, -0.6],
    ]);
    // in a clip, a punch's free fist is up by the chin as it lands; a slash's hangs
    const idle = load("MESH2MOTION/Idle_A"), freeFist = (m: PR.Move) => {
      const k = PR.moveClip(m, idle.rest, { restSrc: idle.clip.restSrc }), X = points(idle.rest, keyAt(k, k.events![0]!.t) as never), s = m.hand === "left" ? "R" : "L";
      return (at(X, `fist${s}`)[2] - (at(X, "shL")[2] + at(X, "shR")[2]) / 2) / idle.rest.H0;
    };
    expect([freeFist(cross) > -0.18, freeFist(MOVES.moves.find((m) => m.name === "slash")!) < -0.2]).toEqual([true, true]);
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
        expect([m.name, farthest(points(rest, keyAt(c, c.dur) as never), S) < 2]).toEqual([m.name, true]);
      }
    }
  }, 30_000);
  it("begins and ends at starts with straight limbs, a curled spine, or a pose from the library", () => {
    const crouch = load("CMU_CURATED/Crouch_Walk_Loop"), up = load("STYLE100_IDLE/ArmsAboveHead_Idle"), stand = PR.standingOn(idle.rest) as unknown as Record<string, unknown>;
    const mid = (c: Clip) => {
      const { t: _a, root: _b, yaw: _c, ...k } = keyAt(c, c.dur / 2) as unknown as Record<string, unknown>;
      return k;
    };
    const starts: [string, Rest, string, Record<string, unknown>][] = [
      ["straight arms", idle.rest, idle.clip.restSrc, { ...stand, armL: [0, 10, -100, 0, 0], armR: [0, 10, -100, 0, 0] }],
      ["straight legs", idle.rest, idle.clip.restSrc, { ...stand, legL: [0, 5, -100, 0, 0], legR: [0, 5, -100, 0, 0] }],
      ["a curled spine", idle.rest, idle.clip.restSrc, { ...stand, spine: [100, 120, 100] }],
      ["a walk's middle", style.rest, style.clip.restSrc, mid(style.clip)],
      ["a crouch walk's middle", crouch.rest, crouch.clip.restSrc, mid(crouch.clip)],
      // a straight right leg whose twist is turned round (-169°): nothing shows until it bends
      ["arms up, a knee turned round", up.rest, up.clip.restSrc, mid(up.clip)],
    ];
    // a jab and a cross, a slash and its backhand, an overhead chop, a spin, kicks (one spinning), a two-handed pair,
    // and a side-plane leap
    const some = MOVES.moves.filter((m) => ["jab", "cross", "slash", "backslash", "overhead", "spinslash", "kick", "roundhouse", "roar", "leap"].includes(m.name));
    expect(some).toHaveLength(10);
    for (const [what, rest, src, start] of starts) {
      const S = points(rest, quantize(start as never));
      for (const m of some) {
        const c = PR.moveClip(m, rest, { restSrc: src, start: start as never });
        expect([what, m.name, farthest(points(rest, c.keys[0]!), S) < 1, farthest(points(rest, keyAt(c, c.dur) as never), S) < 2]).toEqual([what, m.name, true, true]);
        // and as it strikes, each knee it stands on bends forward, ahead of the line from its hip to its ankle
        const X = points(rest, keyAt(c, c.events![0]!.t) as never), ahead = (s: string) => at(X, `knee${s}`)[0] - (at(X, `hip${s}`)[0] + at(X, `ankle${s}`)[0]) / 2;
        expect([what, m.name, ahead("L") > 0, m.hand === "kick" || ahead("R") > 0]).toEqual([what, m.name, true, true]);
      }
    }
  }, 30_000);
  it("keeps the fists out of the torso from the wind's end on, where the source's stick figure has none", () => {
    // each fist's distance from the line from the pelvis to the shoulders' centre, between their heights, in half
    // shoulder widths (the hands are pushed out to 1.3 of them as the wind comes in; the IK and fitting lose a little)
    for (const m of MOVES.moves) {
      const c = PR.moveClip(m, idle.rest, { restSrc: idle.clip.restSrc });
      let low = Infinity;
      for (let t = PR.MIN_PHASE.wind; t <= c.dur; t += 1 / 30) {
        const X = points(idle.rest, keyAt(c, t) as never), pel = at(X, "pelvis"), shL = at(X, "shL"), shR = at(X, "shR");
        const axis = [0, 1, 2].map((i) => (shL[i]! + shR[i]!) / 2 - pel[i]!), l2 = axis.reduce((a, v) => a + v * v, 0), half = Math.hypot(shL[0] - shR[0], shL[1] - shR[1], shL[2] - shR[2]) / 2;
        for (const f of ["fistL", "fistR"]) {
          const p = at(X, f), k = p.reduce((a, v, i) => a + (v - pel[i]!) * axis[i]!, 0) / l2;
          if (k > 0 && k < 1) low = Math.min(low, Math.hypot(...p.map((v, i) => v - pel[i]! - axis[i]! * k)) / half);
        }
      }
      expect([m.name, low > 0.85]).toEqual([m.name, true]);
    }
  }, 30_000);
  it("holds a kick's arms out for balance as it lands", () => {
    // the fists apart at the hit, against the shoulders apart: out to the sides at half an arm each
    for (const m of MOVES.moves.filter((x) => x.hand === "kick")) {
      const c = PR.moveClip(m, idle.rest, { restSrc: idle.clip.restSrc }), X = points(idle.rest, keyAt(c, c.events![0]!.t) as never);
      const apart = (a: string, b: string) => Math.hypot(...at(X, a).map((v, i) => v - at(X, b)[i]!));
      expect([m.name, apart("fistL", "fistR") / apart("shL", "shR") > 2.3]).toEqual([m.name, true]);
    }
  });
  it("leans the torso in as it crouches through the wind", () => {
    // the shoulders' centre ahead of the pelvis at the wind's end, in degrees from upright, over the crouching moves
    const crouching = MOVES.moves.filter((m) => m.crouch >= 0.3), lean = crouching.map((m) => {
      const c = PR.moveClip(m, idle.rest, { restSrc: idle.clip.restSrc }), X = points(idle.rest, keyAt(c, PR.MIN_PHASE.wind) as never), p = at(X, "pelvis");
      const sh = [0, 1, 2].map((i) => (at(X, "shL")[i]! + at(X, "shR")[i]!) / 2);
      return (Math.atan2(sh[0]! - p[0], sh[2]! - p[2]) * 180) / Math.PI;
    });
    expect([crouching.length, lean.reduce((a, b) => a + b, 0) / lean.length > 1]).toEqual([8, true]);
  });
  it("turns the root a full turn left in a spin, as the source turns the body (−2π), and not otherwise", () => {
    for (const m of MOVES.moves.filter((x) => x.spin || x.name === "slash")) {
      const c = PR.moveClip(m, idle.rest, { restSrc: idle.clip.restSrc }), yaw = [0.25, 0.5, 1].map((f) => Math.round(rootAt(c, f * c.dur).yaw));
      if (m.spin) expect([m.name, yaw[0]! <= 0 && yaw[1]! < yaw[0]! && yaw[2]! < yaw[1]!, yaw[2]]).toEqual([m.name, true, -360]);
      else expect([m.name, yaw]).toEqual([m.name, [0, 0, 0]]);
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
    const kick = (m: Record<string, unknown>[]) => m.find((x) => x.hand === "kick")!;
    const cases: [string, Record<string, unknown>][] = [
      ["MV-E001", { moves: MOVES.moves }],
      ["MV-E001", { about: "  ", moves: MOVES.moves }],
      ["MV-E002", edit((m) => delete m[0]!.reach)],
      ["MV-E002", edit((m) => delete m[0]!.wind)],
      ["MV-E002", edit((m) => (m[0]!.spin = "yes"))],
      ["MV-E002", edit((m) => (m[0]!.height = null))],
      ["MV-E002", edit((m) => (m[0]!.reach = { a: 1 }))],
      ["MV-E003", edit((m) => (m[0]!.hold = 1))],
      ["MV-E003", edit((m) => (m[0]!.hold = 0))],
      ["MV-E003", edit((m) => (m[0]!.hold = 0.96))],
      ["MV-E003", edit((m) => (m[0]!.hand = "foot"))],
      ["MV-E003", edit((m) => (m[0]!.about = " "))],
      ["MV-E003", edit((m) => (m[0]!.reach = [1, 1, 1]))],
      ["MV-E003", edit((m) => (m[0]!.windReach = 3))],
      ["MV-E003", edit((m) => (m[0]!.hit = 1.5))],
      ["MV-E003", edit((m) => (m[0]!.lunge = 1000))],
      ["MV-E003", edit((m) => (m[0]!.twist = -1))],
      ["MV-E004", edit((m) => (m[3]!.name = m[2]!.name))],
      ["MV-E004", edit((m) => (m[2]!.name = "Over Head"))],
      ["MV-E005", edit((m) => (m[0]!.alt = "nothing"))],
      ["MV-E006", edit((m) => (m[0]!.speed = 2))],
      ["MV-E006", { ...MOVES, speed: 2 }],
      ["MV-E007", edit((m) => delete m[0]!.height)],
      ["MV-E007", edit((m) => (m.find((x) => x.plane === "side")!.height = [0, 0]))],
      ["MV-E008", edit((m) => ((kick(m).plane = "side"), delete kick(m).height))],
    ];
    for (const [code, data] of cases) expect([code, codes(data)]).toEqual([code, [code]]);
    // what JSON Schema can say, it says too
    for (const [code, data] of cases.filter(([c]) => ["MV-E001", "MV-E002", "MV-E003", "MV-E006", "MV-E008"].includes(c))) expect([code, schema(data)]).toEqual([code, false]);
    expect(Object.keys(PR.MOVES_RULES)).toEqual(["MV-E001", "MV-E002", "MV-E003", "MV-E004", "MV-E005", "MV-E006", "MV-E007", "MV-E008"]);
  });
  it("holds shardfall's seven moves in the one unit system: its arm lengths, metres and radians converted", () => {
    // shardfall's anim/moves.toml (pinned) as written there: heights in arm lengths above the shoulders, lunges in
    // metres at 0.0529 m a unit, lean in radians; the rest as the model reads them (my-3d2dge's 11.6-unit hip, 9.2-unit arm)
    const SRC: Record<string, Record<string, unknown>> = {
      whirlwind: { hand: "pair", from: 80, to: 80, height: [-0.3, -0.3], reach: [0.9, 0.9], wind: 0.02, active: 0.96, recover: 0.02, hit: 0.5, lunge: 0, crouch: 0.1, lean: 0.1, twist: 0, spin: true },
      roar: { hand: "pair", from: 70, to: 74, height: [0.35, 0.45], reach: [0.8, 0.9], wind: 0.25, active: 0.15, recover: 0.4, hold: 0.5, lunge: 0, crouch: 0.1, lean: -0.3, twist: 0, trail: false },
      leap: { plane: "side", from: 140, to: -70, reach: [0.76, 0.76], wind: 0.18, active: 0.1, recover: 0.3, lunge: 0.1, crouch: 0.55, lean: 0.45 },
      lunge: { hand: "pair", from: 15, to: 10, height: [0.05, 0.1], reach: [0.5, 0.95], wind: 0.14, active: 0.08, recover: 0.22, lunge: 0.25, crouch: 0.3, lean: 0.5, twist: 0, trail: false },
      stir: { from: -50, to: 50, height: [-0.95, -0.95], reach: [0.55, 0.55], wind: 0.05, active: 1, recover: 0.05, hit: 0, lunge: 0, crouch: 0.05, lean: 0.15, twist: 0.3, trail: false, alt: "stir_back" },
      stir_back: { from: 50, to: -50, height: [-0.95, -0.95], reach: [0.55, 0.55], wind: 0.05, active: 1, recover: 0.05, hit: 0, lunge: 0, crouch: 0.05, lean: 0.15, twist: 0.3, trail: false },
      flick: { plane: "side", from: -40, to: 35, reach: [0.6, 0.6], wind: 0.12, active: 0.08, recover: 0.25, lunge: 0, crouch: 0, lean: 0.05, trail: false },
    };
    const r2 = (x: number) => Math.round(x * 100) / 100, pctArm = (a: number) => r2(((a * 9.2) / 11.6) * 100), pctM = (m: number) => r2((m / 0.0529 / 11.6) * 100);
    for (const [name, s] of Object.entries(SRC)) {
      const m = MOVES.moves.find((x) => x.name === name)!, h = s.height as number[] | undefined;
      const want = {
        hand: s.hand ?? "right", plane: s.plane ?? "ground", from: s.from, to: s.to, height: h?.map(pctArm), reach: s.reach, wind: s.wind, active: s.active, recover: s.recover,
        hold: s.hold ?? 0.3, hit: s.hit ?? 0.35, lunge: pctM(s.lunge as number), hop: 0, crouch: s.crouch, lean: r2(((s.lean as number) * 180) / Math.PI), twist: s.twist ?? 1, spin: s.spin ?? false, trail: s.trail ?? true, alt: s.alt,
      };
      const got = { hand: m.hand, plane: m.plane, from: m.from, to: m.to, height: m.height, reach: m.reach, wind: m.wind, active: m.active, recover: m.recover, hold: m.hold, hit: m.hit, lunge: m.lunge, hop: m.hop, crouch: m.crouch, lean: m.lean, twist: m.twist, spin: m.spin, trail: m.trail, alt: m.alt };
      expect([name, got]).toEqual([name, want]);
    }
  });
});

describe("a gait", () => {
  it("puts a foot still in the world through its stance, its lift-off and its set-down, and nowhere near the floor between", () => {
    // in the root's frame, which moves at the ground speed: a standing foot goes back at that speed; it lifts off to
    // 80 in the swing's first fifth and sets down from 40 in its last tenth
    const stance = 0.6, stride = 400, lift = 120, speed = stride / stance, foot = (v: number) => PR.footAt(v, stance, stride, lift, 80, 0.2, 40, 0.1);
    const world = (v: number) => foot(v)[0] + speed * v;
    for (const v of [0, 0.1, 0.3, 0.59]) expect(world(v)).toBeCloseTo(world(0), 6);
    const s = (u: number) => stance + u * (1 - stance);
    expect(world(s(0.19))).toBeCloseTo(world(s(0)), 6);
    expect(world(s(0.91))).toBeCloseTo(world(s(1)), 6);
    expect([foot(s(0.2))[1], foot(s(0.9))[1]].map((x) => Math.round(x * 1e6) / 1e6)).toEqual([80, 40]);
    // moving, it is never lower than the lower of the two and peaks at `lift`; it comes down one stride on
    const ups = Array.from({ length: 71 }, (_, i) => foot(s(0.2 + i * 0.01))[1]);
    expect(Math.min(...ups)).toBeGreaterThanOrEqual(40 - 1e-9);
    expect(Math.max(...ups)).toBeCloseTo(lift, 0);
    expect(world(1 - 1e-9) - world(0)).toBeCloseTo(speed, 3);
    // one clearance and share serve both ends by default
    expect(PR.footAt(s(0.95), stance, stride, lift, 40)[1]).toBeCloseTo(PR.footAt(s(0.05), stance, stride, lift, 40)[1], 6);
  });
  it("is a travelling loop of one cycle at 60 fps whose contacts are where its feet stand, from any rest", () => {
    for (const id of ["MESH2MOTION/Idle_A", "STYLE100/Neutral_Walk"]) {
      const src = load(id);
      for (const g of PR.GAITS) {
        const c = PR.gaitClip(g, src.rest, { restSrc: src.clip.restSrc });
        expect([g.name, validate(c).errors]).toEqual([g.name, []]);
        expect([c.loop, c.dur, c.id, c.contacts?.by]).toEqual([true, g.cycle, `PROCEDURAL/${g.name.charAt(0).toUpperCase()}${g.name.slice(1)}`, "labelled"]);
        expect([g.name, c.contacts?.footL?.length, c.contacts?.footR?.length]).toEqual([g.name, 1, 1]);
        // the root goes speed × cycle (% of the hip height) each cycle
        expect(rootAt(c, c.dur).forward).toBe(Math.round(g.speed * g.cycle));
        // each foot, through its contact, within 10 mm of where it landed and on the floor; between, off it
        const H = src.rest.H0, travel = (rootAt(c, c.dur).forward / 100) * H;
        const ankle = (t: number, s: "L" | "R") => {
          const k = Math.floor(t / c.dur), u = t - k * c.dur, p = at(points(src.rest, keyAt(c, u) as never), `ankle${s}`);
          return [p[0] + (rootAt(c, u).forward / 100) * H + k * travel, p[1], p[2]];
        };
        for (const s of ["L", "R"] as const) {
          const [a, b] = c.contacts![`foot${s}`]![0]!, from = ankle(a, s);
          let drift = 0, swingLow = Infinity;
          for (let t = a; t <= b; t += 0.02) drift = Math.max(drift, Math.hypot(...ankle(t, s).map((v, i) => v - from[i]!)));
          for (let t = b + 0.2 * (c.dur - (b - a)); t < a + c.dur - 0.2 * (c.dur - (b - a)); t += 0.02) swingLow = Math.min(swingLow, ankle(t, s)[2]! - from[2]!);
          expect([id, g.name, s, drift < 10, swingLow > 0.05 * H]).toEqual([id, g.name, s, true, true]);
        }
      }
    }
  }, 30_000);
  it("swings the arms against the legs and leans its torso as told", () => {
    const src = load("MESH2MOTION/Idle_A"), walk = PR.GAITS.find((g) => g.name === "walk")!, c = PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc });
    // the right foot lands ahead at 0 with the left hand forward, the left at half a cycle with the right hand forward
    const hands = (t: number) => {
      const X = points(src.rest, keyAt(c, t) as never);
      return at(X, "wristL")[0] - at(X, "wristR")[0];
    };
    const armLen = src.rest.H0 * 0.6;
    expect([hands(0) > 0.15 * armLen, hands(c.dur / 2) < -0.15 * armLen]).toEqual([true, true]);
    // a lean of 12° is the chest's pitch in the keys (it bends from the spine as the rest's shares say), the neck ahead
    const lean = (deg: number) => {
      const k = PR.gaitClip({ ...walk, lean: deg }, src.rest, { restSrc: src.clip.restSrc }), X = points(src.rest, keyAt(k, 0) as never);
      return [(k.keys[0] as unknown as { chest: number[] }).chest[1]!, at(X, "neck")[0] - at(X, "pelvis")[0]] as const;
    };
    const [l0, l12] = [lean(0), lean(12)];
    expect([l12[0] - l0[0], l12[1] - l0[1] > 40]).toEqual([12, true]);
  });
  it("limps: the weak leg stands for less, the pelvis drops over it, and a foot is always down", () => {
    const src = load("MESH2MOTION/Idle_A"), g = PR.GAITS.find((x) => x.name === "limp")!, limp = PR.gaitClip(g, src.rest, { restSrc: src.clip.restSrc });
    const span = (iv: [number, number][]) => iv.reduce((a, [x, y]) => a + y - x, 0);
    expect(span(limp.contacts!.footL!)).toBeLessThan(span(limp.contacts!.footR!) * 0.8);
    const down = (t: number) => (["footL", "footR"] as const).some((f) => limp.contacts![f]!.some(([a, b]) => (a <= t && b >= t) || (b > limp.dur && t <= b - limp.dur)));
    for (let t = 0; t < limp.dur; t += 0.02) expect([t, down(t)]).toEqual([t, true]);
    // the pelvis, less its bounce (1.5% of the hip height, twice a cycle), drops over the weak leg as it stands: by
    // 4% × the limp at the middle of its stance, against its ends
    const pct = src.rest.H0 / 100, [a, b] = limp.contacts!.footL![0]!, z = (t: number) => {
      const u = ((t % limp.dur) + limp.dur) % limp.dur;
      return at(points(src.rest, keyAt(limp, u) as never), "pelvis")[2] + 1.5 * pct * Math.cos(4 * Math.PI * (u / limp.dur - 0.08));
    };
    expect((z((a + b) / 2) - (z(a) + z(b)) / 2) / pct).toBeLessThan(-0.6 * 4 * g.limp!);
  });
  it("refuses a gait it can't play, saying what to change", () => {
    const src = load("MESH2MOTION/Idle_A"), walk = PR.GAITS[0]!, play = (g: Partial<PR.Gait>) => () => PR.gaitClip({ ...walk, ...g }, src.rest, { restSrc: src.clip.restSrc });
    expect(play({ speed: 0 })).toThrow(/speed 0 is not above 0/);
    expect(play({ cycle: 5 })).toThrow(/cycle 5 is not 0.3 to 3 s/);
    expect(play({ stance: 0.8 })).toThrow(/stance 0.8 is not 0.2 to 0.75/);
    expect(play({ stance: 0.75, limp: 1 })).toThrow(/leaves the right foot \d+% of the cycle to swing/);
    expect(play({ lift: 5 })).toThrow(/lift 5 is not 9 to 60/);
    expect(play({ speed: 600, cycle: 1.2 })).toThrow(/reach \d+% of a leg .* past 75%: slow it/);
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
      // the weight goes over one foot in the loop's first half and the other in its second, the chest tipped away
      const side = (t: number) => at(points(src.rest, keyAt(c, t) as never), "pelvis")[1] - at(first, "pelvis")[1], swayed = ((Math.round(i.sway ?? 2) * src.rest.H0) / 100) * 0.9;
      const tilt = (t: number) => (keyAt(c, t) as unknown as { chest: number[] }).chest[2]!;
      expect([side(c.dur / 4) > swayed, side((3 * c.dur) / 4) < -swayed, tilt(c.dur / 4) < 0, tilt((3 * c.dur) / 4) > 0]).toEqual([true, true, true, true]);
      // a breath that doesn't divide the shift is rounded to one that does, so the loop goes on through its seam (its
      // last key is its first; the frame before it is a frame's motion away, not a part breath's)
      const odd = PR.idleClip({ ...i, breath: (i.breath ?? 3.4) * 0.87 }, src.rest, { restSrc: src.clip.restSrc });
      expect(farthest(points(src.rest, keyAt(odd, odd.dur - 1 / 30) as never), points(src.rest, odd.keys[0]!))).toBeLessThan(2);
      // a breath in lifts the chest (it leans back) and shrugs the shoulders, and breathes out again
      const breaths = Math.max(1, Math.round((i.shift ?? 6.8) / (i.breath ?? 3.4))), key = (t: number) => keyAt(c, t) as unknown as Record<string, number[]>;
      const breath = (t: number) => [key(t).chest?.[1] ?? 0, key(t).shL?.[1] ?? 0, key(t).shR?.[1] ?? 0].map((x) => Math.round(x));
      const [inL, inS] = [breath(c.dur / (2 * breaths)), breath(c.dur / breaths)];
      expect([i.name, inL[0]! <= -1, inL[1]! >= 1, inL[2]! >= 1, inS]).toEqual([i.name, true, true, true, [0, 0, 0]]);
    }
  }, 30_000);
});

// Procedural sources (WP-6.2, D71): the move model against my-3d2dge's own numbers (spec/vectors/frozen/moves.json,
// its 24 moves on its three builds), moves that begin and end at any start pose, library/moves.json's shape and
// checks, the gait's foot path and loop, and the idle's planted feet and closed loop.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { parseClip, procedural as PR, validate, type Clip, type Rest } from "../src/index.ts";
import { P, POINTS } from "../src/format/body.ts";
import { decodePose, torso, type KeyLike } from "../src/format/pose.ts";
import { keyAt } from "../src/format/sample.ts";
import { rootAt } from "../src/clip/sample.ts";
import { ankleOf, checkGait, legsOf } from "../src/procedural/gait.ts";
import { quantize } from "../src/recipe/compile.ts";

const ROOT = join(import.meta.dirname, "../../.."), LIB = join(ROOT, "library/sets");
const MOVES = JSON.parse(readFileSync(join(ROOT, "library/moves.json"), "utf8")) as { about: string; moves: PR.Move[] };
/** Each set's manifest, read once for the file: one rest object for each library body, as a game holds one, so what core
 *  keeps by body (a gait's seam readings, gait.ts's SEAMS) serves every test that makes a gait on it (D89). */
const manifests = new Map<string, { sources: Record<string, { rest: Rest }> }>();
const manifest = (set: string) => manifests.get(set) ?? (manifests.set(set, JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }), manifests.get(set)!);
function load(id: string): { clip: Clip; rest: Rest } {
  const [set, slug] = id.split("/") as [string, string], clip = parseClip(readFileSync(join(LIB, set, `${slug}.json`), "utf8"));
  return { clip, rest: manifest(set).sources[clip.restSrc]!.rest };
}
/** A library source's rest by its set and source. */
const sourceRest = (set: string, src: string): Rest => manifest(set).sources[src]!.rest;
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
  /** Each move as a clip on the idle's rest from its standing pose: made once, on first use, and read (never changed)
   *  by every test below that reads it. */
  const made = new Map<PR.Move, Clip>();
  const onIdle = (m: PR.Move) => {
    let c = made.get(m);
    if (!c) made.set(m, (c = PR.moveClip(m, idle.rest, { restSrc: idle.clip.restSrc })));
    return c;
  };
  it("begins at the start pose it is given, and ends there, whichever it is", () => {
    for (const [rest, src, start] of [[idle.rest, idle.clip.restSrc, PR.standingOn(idle.rest)], [idle.rest, idle.clip.restSrc, idleStart], [style.rest, style.clip.restSrc, PR.standingOn(style.rest)]] as const) {
      const S = points(rest, quantize(start as never));
      for (const m of MOVES.moves) {
        const c = PR.moveClip(m, rest, { restSrc: src, start: start as never });
        expect([m.name, validate(c).errors]).toEqual([m.name, []]);
        expect([m.name, farthest(points(rest, c.keys[0]!), S) < 0.01]).toEqual([m.name, true]);
        expect([m.name, farthest(points(rest, keyAt(c, c.dur) as never), S) < 0.01]).toEqual([m.name, true]);
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
        expect([what, m.name, farthest(points(rest, c.keys[0]!), S) < 0.01, farthest(points(rest, keyAt(c, c.dur) as never), S) < 0.01]).toEqual([what, m.name, true, true]);
        // and as it strikes, each knee it stands on bends forward, ahead of the line from its hip to its ankle
        const X = points(rest, keyAt(c, c.events![0]!.t) as never), ahead = (s: string) => at(X, `knee${s}`)[0] - (at(X, `hip${s}`)[0] + at(X, `ankle${s}`)[0]) / 2;
        expect([what, m.name, ahead("L") > 0, m.hand === "kick" || ahead("R") > 0]).toEqual([what, m.name, true, true]);
      }
    }
  }, 30_000);
  it("begins and ends exactly where a start pose's fields end in .5, or its twist comes back a turn on", () => {
    // the library's middles the verifier found 3 mm off (a field of .5 rounded the other way after a blend by a hair,
    // or after the recovery unwrapped a twist a turn on: -5.5 against 354.5)
    for (const [id, names] of [["MESH2MOTION/Hit_Knockback", ["jab", "kick"]], ["STYLE100_BACK/RaisedRightArm_WalkBack", ["jab", "slash"]], ["STYLE100_BACKRUN/RaisedRightArm_RunBack", ["roundhouse"]]] as const) {
      const src = load(id), { t: _a, root: _b, yaw: _c, ...start } = keyAt(src.clip, src.clip.dur / 2) as unknown as Record<string, unknown>, S = points(src.rest, quantize(start as never));
      for (const m of MOVES.moves.filter((x) => (names as readonly string[]).includes(x.name))) {
        const c = PR.moveClip(m, src.rest, { restSrc: src.clip.restSrc, start: start as never });
        expect([id, m.name, farthest(points(src.rest, c.keys[0]!), S), farthest(points(src.rest, keyAt(c, c.dur) as never), S)]).toEqual([id, m.name, 0, 0]);
      }
    }
  });
  it("keeps the fists out of the torso from the wind's end on, where the source's stick figure has none", () => {
    // each fist's distance from the line from the pelvis to the shoulders' centre, between their heights, in half
    // shoulder widths (the hands are pushed out to 1.3 of them as the wind comes in; the IK and fitting lose a little)
    for (const m of MOVES.moves) {
      const c = onIdle(m);
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
      const c = onIdle(m), X = points(idle.rest, keyAt(c, c.events![0]!.t) as never);
      const apart = (a: string, b: string) => Math.hypot(...at(X, a).map((v, i) => v - at(X, b)[i]!));
      expect([m.name, apart("fistL", "fistR") / apart("shL", "shR") > 2.3]).toEqual([m.name, true]);
    }
  });
  it("leans the torso in as it crouches through the wind", () => {
    // the shoulders' centre ahead of the pelvis at the wind's end, in degrees from upright, over the crouching moves
    const crouching = MOVES.moves.filter((m) => m.crouch >= 0.3), lean = crouching.map((m) => {
      const c = onIdle(m), X = points(idle.rest, keyAt(c, PR.MIN_PHASE.wind) as never), p = at(X, "pelvis");
      const sh = [0, 1, 2].map((i) => (at(X, "shL")[i]! + at(X, "shR")[i]!) / 2);
      return (Math.atan2(sh[0]! - p[0], sh[2]! - p[2]) * 180) / Math.PI;
    });
    expect([crouching.length, lean.reduce((a, b) => a + b, 0) / lean.length > 1]).toEqual([8, true]);
  });
  it("turns the root a full turn left in a spin, as the source turns the body (−2π), and not otherwise", () => {
    for (const m of MOVES.moves.filter((x) => x.spin || x.name === "slash")) {
      const c = onIdle(m), yaw = [0.25, 0.5, 1].map((f) => Math.round(rootAt(c, f * c.dur).yaw));
      if (m.spin) expect([m.name, yaw[0]! <= 0 && yaw[1]! < yaw[0]! && yaw[2]! < yaw[1]!, yaw[2]]).toEqual([m.name, true, -360]);
      else expect([m.name, yaw]).toEqual([m.name, [0, 0, 0]]);
    }
  });
  it("is procedural and CC0 in its provenance, named and described from the move", () => {
    const c = onIdle(MOVES.moves[0]!);
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
    // one clearance and share serve both ends by default: up to 40 in the swing's first tenth, down from 40 in its last
    expect([PR.footAt(s(0.1), stance, stride, lift, 40)[1], PR.footAt(s(0.9), stance, stride, lift, 40)[1]].map((x) => Math.round(x * 1e6) / 1e6)).toEqual([40, 40]);
    // its height's slope runs on where the rise meets the arc and the arc the set-down, and is nothing at the floor: the
    // verifier's round 7 found it infinite as the arc began and 9.6 m/s to nothing as it set down (a run lifting 35%
    // on H0 1000: 350 mm, rising to 90 in 18% of the swing), a hitch that failed a loop's seam where it fell there
    for (const [lft, clr, off, land, landOff] of [[lift, 80, 0.2, 40, 0.1], [350, 90, 0.18, 45, 0.1], [90, 90, 0.3, 45, 0.3]] as const) {
      const y = (u: number) => PR.footAt(s(u), stance, stride, lft, clr, off, land, landOff)[1], e = 1e-6, slope = (u: number, side: number) => (y(u + side * e) - y(u)) / (side * e);
      for (const u of [off, 1 - landOff]) expect([lft, u, Math.abs(slope(u, -1) - slope(u, 1)) < 0.01 * lft]).toEqual([lft, u, true]);
      expect([lft, Math.abs(slope(0, 1)) < 1e-3, Math.abs(slope(1, -1)) < 1e-3]).toEqual([lft, true, true]);
    }
  });
  it("is a travelling loop of one cycle at 60 fps whose contacts are where its feet stand, from any rest", () => {
    for (const id of ["MESH2MOTION/Idle_A", "STYLE100/Neutral_Walk"]) {
      const src = load(id);
      for (const g of PR.GAITS) {
        const c = PR.gaitClip(g, src.rest, { restSrc: src.clip.restSrc });
        expect([g.name, validate(c).errors]).toEqual([g.name, []]);
        expect([c.loop, c.dur, c.fps, c.id, c.contacts?.by]).toEqual([true, g.cycle, 60, `PROCEDURAL/${g.name.charAt(0).toUpperCase()}${g.name.slice(1)}`, "labelled"]);
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
  it("closes its loop at the cycles it plays: its frames evenly spaced, each knee's twist meeting its first across the seam", () => {
    // off the 60 fps grid (a run of 0.705 s, a walk of 1.102 s) and on it with the knees swung widest (a run lifting 35%
    // and swaying 4%): the verifier's, whose last frame came 5 ms before the seam with the knees turned 9° to 23° on; on
    // three rests, and at 55 frames a second (the fewest taken) as well as 60; an even number of frames (a run of 0.65 s
    // at 60 is 40, not 39, whose left knee fell between frames and popped). Every frame kept as a key (a budget of 0 mm:
    // a frame within 2 mm of its neighbours' in-between is dropped otherwise, as one of the walk's on 100STYLE's rest is
    // since round 10, its arms bent alike throughout), so each is weighed. The run of 0.65 s fitted: on Mesh2Motion's rest
    // its left knee turns round on the seam past SEAM_TURN at 350 (0.76 of the sensors' fail level at 55 frames a
    // second), and it plays at 349 (round 11)
    const [walk, , run] = PR.GAITS;
    for (const id of ["MESH2MOTION/Idle_A", "STYLE100/Neutral_Walk", "CMU_CURATED/Crouch_Walk_Loop"]) {
      const src = load(id);
      for (const [g, fps] of [[{ ...run!, cycle: 0.705 }, 60], [{ ...walk!, cycle: 1.102 }, 60], [{ ...run!, lift: 35, sway: 4 }, 60], [PR.fitGait({ ...run!, cycle: 0.65 }, src.rest), 60], [{ ...run!, cycle: 0.705 }, 55]] as const) {
        const c = PR.gaitClip(g, src.rest, { restSrc: src.clip.restSrc, fps, budget: 0 }), n = 2 * Math.round((g.cycle * fps) / 2), times = Array.from({ length: n }, (_, i) => Math.round((i * g.cycle * 1000) / n) / 1000);
        expect([id, g.cycle, fps, c.dur, c.keys.length, c.keys.every((k) => times.includes(k.t) || k.t === c.dur)]).toEqual([id, g.cycle, fps, g.cycle, n + 1, true]);
        for (const l of ["armL", "armR", "legL", "legR"]) {
          const tw = [...times, c.dur].map((t) => (keyAt(c, t) as unknown as Record<string, number[]>)[l]![4]!), steps = tw.slice(1).map((x, i) => 180 - Math.abs(180 - Math.abs(x - tw[i]!)));
          // every step (a whole turn being none), the seam's among them, 3° or less: a knee turning on its own axis by no more than the format
          // rounds it to (1°) but for the widest swing (the verifier saw 8.8° with the knees not closed frame by frame)
          expect([id, g.cycle, fps, l, Math.max(...steps) <= 3]).toEqual([id, g.cycle, fps, l, true]);
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
  }, 30_000);
  it("aims each hand from the shoulder its key puts it on, so the arm the key holds is bent alike however far it leans", () => {
    // the key spreads a lean up the spine, so a torso turned whole about the pelvis decodes with its shoulders back (at
    // 25°, a fifth of an arm on Quaternius's UAL1), and a hand aimed from the turned shoulder was past the arm's reach
    // from the decoded one through part of the swing: the key held the arm straight there, its bend falling from 25° to 0
    // between two frames, and the elbow popped (109% of the fail level at 75 frames a second; round 9's review). Its
    // bends then ran 0 to 71 leaning 25, 0 to 61 leaning back 10, 0 to 55 leaning 8 (the run's lean) and 28 to 46 at the
    // default 3: now 39 throughout at each (the review's walk was 0.736 s; 0.75, its swing the shortest taken since round
    // 14, 0.3 s)
    const { rest, clip } = load("QUATERNIUS_3D2DGE/A_TPose");
    for (const lean of [-10, 25]) {
      const c = PR.gaitClip({ name: "g", about: "a walk", speed: 130, cycle: 0.75, stance: 0.6, lean, swing: 60 }, rest, { restSrc: clip.restSrc, fps: 75 });
      const bends = c.keys.flatMap((k) => ["armL", "armR"].map((f) => (k as unknown as Record<string, number[]>)[f]![3]!));
      expect([lean, Math.min(...bends), Math.max(...bends)]).toEqual([lean, 39, 39]);
    }
  });
  it("limps: the weak leg stands for less, the pelvis drops over it, and a foot is always down", () => {
    const src = load("MESH2MOTION/Idle_A"), g = PR.GAITS.find((x) => x.name === "limp")!, limp = PR.gaitClip(g, src.rest, { restSrc: src.clip.restSrc });
    const span = (iv: [number, number][]) => iv.reduce((a, [x, y]) => a + y - x, 0);
    expect(span(limp.contacts!.footL!)).toBeLessThan(span(limp.contacts!.footR!) * 0.8);
    // the weak leg's stance is the plain one shortened by 30% × the limp
    expect(span(limp.contacts!.footL!)).toBeCloseTo(g.stance * (1 - 0.3 * g.limp!) * g.cycle, 2);
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
  it("takes a key budget of 0 to 2 mm, the one every bound is measured at, and refuses any other", () => {
    // past it the sensors read what the keys leave out (at 150 to 300 mm the knees popped past the fail level, at 1,000, a
    // NaN or an infinite one 8 or 9 keys failed, and -1 threw a TypeError: round 13's review)
    const src = load("MESH2MOTION/Idle_A"), walk = PR.GAITS[0]!;
    for (const budget of [-1, NaN, Infinity, 2.5, 150, 1000]) expect(() => PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc, budget })).toThrow(new RegExp(`^gait walk: a key budget of ${budget} mm, not 0 to 2: .*; leave it out \\(2\\), or use 0 \\(every frame a key\\) to 2$`));
    expect(() => PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc, budget: "2" as never })).toThrow(/a key budget of "2" mm, not 0 to 2/);
    expect(PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc, budget: 2 })).toEqual(PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc }));
    expect(PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc, budget: 0 }).keys.length).toBe(67);
  }, 30_000);
  it("refuses a gait it can't play, saying what to change", () => {
    const src = load("MESH2MOTION/Idle_A"), walk = PR.GAITS[0]!, play = (g: Partial<PR.Gait>) => () => PR.gaitClip({ ...walk, ...g }, src.rest, { restSrc: src.clip.restSrc });
    expect(play({ speed: 0 })).toThrow(/speed 0 is not above 0/);
    expect(play({ cycle: 5 })).toThrow(/cycle 5 is not 0.3 to 3 s/);
    expect(play({ stance: 0.8 })).toThrow(/stance 0.8 is not 0.2 to 0.75/);
    expect(play({ stance: 0.75, limp: 1 })).toThrow(/leaves the right foot \d+% of the cycle to swing/);
    // a long cycle's limp swings long enough in time, but for 9% of the cycle
    expect(play({ speed: 30, cycle: 2.5, stance: 0.7, limp: 1 })).toThrow(/leaves the right foot 9% of the cycle to swing/);
    expect(play({ limp: 1.01 })).toThrow(/limp 1.01 is not 0 to 1/);
    // a swing under 0.3 s: under 0.2 the foot is up for under the 0.1 s the sensors read a step by (the verifier's limps
    // and fast walks, which slid 500 to 1,300 mm); under 0.25 a knee pops lifting more than 12 (R1, R5), bouncing 6, or
    // at a stance of 0.5 near the cap (the verifier's rounds 4 and 5), on many bodies; under 0.26 a stance of 0.5 near
    // the reach bound still did on some (round 6); and under 0.3, near the reach bound, the leading knee straightens and
    // bends again within one key where a swing spans under 16 frames, as it can at 55 to 60 frames a second, and popped
    // (round 13's review: CMU_18's rest, a swing of 0.261 s, 104.6% at 57.5). Each refusal names the shortest cycle and
    // the longest stance that swing long enough (a run's stance only where the cycle is long enough for one), and shows
    // the swing rounded down, so one just under the bound never reads as at it (0.1976 s here)
    expect(play({ speed: 70, cycle: 1, stance: 0.68, limp: 0.6 })).toThrow(/its right foot swings for 0.197 s, under 0.3 s: .*; use a cycle of at least 1.519 s, a stance of at most 0.593 or a lighter limp$/);
    expect(play({ cycle: 0.45 })).toThrow(/its feet swing for 0.180 s, under 0.3 s: .*; use a cycle of at least 0.75 s$/);
    expect(play({ speed: 120, cycle: 0.5, stance: 0.6, lift: 25 })).toThrow(/its feet swing for 0.200 s, under 0.3 s/);
    expect(play({ speed: 131, cycle: 0.8, stance: 0.75, lift: 35, sway: 4 })).toThrow(/its feet swing for 0.200 s, under 0.3 s: .*; use a cycle of at least 1.2 s or a stance of at most 0.625$/);
    expect(play({ speed: 60, cycle: 0.84, stance: 0.75, bounce: 6 })).toThrow(/its feet swing for 0.210 s, under 0.3 s/);
    expect(play({ speed: 400, cycle: 0.45, stance: 0.5 })).toThrow(/its feet swing for 0.225 s, under 0.3 s: .*; use a cycle of at least 0.6 s$/);
    expect(play({ speed: 100, cycle: 0.6, stance: 0.6, lift: 13 })).toThrow(/its feet swing for 0.240 s, under 0.3 s/);
    expect(play({ speed: 100, cycle: 0.625, stance: 0.6, lift: 13 })).toThrow(/its feet swing for 0.250 s, under 0.3 s/);
    expect(play({ speed: 100, cycle: 0.65, stance: 0.6, lift: 13 })).toThrow(/its feet swing for 0.260 s, under 0.3 s: .*; use a cycle of at least 0.75 s or a stance of at most 0.538$/);
    expect(play({ speed: 333.6, cycle: 0.555, stance: 0.53, lift: 10, bounce: 5.3, dip: 5.7, sway: 1.7, lean: -6, swing: 17 })).toThrow(/its feet swing for 0.260 s, under 0.3 s: .*; use a cycle of at least 0.639 s$/);
    expect(play({ speed: 100, cycle: 0.74, stance: 0.6 })).toThrow(/its feet swing for 0.296 s, under 0.3 s: .*; use a cycle of at least 0.75 s or a stance of at most 0.594$/);
    expect(play({ speed: 100, cycle: 0.75, stance: 0.6, lift: 13 })).not.toThrow();
    // each suggestion swings long enough (its numbers checked as gaitClip checks them first), and is the shortest cycle and
    // the longest stance that do: a ms shorter or a thousandth longer swings under 0.3 s (round 14 named them against 0.3
    // s and took swings of 0.2995 s, so a cycle a ms shorter than it named, or a stance a thousandth longer, was taken too:
    // round 14's review, {0.341 s, 0.547} named 0.663 s and took 0.662)
    for (const g of [{ speed: 70, cycle: 1.519, stance: 0.68, limp: 0.6 }, { speed: 70, cycle: 1, stance: 0.593, limp: 0.6 }, { speed: 100, cycle: 0.65, stance: 0.538 }, { speed: 100, cycle: 0.74, stance: 0.594 }, { speed: 100, cycle: 0.663, stance: 0.547 }]) expect(() => checkGait({ ...walk, ...g })).not.toThrow();
    for (const g of [{ speed: 70, cycle: 1.518, stance: 0.68, limp: 0.6 }, { speed: 70, cycle: 1, stance: 0.594, limp: 0.6 }, { speed: 100, cycle: 0.65, stance: 0.539 }, { speed: 100, cycle: 0.74, stance: 0.595 }, { speed: 100, cycle: 0.662, stance: 0.547 }]) expect(() => checkGait({ ...walk, ...g })).toThrow(/under 0.3 s/);
    expect(play({ speed: 100, cycle: 0.341, stance: 0.547 })).toThrow(/its feet swing for 0.154 s, under 0.3 s: .*; use a cycle of at least 0.663 s$/);
    // 0.3 s to within a float's error: 0.9375 s at a stance of 0.68 swings 0.3 s, which a float makes 0.29999999999999993
    // (the verifier's round 7 saw 0.8 s at a stance of 0.675 refused as "0.260 s, under 0.26 s"), and nothing shorter
    // (rounds 7 to 14 took the swing to the ms, so 0.2995 s passed, and with it a cycle of 0.599 s at a stance of a half,
    // 15.97 frames a swing at 55: round 14's review); and the limp, the presets' shortest swing (its right foot's 0.3006
    // s), is taken
    expect(() => checkGait({ ...walk, speed: 100, cycle: 0.9375, stance: 0.68 })).not.toThrow();
    expect(() => checkGait(PR.GAITS[3]!)).not.toThrow();
    for (const cycle of [0.599, 0.5995, 0.5999]) expect(play({ speed: 100, cycle, stance: 0.5 })).toThrow(/its feet swing for 0.299 s, under 0.3 s: .*; use a cycle of at least 0.6 s$/);
    expect(() => checkGait({ ...walk, speed: 100, cycle: 0.6, stance: 0.5 })).not.toThrow();
    // from a start pose other than the standing one, a gait kept the start's bent elbows and turned hands and swung them
    // into the body (a library clip's first key on its rest: Fighting_Right_Jab's wrist popped, Walk_Stealth's forearm
    // went into the pelvis; 8 of 227 such clips failed, round 12's review), and nothing of a gait is fitted or measured
    // from one: it is refused, and the standing pose itself taken
    const jab = load("MESH2MOTION/Fighting_Right_Jab"), { t: _t, root: _r, yaw: _y, ...jabStart } = jab.clip.keys[0] as unknown as Record<string, unknown>;
    expect(() => PR.gaitClip(walk, jab.rest, { restSrc: jab.clip.restSrc, start: jabStart as never })).toThrow(/given a start pose other than the standing one: a gait is made from the standing pose .* give it no start, and blend into it from another pose$/);
    // and anything but a pose likewise, in the gait's words (null threw a TypeError: round 14's review)
    for (const start of [null, 1, "standing", []]) expect(() => PR.gaitClip(walk, jab.rest, { restSrc: jab.clip.restSrc, start: start as never })).toThrow(/^gait walk: given a start pose other than the standing one/);
    expect(PR.gaitClip(walk, jab.rest, { restSrc: jab.clip.restSrc, start: PR.standingOn(jab.rest) })).toEqual(PR.gaitClip(walk, jab.rest, { restSrc: jab.clip.restSrc }));
    // a run's cycle under 0.6 s: its seam moved too sharply (R3: 64 of 64 rests; at 0.4 s, which swings 0.28 s, refused
    // for its swing since round 14, naming a cycle that is a run's too)
    expect(play({ speed: 350, cycle: 0.45, stance: 0.3, lift: 25, bounce: 3, lean: 8, swing: 45 })).toThrow(/a run's cycle of 0.45 s is under 0.6 s \(over 200 steps a minute\): .*; use a longer cycle$/);
    expect(play({ speed: 350, cycle: 0.4, stance: 0.3, lift: 25, bounce: 3, lean: 8, swing: 45 })).toThrow(/its feet swing for 0.280 s, under 0.3 s: .*; use a cycle of at least 0.6 s$/);
    // lifting over 25, 0.65 s: a run lifting 35% and swaying 4% failed its seam at 0.6 and 0.625 s
    expect(play({ ...PR.GAITS[2], cycle: 0.6, lift: 35, sway: 4 })).toThrow(/a run's cycle of 0.6 s, lifting 35% of the hip height, is under 0.65 s .*; use a longer cycle or a lift of 25 or less$/);
    // 55 to 75 frames a second: under, a fast gait's seam steps too far between frames (the verifier's at 24, on 53 of
    // 64 rests) and at 50 a swing of 0.26 s just over a stance of a half still popped a knee (round 7: 7 of 456 on 19
    // rests); over, the pelvis's whole-% steps between them read as pops (at 90 a slow gait read 97% of the fail level
    // and an elbow popped: round 9; at 110 a planted knee jumped with it, round 7; at 240 a walk failed on every rest).
    // Such a gait at the shortest swing taken now (0.3 s, round 14)
    expect(play({ speed: 300, cycle: 0.625, stance: 0.52, lift: 30 })).not.toThrow();
    expect(() => PR.gaitClip({ ...walk, speed: 300, cycle: 0.625, stance: 0.52, lift: 30 }, src.rest, { restSrc: src.clip.restSrc, fps: 50 })).toThrow(/made at 50 frames a second, not 55 to 75/);
    expect(() => PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc, fps: 30 })).toThrow(/made at 30 frames a second, not 55 to 75: .*use 55 to 75/);
    expect(() => PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc, fps: 75.1 })).toThrow(/made at 75.1 frames a second, not 55 to 75/);
    expect(() => PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc, fps: 90 })).toThrow(/made at 90 frames a second, not 55 to 75: .*more, the pelvis's whole-% steps between them read as pops/);
    expect(() => PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc, fps: 54.9 })).toThrow(/made at 54.9 frames a second, not 55 to 75/);
    expect(() => PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc, fps: "60" as never })).toThrow(/made at "60" frames a second/);
    expect(PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc, fps: 75 }).fps).toBe(75);
    expect(PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc, fps: 55 }).fps).toBe(55);
    // named and described, its numbers numbers: refused before it is made, by the field (a gait without them threw a
    // TypeError once made: the verifier's round 7)
    const { name: _n, about: _a, ...nameless } = walk;
    expect(() => PR.gaitClip(nameless as PR.Gait, src.rest, { restSrc: src.clip.restSrc })).toThrow(/^gait: its name is missing: give it a name \(its clip is PROCEDURAL\/<Name>\) and an about line/);
    expect(play({ about: undefined as never })).toThrow(/^gait walk: its about is missing/);
    expect(play({ about: " " })).toThrow(/^gait walk: its about is " "/);
    expect(play({ speed: "130" as never })).toThrow(/^gait walk: speed "130" is not a number/);
    expect(play({ lift: "20" as never })).toThrow(/^gait walk: lift "20" is not a number/);
    expect(play({ lift: 5 })).toThrow(/lift 5 is not 9 to 35/);
    // the numbers past which a preset's knees pop (D71): a lift of 40, a sway of 5
    expect(play({ lift: 40 })).toThrow(/lift 40 is not 9 to 35 .*knees pop/);
    expect(play({ sway: 5 })).toThrow(/sway 5 is not 0 to 4/);
    expect(play({ bounce: -1 })).toThrow(/bounce -1 is not 0 to 6/);
    expect(play({ dip: 13 })).toThrow(/dip 13 is not 0 to 12/);
    expect(play({ lean: 26 })).toThrow(/lean 26 is not -10 to 25 degrees/);
    expect(play({ swing: 90 })).toThrow(/swing 90 is not 0 to 80 degrees/);
    // a stride past 72% of a leg ahead and behind, at its edge on two rests (the verifier's round 7: no test held the bound
    // itself), the refusal naming what fitGait makes of it, which plays (144.61%, shown rounded up from round 8 on, so a
    // reach just past the bound never reads as at it; "at most" until round 12, which no speed below it promised)
    expect(play({ speed: 380, cycle: 1.2, stance: 0.5 })).toThrow(/reach 144\.7% of a leg .* past 72%: on these legs, at this cycle and stance, it plays at 189% of the hip height a second \(\d+ mm\/s\); slow it so \(fitGait does\), or shorten its cycle or stance$/);
    const style = load("STYLE100/Neutral_Walk");
    for (const [rest, restSrc, most] of [[src.rest, src.clip.restSrc, 189], [style.rest, style.clip.restSrc, 177]] as const) {
      const at = (speed: number) => () => PR.gaitClip({ ...walk, speed, cycle: 1.2, stance: 0.5 }, rest, { restSrc });
      expect(at(most), `${most}`).not.toThrow();
      expect(at(most + 1)).toThrow(new RegExp(`reach 72\\.\\d% of a leg .* past 72%: .* it plays at ${most}% of the hip height a second`));
    }
    // a foot swinging forward past the hips faster than 4 hip heights a second: a long stance's knee popped mid-swing
    // (the verifier's 140 % a second at stance 0.75: 13 of 128 clips, on 12 rests)
    expect(play({ speed: 140, cycle: 1.2, stance: 0.75 })).toThrow(/its feet come forward past the hips at 420% of the hip height a second, over 400: .*; use a speed of at most 133 \(fitGait slows it so\) or a shorter stance$/);
    // (457.01, shown rounded up: a pace just over the cap read as at it, "400% ..., over 400", at speeds of 266.7 to 267
    // here: the verifier's round 8)
    expect(play({ speed: 110, cycle: 1.55, stance: 0.62, limp: 1 })).toThrow(/its right foot comes forward past the hips at 458% .*; use a speed of at most 96 \(fitGait slows it so\), a shorter stance or a lighter limp$/);
    expect(play({ speed: 266.7, cycle: 1, stance: 0.6 })).toThrow(/its feet come forward past the hips at 401% of the hip height a second, over 400/);
    // arms swinging 80° either way in a 0.52 s cycle turned round on the loop's seam so fast that, read by parts, a test
    // character's fists read 101% of the seam's fail level (round 9), and a swing took 250° for each second squared of
    // the cycle (rounds 9 to 13): every cycle taken now is 0.6 s or more (a swing of 0.3 s at a stance of a half, and a
    // run's shortest), where that is 90°, past the swing's range, so the body's own reading bounds it alone (the seam's
    // keys as the clip holds them, read as the sensors read them). On Mesh2Motion's rest at 0.6 s, its feet at the reach
    // bound (340), its hands read past SEAM_TURN at a swing of 69° (76% of the fail level) and under it at 68 and every
    // narrower whole swing, so the widest that plays, and every narrower one with it, is 68 (each swing's own reading rises
    // and falls with it: round 11 read 75 as playing, and 64 to 68 not, on a test character)
    expect(play({ speed: 100, cycle: 0.565, stance: 0.5, swing: 80 })).toThrow(/its feet swing for 0.282 s, under 0.3 s/);
    expect(play({ speed: 100, cycle: 0.6, stance: 0.5, swing: 80 })).not.toThrow();
    expect(play({ speed: 340, cycle: 0.6, stance: 0.5, swing: 80 })).toThrow(/^gait walk: its right hand turns round on the loop's seam 76% as sharply as the sensors read a hitch there swinging 69°, narrower than its own swing, over 70% \(its arms turning round as the cycle ends and begins\): on this body, at this cycle, its arms play swinging any whole number of degrees up to 68 either way; narrow its swing so \(fitGait does\), or use a longer cycle$/);
    for (const swing of [68, 45]) expect(play({ speed: 340, cycle: 0.6, stance: 0.5, swing })).not.toThrow();
    // fitGait narrows to it from any wider swing (so a narrower swing asked for is never fitted wider), and keeps one under it
    expect([80, 70, 69, 68, 45].map((swing) => PR.fitGait({ ...walk, speed: 340, cycle: 0.6, stance: 0.5, swing }, src.rest).swing)).toEqual([68, 68, 68, 68, 45]);
    // and a refusal of its legs names the whole of what fitGait makes of it, the swing narrowed too (round 11's named the
    // speed alone, at which the hands were then refused: round 11's review)
    expect(play({ speed: 380, cycle: 0.6, stance: 0.5, swing: 80 })).toThrow(/past 72%: on these legs, at this cycle and stance, it plays at 340% of the hip height a second \(\d+ mm\/s\), its arms swinging 68° either way; slow it and narrow its swing so \(fitGait does\), or shorten its cycle or stance$/);
    expect(PR.fitGait({ ...walk, speed: 380, cycle: 0.6, stance: 0.5, swing: 80 }, src.rest)).toEqual({ ...walk, speed: 340, cycle: 0.6, stance: 0.5, swing: 68 });
    // and the reach the same way ("72.0% ... past 72%" at fractional speeds just past the bound), a rate of NaN as
    // itself (it read "null"), and a body without legs in the gait's own words (a validator's dump of NaNs)
    expect(play({ speed: 619.2, cycle: 0.6, stance: 0.2 })).toThrow(/its feet reach 72\.1% of a leg ahead and behind .* past 72%/);
    expect(() => PR.gaitClip(walk, src.rest, { restSrc: src.clip.restSrc, fps: NaN })).toThrow(/made at NaN frames a second, not 55 to 75/);
    expect(() => PR.gaitClip(walk, { ...src.rest, thigh: 0, shin: 0 }, { restSrc: src.clip.restSrc })).toThrow(/^gait walk: the rest's legs have no length/);
    // a leg folded shut: a stance of 0.2 lifting 35 and bouncing 6 at the reach bound swings its foot back and forward
    // far past the stride's ends, the pelvis is lowered for a leg to reach them (to 47% of the hip height), and the foot
    // passed under the hips within 6% of a leg, the knee flipping round at 25 m/s (the verifier's round 8); under 25% of
    // a leg it is refused, naming the fastest speed and the highest lift that fit, and fitGait's speed is taken
    const fold = { cycle: 0.65, stance: 0.2, lift: 35, bounce: 6 };
    expect(play({ ...fold, speed: 582 })).toThrow(/its swinging foot comes within 5\.7% of a leg of its hip, under 25%: .*; on these legs, at this cycle and stance, it plays at 500% of the hip height a second \(\d+ mm\/s\); slow it so \(fitGait does\), or lower its lift \(at this speed it lifts at most 9%\), bounce or dip$/);
    expect(play({ ...fold, speed: 501 })).toThrow(/within 24\.8% of a leg of its hip, under 25%: .* plays at 500% .* \(at this speed it lifts at most 34%\)/);
    expect(play({ ...fold, speed: 500 })).not.toThrow();
    // and past the reach bound too, the refusal names the speed that plays, not the reach's alone (582 here)
    expect(play({ ...fold, speed: 600 })).toThrow(/its feet reach 7\d\.\d% of a leg .* past 72%: .* it plays at 500% of the hip height a second/);
    // a knee under the floor: a stance of 0.2 lifting 9, bouncing 6 and swaying 4 at the reach bound swings the foot
    // back past the stride's end barely lifted, under hips lowered to under half the hip height, and the knee bent
    // forward under them went 61 to 85 mm through the floor on CMU's rests (round 8's review, at fitGait's speed then,
    // its legs folded no further than 25 to 27%); it is refused, naming the speed that plays (shown rounded up: 0.07%)
    const cmu = load("CMU_CURATED/Walk_Loop"), low = { ...walk, cycle: 0.6, stance: 0.2, lift: 9, bounce: 6, dip: 6, sway: 4 };
    expect(() => PR.gaitClip({ ...low, speed: 559 }, cmu.rest, { restSrc: cmu.clip.restSrc })).toThrow(/^gait walk: a knee goes 0\.1% of the hip height under the floor: .*; on these legs, at this cycle and stance, it plays at 558% of the hip height a second \(\d+ mm\/s\); slow it so \(fitGait does\), or shorten its cycle, or lower its bounce$/);
    expect(PR.fitGait({ ...low, speed: 1000 }, cmu.rest)).toEqual({ ...low, speed: 558 });
    // a knee turning round on the loop's seam: a run's left foot lands half a cycle after the right, so as the loop ends
    // and begins it swings, and at the shortest run cycles, at a stance of about 0.35 to 0.45, it has just stopped going
    // back with the ground and is coming forward at its sharpest; the knee reversed across the seam and the sensors read
    // a hitch there (round 10's review: 33 of 2,600 fitted runs at 0.6 to 0.63 s, to 113.5%, and CMU_26's own at 364.307
    // read 107% at 60 frames a second). Past SEAM_TURN (70% of the level the sensors fail it at, read on the keys the clip
    // holds about the seam: 108% here) it is refused, naming what fitGait makes of it (348); the presets' run at 0.65 s
    // too, on Mesh2Motion's rest (77% at 350, 86% at 348: the reading rises and falls with the speed, so a refusal names
    // the speed that plays, 349, and promises nothing under it, as round 11's "at most" did; refused at 348, it names 346)
    const cmu26 = sourceRest("CMU_CURATED", "CMU_26");
    expect(() => PR.gaitClip({ ...walk, cycle: 0.6, stance: 0.374, lift: 12.274, bounce: 1.273, dip: 11.24, sway: 4, speed: 364.307 }, cmu26, { restSrc: "CMU_26" })).toThrow(/^gait walk: its left knee turns round on the loop's seam 108% as sharply as the sensors read a hitch there, over 70% \(a run's left foot coming forward as the cycle ends and begins\): on these legs, at this cycle and stance, it plays at 348% of the hip height a second \(\d+ mm\/s\); slow it so \(fitGait does\), or use a longer cycle or another stance$/);
    expect(play({ ...PR.GAITS[2], cycle: 0.65 })).toThrow(/its left knee turns round on the loop's seam 77% .* it plays at 349% of the hip height a second/);
    expect(play({ ...PR.GAITS[2], cycle: 0.65, speed: 349 })).not.toThrow();
    expect(play({ ...PR.GAITS[2], cycle: 0.65, speed: 348 })).toThrow(/its left knee turns round on the loop's seam 86% .* it plays at 346% of the hip height a second/);
    // the review's two (round 11's): CMU_144's run read seamVelocity@ankleL at 91% at 72.5 frames a second where the model
    // that left out the leg's rounding read 70%, and CMU_18's warned at its seam where it read 26%: each is read on the
    // clip's own keys now, refused, and fitted
    const cmu144 = sourceRest("CMU_CURATED", "CMU_144"), cmu18 = sourceRest("CMU_CURATED", "CMU_18");
    const run144 = { ...walk, cycle: 0.6, stance: 0.402, limp: 0, lift: 11.002, bounce: 5.603, dip: 8.861, sway: 0.91, lean: -2.158, swing: 12.87, speed: 370.12 }, run18 = { ...walk, cycle: 0.612, stance: 0.447, lift: 14.32, bounce: 0.634, dip: 9.281, sway: 0.553, lean: 13.092, swing: 6.607, speed: 352.08 };
    expect(() => PR.gaitClip(run144, cmu144, { restSrc: "CMU_144", fps: 72.5 })).toThrow(/its left foot turns round on the loop's seam 92% .* it plays at 368% of the hip height a second/);
    expect(() => PR.gaitClip(run18, cmu18, { restSrc: "CMU_18" })).toThrow(/its left foot turns round on the loop's seam 71% .* it plays at 350% of the hip height a second/);
    expect([PR.fitGait(run144, cmu144).speed, PR.fitGait(run18, cmu18).speed]).toEqual([368, 350]);
  });
  it("fits a gait to a body: the fastest whole speed its legs and its pace take, a lower lift only where none does, and its arms' swing narrowed where its hands need it", () => {
    const idle = load("MESH2MOTION/Idle_A"), style = load("STYLE100/Neutral_Walk"), fast = { ...PR.GAITS[0]!, speed: 1000, cycle: 1.2, stance: 0.5 };
    expect([PR.fitGait(fast, idle.rest), PR.fitGait(fast, style.rest)]).toEqual([{ ...fast, speed: 189 }, { ...fast, speed: 177 }]);
    // a gait that fits is given back as it is; one that doesn't plays once fitted
    for (const g of PR.GAITS) expect([g.name, PR.fitGait(g, idle.rest) === g]).toEqual([g.name, true]);
    expect(PR.gaitClip(PR.fitGait({ ...PR.GAITS[2]!, speed: 600 }, idle.rest), idle.rest, { restSrc: idle.clip.restSrc }).dur).toBe(0.7);
    // and no faster than its feet may come forward past the hips (400% of the hip height a second, which gaitClip refuses
    // whatever the body): the limp asked to go at 300 on CMU_91's rest was fitted to 121, as fast as its legs take, and
    // refused there for its pace (403%), as on 8 other library rests asked 300 or 1,000 (round 14's review); the fastest
    // whole speed under the pace is 120, and it plays
    const cmu91 = load("CMU_CURATED/Limp_Loop"), limp = { ...PR.GAITS[3]!, speed: 300 };
    expect([PR.fitGait(limp, cmu91.rest), PR.fitGait({ ...limp, speed: 1000 }, cmu91.rest).speed]).toEqual([{ ...limp, speed: 120 }, 120]);
    expect(() => PR.gaitClip({ ...limp, speed: 121 }, cmu91.rest, { restSrc: cmu91.clip.restSrc })).toThrow(/^gait limp: its right foot comes forward past the hips at 403% of the hip height a second, over 400: .*; use a speed of at most 120 \(fitGait slows it so\), a shorter stance or a lighter limp$/);
    expect(PR.gaitClip(PR.fitGait(limp, cmu91.rest), cmu91.rest, { restSrc: cmu91.clip.restSrc }).dur).toBe(1.3);
    // slower still where a leg would fold shut at the reach bound (a stance of 0.2 lifting 35 and bouncing 6: 582 and 474
    // there, the knees popping at 22 to 26 m/s; the verifier's round 8)
    const run = { ...PR.GAITS[0]!, speed: 1000, stance: 0.2, lift: 35, bounce: 6 };
    expect([PR.fitGait({ ...run, cycle: 0.65 }, idle.rest).speed, PR.fitGait({ ...run, cycle: 0.75 }, style.rest).speed]).toEqual([500, 396]);
    // and limping, slower again: the pelvis drops over the weak leg while the strong foot swings (uncounted, 456)
    expect(PR.fitGait({ ...run, cycle: 0.65, limp: 1 }, idle.rest).speed).toBe(438);
    // and where a knee turns round on the loop's seam: its share of the sensors' level rises and falls with the speed (as
    // the knee turns round between two keys of a grid, or doesn't), so from the fastest the legs take each whole speed
    // down is tried. CMU_23's run at 0.6 s plays at 297, 298, 300, 302, 344 to 351, 355 and 357 of 290 to 360 (round 12;
    // round 11's model, which left out the legs' rounding, read 343 to 355 but 353): halving found 259 (round 11). Each
    // refusal names the fastest whole speed under its own that plays, and it does; one between (353) is refused too
    const cmu23 = sourceRest("CMU_CURATED", "CMU_23"), seam = { ...PR.GAITS[0]!, cycle: 0.6, stance: 0.386, lift: 9, bounce: 0.967, dip: 10.154, sway: 0.318, lean: 25, swing: 5.565, speed: 1000 };
    expect(PR.fitGait(seam, cmu23)).toEqual({ ...seam, speed: 357 });
    for (const [speed, plays] of [[320, 302], [353, 351], [356, 355], [358, 357]]) {
      expect(() => PR.gaitClip({ ...seam, speed }, cmu23, { restSrc: "CMU_23" })).toThrow(new RegExp(`its left (knee|foot) turns round on the loop's seam .* it plays at ${plays}% of the hip height a second`));
      expect(PR.gaitClip({ ...seam, speed: plays }, cmu23, { restSrc: "CMU_23" }).dur).toBe(0.6);
    }
    // a gait whose own numbers gaitClip refuses is given back as it is, refused by its field (fitted, each read as speed 0
    // and was refused for that: the verifier's round 8)
    const walk = PR.GAITS[0]!;
    for (const [g, why] of [[{ ...walk, cycle: NaN }, /cycle NaN is not 0.3 to 3 s/], [{ ...walk, stance: NaN }, /stance NaN is not/], [{ ...walk, limp: NaN }, /limp NaN is not/], [{ ...walk, speed: NaN }, /speed NaN is not/], [{ ...walk, speed: undefined as never }, /speed undefined is not/], [{ ...walk, speed: Infinity }, /speed Infinity is not/]] as const) {
      expect(PR.fitGait(g, idle.rest)).toBe(g);
      expect(() => PR.gaitClip(PR.fitGait(g, idle.rest), idle.rest, { restSrc: idle.clip.restSrc })).toThrow(why);
    }
  });
  it("reads its loop's seam on the very keys the clip holds there, kept as keys at any budget it takes", () => {
    // round 11's model read the seam from where each foot and hand was aimed, before the format's rounding (a leg's
    // direction held in hundredths, its bend and twist in whole degrees, the pelvis re-rounded on its grid), and read up to
    // 0.42 of the fail level under what the sensors then read (round 11's review): it now makes the keys about the seam as
    // gaitClip does (each knee carried from the start and closed over the cycle, each leg snapped, a planted foot to where
    // it landed) and reads those; the clip keeps them as keys whatever its budget (round 12 held them at 30 mm; a gait
    // takes 0 to 2 since round 14, and at 2 the limp at 60 frames a second drops a frame on Mesh2Motion's rest)
    const idle = load("MESH2MOTION/Idle_A"), [walk, , run, limp] = PR.GAITS, cmu144 = sourceRest("CMU_CURATED", "CMU_144");
    const run144 = { ...walk!, cycle: 0.6, stance: 0.402, limp: 0, lift: 11.002, bounce: 5.603, dip: 8.861, sway: 0.91, lean: -2.158, swing: 12.87, speed: 368 };
    for (const [rest, g, fps, budget] of [[idle.rest, walk, 55, 2], [idle.rest, walk, 75, 2], [idle.rest, run, 60, 2], [idle.rest, limp, 65, 2], [idle.rest, limp, 60, 2], [cmu144, run144, 72.5, 0]] as const) {
      const S = points(rest, PR.standingOn(rest)), c = PR.gaitClip(g!, rest, { restSrc: "x", fps, budget }), nf = 2 * Math.round((c.dur * fps) / 2);
      const times = Array.from({ length: nf }, (_, i) => Math.round((i * c.dur * 1000) / nf) / 1000), { head, tail } = legsOf(g!, rest, S, PR.standingOn(rest)).seam.keys(nf);
      [0, 1, 2, 3, nf - 3, nf - 2, nf - 1, nf].forEach((i, k) => {
        const t = i < nf ? times[i]! : c.dur, held = c.keys.find((x) => x.t === t) as unknown as Record<string, number[]> | undefined, model = (k < 4 ? head[k] : tail[k - 4]) as Record<string, number[]>;
        // (each arm's twist aside: its elbow is carried from frame to frame, which moves no fist)
        const fields = (key: Record<string, number[]> | undefined) => Object.keys(model).map((f) => [f, key?.[f]?.slice(0, f.startsWith("arm") ? 4 : 5)]);
        expect([g!.name, fps, t, fields(held)]).toEqual([g!.name, fps, t, fields(model)]);
      });
    }
  }, 30_000);
  it("lowers the pelvis for a leg to reach its stride's far end and the lift-off's travel on the floor, still bent", () => {
    // at the reach bound (71.5 to 72% of a leg ahead and behind, half a stride and the ground's travel as the foot lifts
    // off), with no bounce: a leg reaching that far with its foot on the floor would be at most 98.5% of itself, so the
    // hips stand no higher above the standing ankle than √(0.985² − 0.715²) of a leg, and half a % of H0 for the grid
    // (long stances, where the phase loop alone would let them stand a % of a leg higher: the verifier's round 7, N13)
    for (const id of ["MESH2MOTION/Idle_A", "STYLE100/Neutral_Walk", "CMU_CURATED/Walk_Loop"]) {
      const { clip, rest } = load(id), S = points(rest, PR.standingOn(rest)), b = PR.bodyOf(rest, S), leg = b.legUpper + b.legLower;
      for (const stance of [0.6, 0.65, 0.7]) {
        const g = PR.fitGait({ name: "g", about: "a gait", cycle: 1.4, stance, bounce: 0, speed: 1000 }, rest), c = PR.gaitClip(g, rest, { restSrc: clip.restSrc });
        const high = Math.max(...c.keys.map((k) => ((X) => Math.max(at(X, "hipL")[2], at(X, "hipR")[2]))(points(rest, k)) - at(S, "ankleR")[2])) / leg;
        expect([id, stance, high <= Math.sqrt(0.985 ** 2 - 0.715 ** 2) + rest.H0 / 200 / leg]).toEqual([id, stance, true]);
      }
    }
  }, 30_000);
  it("lowers the pelvis for every leg as the clip will hold it: none past 98.5% with the pelvis rounded the worst way, none folded under 25% and no knee under the floor the other way", () => {
    // the loop counts the pelvis swaying and put on the format's grid (whole % of the hip height: up to half a % higher,
    // further along and further across than drawn); a test of the written clips saw a leg past 98.5% only with the
    // vertical rounding left out (98.63%), and never with the sway or the across left out (98.48%), since a clip seldom
    // rounds all three the worst way at once (the verifier's round 8): so the model's legs are held to it directly, from
    // the foot's path and the pelvis's dip, at fitGait's speed, bouncing 6 and swaying 0 to 4; and its knee, as ik3
    // places it from the hip and ankle turned the lowest way it can be, the pelvis half a % lower and half a % either way
    // along and across (round 9: leaving out the sway or the limp's drop moved no fitted speed on the three rests)
    const kneeLow = (hz: number, [dx, dy, dz]: number[], L1: number, L2: number) => {
      const far = Math.hypot(dx!, dy!, dz!), [nx, ny, nz] = [dx! / far, dy! / far, dz! / far], dist = Math.min(L1 + L2 - 0.01, Math.max(Math.abs(L1 - L2), far));
      const x = (L1 ** 2 - L2 ** 2 + dist ** 2) / (2 * dist), y = Math.sqrt(Math.max(0, L1 ** 2 - x ** 2));
      // (straight down from the line where that points forward, a trailing leg's knee; across, a leading leg's)
      return hz + nz * x - (nx * nz >= 0 ? Math.hypot(nx, ny) : Math.abs(ny) / Math.hypot(ny, nz)) * y;
    };
    for (const id of ["MESH2MOTION/Idle_A", "STYLE100/Neutral_Walk", "CMU_CURATED/Walk_Loop"]) {
      const { rest } = load(id), S = points(rest, PR.standingOn(rest)), pct = rest.H0 / 100, b = PR.bodyOf(rest, S);
      for (const [cycle, stance, lift, sway, limp] of [[1.2, 0.6, 12, 2, 0], [1.2, 0.6, 12, 4, 0], [0.52, 0.5, 12, 4, 0], [0.7, 0.35, 25, 4, 0], [0.65, 0.2, 35, 0, 0], [0.65, 0.2, 35, 0, 1], [0.6, 0.2, 9, 4, 0], [0.6, 0.2, 9, 4, 1]] as const) {
        const g = PR.fitGait({ name: "g", about: "a gait", cycle, stance, lift, bounce: 6, sway, limp, speed: 1000 }, rest), L = legsOf(g, rest, S);
        let most = 0, least = Infinity, knee = Infinity;
        for (let k = 0; k < 240; k++) {
          const phase = k / 240, raise = -6 * pct * Math.cos(4 * Math.PI * (phase - 0.08)), across = sway * pct * Math.cos(2 * Math.PI * (phase - stance / 2));
          // (a limp drops the pelvis over the weak left leg while it stands)
          const vL = (phase + 1 - L.landL) % 1, drop = vL < L.stanceOf.L ? -4 * limp * pct * Math.sin((Math.PI * vL) / L.stanceOf.L) : 0;
          for (const [s, off] of [["R", 0], ["L", 1 - L.landL]] as const) {
            // (lifting off to 9% of the hip height, setting down from 4.5%)
            const [fwd, up] = PR.footAt((phase + off) % 1, L.stanceOf[s], L.strideOf[s], L.lift, 9 * pct, L.upOf[s], 4.5 * pct, L.offOf[s]), hip = at(S, `hip${s}`), ankle = at(S, `ankle${s}`);
            const d = [Math.abs(ankle[0] + fwd - hip[0]), Math.abs(ankle[1] - hip[1] - across), hip[2] - L.dip + raise + drop - ankle[2] - up];
            most = Math.max(most, Math.hypot(...d.map((x) => x + pct / 2)) / L.leg);
            least = Math.min(least, Math.hypot(...d.map((x) => Math.max(0, Math.abs(x) - pct / 2))) / L.leg);
            const hz = hip[2] - L.dip + raise + drop - pct / 2;
            for (const ex of [-1, 0, 1]) for (const ey of [-1, 1]) knee = Math.min(knee, kneeLow(hz, [ankle[0] + fwd - hip[0] + (ex * pct) / 2, ankle[1] - hip[1] - across + (ey * pct) / 2, ankle[2] + up - hz], b.legUpper, b.legLower));
          }
        }
        expect([id, g, most <= 0.985 + 1e-9, least >= 0.25 - 1e-9, L.knee >= 0, Math.abs(L.knee - knee) < 1e-6]).toEqual([id, g, true, true, true, true]);
      }
    }
  });
  it("counts each knee no lower than the clip draws it: none under the floor once fitted", () => {
    // legsOf's knee is the lowest it can be over the floor as ik3 places it from the hip and the ankle, turned about the
    // leg the lowest way it can be, the pelvis rounded down (round 9: 0.04 to 6.6% of the hip height under the clip's
    // lowest knee wherever that was near the floor, on 4,194 of 47,864 clips): at fitGait's speed for the
    // knee-into-the-floor gait above, the clip's knees all stand over it, and it over the floor
    const { clip, rest } = load("CMU_CURATED/Walk_Loop"), S = points(rest, PR.standingOn(rest));
    const g = PR.fitGait({ name: "g", about: "a gait", cycle: 0.6, stance: 0.2, lift: 9, bounce: 6, dip: 6, sway: 4, speed: 1000 }, rest), L = legsOf(g, rest, S);
    const lowest = Math.min(...PR.gaitClip(g, rest, { restSrc: clip.restSrc }).keys.flatMap((k) => ((X) => [at(X, "kneeL")[2], at(X, "kneeR")[2]])(points(rest, k))));
    expect([g.speed, L.knee >= 0, lowest >= L.knee]).toEqual([558, true, true]);
  });
  it("puts the pelvis on the grid without a step of two beside still ones, at most 0.75% of the hip height from where it is drawn", () => {
    // a bob moving about a % a frame rounds 92.62, 91.39, 90.59 to 93, 91, 91 here: the clip's first step, read against
    // the one after it, a step of two beside a still one (by parts, on the test characters' short pelvis-to-spine, such
    // steps popped the spine at up to 136% of the fail level: D71, round 9); the second frame is taken a % up instead
    // (0.68 s since round 14; round 9's 0.55 s, 93.25, 91.49 and 90.54, swings 0.275 s, refused now)
    const { clip, rest } = load("MESH2MOTION/Idle_A"), S = points(rest, PR.standingOn(rest)), pct = rest.H0 / 100;
    /** Each key's pelvis height and how far it is from where the gait draws it (% of the hip height), at 55 a second. */
    const pelvis = (g: PR.Gait) => {
      const L = legsOf(g, rest, S), c = PR.gaitClip(g, rest, { restSrc: clip.restSrc, fps: 55 }), hips = c.keys.map((k) => (k as unknown as { hips: number[] }).hips);
      const drop = (ph: number, vL = (ph + 1 - L.landL) % 1) => (vL < L.stanceOf.L ? -4 * (g.limp ?? 0) * pct * Math.sin((Math.PI * vL) / L.stanceOf.L) : 0);
      return { hips, off: c.keys.map((k, i) => hips[i]![2]! - (at(S, "pelvis")[2] - L.dip - g.bounce! * pct * Math.cos(4 * Math.PI * (k.t / c.dur - 0.08)) + drop(k.t / c.dur)) / pct) };
    };
    const { hips, off } = pelvis({ name: "g", about: "a gait", speed: 150, cycle: 0.68, stance: 0.5, bounce: 5, dip: 2, sway: 0 });
    const step = (i: number) => Math.hypot(...hips[i + 1]!.map((v, j) => v - hips[i]![j]!)), n = hips.length - 1;
    const lone = Array.from({ length: n }, (_, i) => i).filter((i) => Math.abs(hips[i + 1]![2]! - hips[i]![2]!) >= 2 && step(i) > 2.5 * Math.max(i > 0 ? step(i - 1) : 0, i < n - 1 ? step(i + 1) : 0));
    expect([lone, Math.max(...off.map(Math.abs)) <= 0.75, off.some((x) => Math.abs(x) > 0.5)]).toEqual([[], true, true]);
    // and no further: this limp's step of two would take a frame 0.753% from its place, so it stays
    expect(Math.max(...pelvis({ name: "g", about: "a gait", speed: 386, cycle: 0.7, stance: 0.25, lift: 35, bounce: 4.5, dip: 6, sway: 4, limp: 1 }).off.map(Math.abs))).toBeLessThanOrEqual(0.5);
  });
  it("offers the presets D71 measured", () => {
    expect(PR.GAITS.map((g) => [g.name, g.speed, g.cycle, g.stance, g.lift ?? 12, g.limp ?? 0])).toEqual([["walk", 130, 1.1, 0.6, 12, 0], ["brisk", 170, 1, 0.58, 12, 0], ["run", 350, 0.7, 0.35, 25, 0], ["limp", 90, 1.3, 0.62, 12, 0.8]]);
  });
  it("weighs each leg it rounds by the ankle the decoder places, to the bit: straight past its reach, folded, any twist", () => {
    // snapLegs scores 81 candidates a leg by their ankles (ankleOf), not a whole decode each (85% of a gait's time
    // before); the clips are the same only while the two agree exactly, so they are held to it on library keys with
    // leg numbers across their ranges (a seeded draw), a leg pointing nowhere, and the ends ik3 keeps (bend 0, 180)
    let seed = 7;
    const draw = (lo: number, hi: number) => lo + Math.round(((seed = (seed * 48271) % 2147483647) / 2147483647) * (hi - lo));
    const X = new Float32Array(P * 3);
    let n = 0;
    for (const id of ["MESH2MOTION/Idle_A", "STYLE100/Neutral_Walk", "CMU_CURATED/Walk_Loop"]) {
      const { clip, rest } = load(id);
      for (const k of clip.keys) {
        const tq = torso(rest, k as KeyLike);
        for (const leg of [[0, 0, -100, 0, 0], [0, 0, -100, 180, 40], [0, 0, 0, 30, 0], ...Array.from({ length: 12 }, () => [draw(-100, 100), draw(-100, 100), draw(-100, 100), draw(0, 180), draw(-180, 180)])])
          for (const s of ["L", "R"] as const) {
            decodePose(rest, { ...k, [`leg${s}`]: leg } as KeyLike, X);
            expect([id, k.t, s, leg, ankleOf(rest, tq.hip(s), tq.RP, leg, s)]).toEqual([id, k.t, s, leg, at(X, `ankle${s}`)]);
            n++;
          }
      }
    }
    expect(n).toBeGreaterThan(1000);
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
    // named and described, or refused by the field before it is made (as a gait is)
    expect(() => PR.idleClip({ ...PR.IDLES[0]!, name: undefined as never }, src.rest, { restSrc: src.clip.restSrc })).toThrow(/^idle: its name is missing: give it a name/);
    expect(() => PR.idleClip({ ...PR.IDLES[0]!, about: "" }, src.rest, { restSrc: src.clip.restSrc })).toThrow(/^idle breathe: its about is ""/);
  }, 30_000);
});

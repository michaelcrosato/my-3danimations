// The bit-identity A/B harness (on demand, not in any tier): hashes every number's 64-bit pattern from decode,
// encode, facts, contactRoot, planting, the sensors, fix, procedural moves, the Animator, graphs and the solver over
// the whole library. Run it on two checkouts and compare: `node tools/exact/ab.mjs <root> [parts...]` prints JSON
// {part: {hash, n, ms}}; <root> holds packages/core, packages/sensors and their tests, and its library/ and spec/ are
// read. Kept from the 2026-10-16 audit of the t1-speed lane (docs/HANDOFF.md, D97): 1bf5252 and 4080135 gave the
// same 11 hashes. A full run takes about 2.5 min.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2];
const want = new Set(process.argv.slice(3));
const core = await import(join(ROOT, "packages/core/src/index.ts"));
const sensors = await import(join(ROOT, "packages/sensors/src/index.ts"));
const { format, clip: clipNs, contact, procedural: PR } = core;
const poseMod = await import(join(ROOT, "packages/core/src/format/pose.ts"));

// ---- canonical hashing (numbers by their 64-bit pattern: -0, NaN and every bit count) ----
function feed(h, v) {
  const t = typeof v;
  if (v === null) return h.update("N");
  if (v === undefined) return h.update("U");
  if (t === "number") {
    const b = Buffer.alloc(9);
    b.write("n", 0);
    b.writeDoubleLE(v, 1);
    return h.update(b);
  }
  if (t === "string") return h.update("s" + v.length + ":" + v);
  if (t === "boolean") return h.update(v ? "T" : "F");
  if (t === "function") return h.update("f");
  if (ArrayBuffer.isView(v)) {
    h.update("t" + v.constructor.name + v.length + ":");
    return h.update(Buffer.from(v.buffer, v.byteOffset, v.byteLength));
  }
  if (Array.isArray(v)) {
    h.update("[" + v.length);
    for (const x of v) feed(h, x);
    return h.update("]");
  }
  if (v instanceof Map) {
    h.update("M" + v.size);
    for (const [k, x] of v) {
      feed(h, k);
      feed(h, x);
    }
    return;
  }
  if (t === "object") {
    const ks = Object.keys(v);
    h.update("{" + ks.length);
    for (const k of ks) {
      h.update("k" + k);
      feed(h, v[k]);
    }
    return h.update("}");
  }
  h.update("?" + String(v));
}

const LIB = join(ROOT, "library/sets");
function library() {
  const out = [];
  for (const set of readdirSync(LIB).sort()) {
    const manifest = JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8"));
    for (const f of readdirSync(join(LIB, set)).filter((x) => !x.startsWith("_") && x.endsWith(".json")).sort()) {
      const clip = core.parseClip(readFileSync(join(LIB, set, f), "utf8"));
      out.push({ id: `${set}/${f.replace(/\.json$/, "")}`, clip, R: manifest.sources[clip.restSrc].rest });
    }
  }
  return out;
}
const lib = library();
const byId = (id) => lib.find((c) => c.id === id);
const bodies = JSON.parse(readFileSync(join(ROOT, "spec/vectors/tier3/bodies.json"), "utf8")).bodies;
const otherRests = Object.values(bodies).map((b) => b.rest);
const noShoulders = (R) => ({ ...R, cv: { L: [0, 0, 0], R: [0, 0, 0] } });
const P3 = format.P * 3;
const times = (clip) => {
  const ts = [];
  const K = clip.keys;
  for (let i = 0; i < K.length; i++) {
    ts.push(K[i].t);
    if (i + 1 < K.length) for (const u of [0.25, 0.5, 0.75]) ts.push(K[i].t + (K[i + 1].t - K[i].t) * u);
  }
  ts.push(clip.dur, clip.dur * 0.999, clip.loop ? clip.dur * 1.37 : clip.dur + 0.1, -0.05);
  return ts;
};
const tryv = (f) => {
  try {
    return f();
  } catch (e) {
    return "ERR " + String(e && e.message);
  }
};
/** contact-data's motionOf: decoded on its rest (cached by time), its root the one its planted feet imply. */
function motionOf(clip, R, contacts) {
  const cr = contact.contactRoot(clip, R, contacts), memo = new Map();
  return {
    rest: R, dur: clip.dur, loop: clip.loop, contacts, key: (t) => format.keyAt(clip, t), root: cr.root, speed: cr.speed,
    points: (t) => {
      let X = memo.get(t);
      if (!X) memo.set(t, (X = Float64Array.from(format.decodePose(R, format.keyAt(clip, t), new Array(108)))));
      return X;
    },
  };
}

const parts = {
  decode(h) {
    let n = 0;
    for (const { clip, R } of lib) {
      for (const t of times(clip)) {
        feed(h, format.pose(R, clip, t, new Float32Array(P3)));
        n++;
      }
      const s = clipNs.sampleAll(clip, R, 60);
      feed(h, s.dt);
      for (const f of s.frames) feed(h, f);
      n += s.frames.length;
    }
    return n;
  },
  decodeOther(h) {
    let n = 0;
    lib.forEach(({ clip, R }, i) => {
      if (i % 4) return;
      for (const RR of [...otherRests, noShoulders(R), noShoulders(otherRests[i % otherRests.length])]) {
        for (const t of times(clip)) {
          feed(h, format.decodePose(RR, format.keyAt(clip, t), new Float32Array(P3)));
          feed(h, format.decodePose(RR, format.keyAt(clip, t), new Array(108)));
          n++;
        }
      }
    });
    return n;
  },
  encode(h) {
    let n = 0;
    lib.forEach(({ clip, R }, i) => {
      if (i % 3) return;
      for (const [o, opts] of [{}, { hands: true }, { spine: true }, { steadyTwist: true }, { round: false }, { hands: true, spine: true, steadyTwist: true }].entries()) {
        let prev = null;
        for (let t = 0; t <= clip.dur + 1e-9; t += 1 / 30) {
          const X = format.pose(R, clip, t, new Float32Array(P3));
          const k = tryv(() => format.encodePose(R, X, prev, opts));
          feed(h, k);
          if (typeof k === "object") prev = k;
          n++;
        }
        if (o === 0) for (const t of times(clip)) feed(h, tryv(() => poseMod.limbPoles(R, format.keyAt(clip, t))));
      }
      // encode on another body and on one without shoulders
      for (const RR of [otherRests[i % otherRests.length], noShoulders(R)]) {
        let prev = null;
        for (let t = 0; t <= clip.dur + 1e-9; t += 1 / 15) {
          const X = format.decodePose(RR, format.keyAt(clip, t), new Float32Array(P3));
          const k = tryv(() => format.encodePose(RR, X, prev, { hands: true }));
          feed(h, k);
          if (typeof k === "object") prev = k;
          n++;
        }
      }
    });
    return n;
  },
  limbPoles(h) {
    let n = 0, bad = 0;
    lib.forEach(({ clip, R }, i) => {
      if (i % 2) return;
      for (const RR of [R, otherRests[i % otherRests.length], noShoulders(R)]) for (const t of times(clip)) {
        const k = format.keyAt(clip, t), lp = poseMod.limbPoles(RR, k);
        feed(h, lp);
        if (poseMod.legPoleOf) for (const s of ["L", "R"]) {
          const a = poseMod.legPoleOf(RR, k, s), b = lp["leg" + s];
          if (!a.every((x, j) => Object.is(x, b[j]))) bad++;
          // and with a zeroed twist, as plant's legPole asks
          const leg = k["leg" + s], k2 = { ...k, ["leg" + s]: [leg[0], leg[1], leg[2], leg[3] ?? 0, 0] };
          const a2 = poseMod.legPoleOf(RR, k2, s), b2 = poseMod.limbPoles(RR, k2)["leg" + s];
          if (!a2.every((x, j) => Object.is(x, b2[j]))) bad++;
        }
        n++;
      }
    });
    if (poseMod.legPoleOf) process.stderr.write(`legPoleOf vs limbPoles mismatches: ${bad}\n`);
    // decodeLegs against decodePose on the points it writes
    if (poseMod.decodeLegs) {
      const I = format.IDX, names = ["pelvis", ...["hip", "knee", "ankle", "ball", "toe"].flatMap((p) => [p + "L", p + "R"])];
      let badL = 0, checked = 0;
      lib.forEach(({ clip, R }, i) => {
        if (i % 2) return;
        for (const RR of [R, otherRests[i % otherRests.length]]) for (const t of times(clip)) {
          const k = format.keyAt(clip, t), A = format.decodePose(RR, k, new Float32Array(P3)), B = poseMod.decodeLegs(RR, k, new Float32Array(P3));
          for (const nm of names) for (let j = 0; j < 3; j++) { checked++; if (!Object.is(A[I[nm] * 3 + j], B[I[nm] * 3 + j])) badL++; }
        }
      });
      process.stderr.write(`decodeLegs vs decodePose: ${badL} of ${checked} numbers differ\n`);
    }
    return n;
  },
  facts(h) {
    let n = 0;
    for (const { clip, R } of lib) {
      feed(h, tryv(() => core.measureFacts(clip, R)));
      feed(h, tryv(() => core.measureFacts(clip, R, { fps: 30 })));
      n++;
    }
    return n;
  },
  root(h) {
    let n = 0;
    lib.forEach(({ clip, R }) => {
      const contacts = core.measureFacts(clip, R).contacts;
      for (const fps of [60, 75]) {
        const cr = contact.contactRoot(clip, R, contacts, fps);
        feed(h, cr.speed);
        for (let t = -0.1; t <= 2 * clip.dur + 0.1; t += 1 / 30) feed(h, cr.root(t));
        n++;
      }
    });
    return n;
  },
  plant(h) {
    let n = 0, seen = 0;
    for (const { clip, R } of lib) {
      if (!clip.loop || !clip.tags.some((t) => t === "walk" || t === "run" || t === "sidestep")) continue;
      if (seen++ % 3 !== 0) continue;
      const m = motionOf(clip, R, core.measureFacts(clip, R).contacts);
      for (let t = 0; t < 2 * clip.dur; t += 1 / 30) {
        feed(h, contact.plant(m, t));
        n++;
      }
    }
    // on surfaces, without settling, with options
    const surfaces = [(f) => f * 0.17632698070846498, (f) => -f * 0.17632698070846498, (f) => (f > 800 ? 200 : 0), (f) => (f > 800 ? -200 : 0)];
    for (const id of ["QUATERNIUS_3D2DGE/Walk_Loop", "QUATERNIUS_3D2DGE/Jog_Fwd_Loop", "STYLE100/Neutral_Walk", "CMU_CURATED/Walk_Loop", "CMU_CURATED/Zombie_Walk_Loop", "STYLE100/BigSteps_Walk"]) {
      const c = byId(id);
      if (!c) continue;
      const m = motionOf(c.clip, c.R, core.measureFacts(c.clip, c.R).contacts);
      for (const ground of surfaces) for (let t = 0; t < 2 * c.clip.dur; t += 1 / 20) {
        feed(h, contact.plant(m, t, { ground }));
        n++;
      }
      for (let t = 0; t < 2 * c.clip.dur; t += 1 / 20) {
        feed(h, contact.plant(m, t, { settle: false }));
        feed(h, contact.plant(m, t, { blend: 0, settle: false }));
        feed(h, contact.plant(m, t, { blend: 0.1, release: 0.3, settleBlend: 0.4, settleSmooth: 0.2 }));
        n += 3;
      }
    }
    // hands
    const idle = byId("QUATERNIUS_3D2DGE/Idle_Loop");
    const mi = motionOf(idle.clip, idle.R, core.measureFacts(idle.clip, idle.R).contacts);
    for (let t = 0; t < idle.clip.dur; t += 1 / 10) {
      const free = mi.points(t), I = format.IDX;
      for (const s of ["L", "R"]) {
        const i = I["sh" + s] * 3, sh = [free[i], free[i + 1], free[i + 2]];
        for (const [dx, w] of [[350, 1], [350, 0.5], [3000, 1], [200, 0.25]]) {
          const world = contact.toWorld(mi.root(t), [sh[0] + dx, sh[1] + 100, sh[2] - 150]);
          feed(h, contact.plant(mi, t, { hands: { [s]: { at: world, weight: w } } }));
          n++;
        }
      }
    }
    // a mix
    const A = byId("QUATERNIUS_3D2DGE/Walk_Loop"), B = byId("QUATERNIUS_3D2DGE/Jog_Fwd_Loop");
    const ma = motionOf(A.clip, A.R, core.measureFacts(A.clip, A.R).contacts), mb = motionOf(B.clip, A.R, core.measureFacts(B.clip, A.R).contacts);
    for (let t = 0; t < 1.5; t += 1 / 30) {
      const k = format.keyAt(A.clip, t), X = format.decodePose(A.R, k, new Array(108));
      feed(h, contact.plantMix([{ w: 0.6, t, m: ma }, { w: 0.4, t: t * 0.9, m: mb }], X, k, { forward: 10, right: -5, yaw: 12 }, { hands: { R: { at: [400, 200, 1100], weight: 0.7 } } }));
      n++;
    }
    return n;
  },
  sensors(h) {
    let n = 0;
    lib.forEach(({ clip, R }, i) => {
      if (i % 25) return;
      feed(h, tryv(() => sensors.metrics(clip, R)));
      feed(h, tryv(() => sensors.describe(clip, R)));
      feed(h, tryv(() => sensors.lint(clip, R)));
      const m = sensors.checks.motionOf(clip, R);
      feed(h, m.frames);
      feed(h, m.contacts);
      feed(h, m.root);
      n++;
    });
    return n;
  },
  fix(h) {
    let n = 0;
    lib.forEach(({ clip, R }, i) => {
      if (i % 40) return;
      feed(h, tryv(() => sensors.fix(clip, R)));
      feed(h, tryv(() => sensors.fix(clip, R, { ops: [...sensors.fixes.FIXES] })));
      n++;
    });
    // the foot-lock operator on clips that slide
    for (const id of ["STYLE100/Neutral_Walk", "CMU_CURATED/Walk_Loop", "QUATERNIUS_SHARDFALL/Death01", "MESH2MOTION/Idle_A"]) {
      const c = byId(id);
      if (!c) continue;
      feed(h, tryv(() => sensors.fix(c.clip, c.R, { ops: ["footLocks"] })));
      feed(h, tryv(() => sensors.fix(c.clip, c.R, { ops: [...sensors.fixes.FIXES] })));
      n++;
    }
    return n;
  },
  procedural(h) {
    let n = 0;
    const MOVES = JSON.parse(readFileSync(join(ROOT, "library/moves.json"), "utf8"));
    const idle = byId("MESH2MOTION/Idle_A");
    const rests = [idle.R, byId("QUATERNIUS_3D2DGE/Walk_Loop").R, byId("STYLE100/Neutral_Walk").R, byId("CMU_CURATED/Walk_Loop").R, ...otherRests];
    rests.forEach((R, ri) => {
      for (const g of PR.GAITS) {
        const f = tryv(() => PR.fitGait(g, R));
        feed(h, f);
        feed(h, tryv(() => core.serialize(PR.gaitClip(typeof f === "object" ? f : g, R, { restSrc: "X" + ri }))));
        feed(h, tryv(() => core.serialize(PR.gaitClip(g, R, { restSrc: "X" + ri }))));
        n++;
      }
      if (ri < 6) for (const m of MOVES.moves) {
        feed(h, tryv(() => core.serialize(PR.moveClip(m, R, { restSrc: "X" + ri }))));
        n++;
      }
      for (const i of PR.IDLES) {
        feed(h, tryv(() => core.serialize(PR.idleClip(i, R, { restSrc: "X" + ri }))));
        n++;
      }
    });
    return n;
  },
  async animator(h) {
    const { scriptData } = await import(join(ROOT, "packages/core/test/animator-data.ts"));
    const { runScript } = await import(join(ROOT, "packages/core/test/animator-script.ts"));
    const data = scriptData();
    for (const poses of [undefined, "every", "lod"]) feed(h, runScript(core, data, poses ? { poses } : {}));
    const { graphData } = await import(join(ROOT, "packages/core/test/graph-data.ts"));
    const { runGraph } = await import(join(ROOT, "packages/core/test/graph-script.ts"));
    const g = graphData();
    feed(h, runGraph(core, g, "locomotion", { poses: "every" }));
    feed(h, runGraph(core, g, "combo", { restoreAt: 300 }));
    feed(h, runGraph(core, g, "locomotion"));
    // an Animator on library clips with ground and hands, posed every step, saved and restored
    const rig = core.bind(data.skeleton);
    const walk = byId("QUATERNIUS_3D2DGE/Walk_Loop"), jog = byId("QUATERNIUS_3D2DGE/Jog_Fwd_Loop");
    const wc = { ...walk.clip, contacts: core.measureFacts(walk.clip, walk.R).contacts }, jc = { ...jog.clip, contacts: core.measureFacts(jog.clip, jog.R).contacts };
    const a = new core.Animator(rig, { ground: (f) => f * 0.1 }).layer("b", { clip: core.playable(wc, walk.R) });
    for (let i = 0; i < 300; i++) {
      if (i === 60) a.layer("j", { clip: core.playable(jc, jog.R), weight: 0.5 });
      a.step(1 / 60);
      feed(h, a.pose().points);
      feed(h, a.pose(undefined, { hands: { R: { at: [500, 200, 1000], weight: 0.6 } } }).points);
      feed(h, a.hash());
    }
    return 7;
  },
  solve(h) {
    let n = 0;
    lib.forEach(({ clip }, i) => {
      if (i % 10) return;
      for (const t of times(clip).slice(0, 12)) {
        const k = format.keyAt(clip, t);
        feed(h, tryv(() => core.solve(k, core.bind(rigSkel()))));
        n++;
      }
    });
    return n;
  },
};
let skel;
async function loadSkel() {
  const { rigSkeleton } = await import(join(ROOT, "spec/conformance/runner/skeleton.ts"));
  skel = rigSkeleton();
}
const rigSkel = () => skel;
await loadSkel();

const out = {};
for (const [name, f] of Object.entries(parts)) {
  if (want.size && !want.has(name)) continue;
  const h = createHash("sha256"), t0 = performance.now();
  const n = await f(h);
  out[name] = { hash: h.digest("hex").slice(0, 16), n, ms: Math.round(performance.now() - t0) };
  process.stderr.write(`${name}: ${JSON.stringify(out[name])}\n`);
}
console.log(JSON.stringify(out));

// The metrics (PLAN.md WP-3.3; carried from my-3d2dge's tools/mocap-test.mjs and its pop rule, and riftlight's
// analyzeClip): each reads a sampled motion and returns its worst value and its findings, each with its times. A
// finding's level comes from the thresholds; its message says what is wrong and how to repair it.
import { format, math, ops } from "@m3a/core";
import { capsules } from "../raster/mannequin.ts";
import { at, sole, world, type Motion } from "./motion.ts";
import { REFERENCE_H0, THRESHOLDS, type MetricName } from "./thresholds.ts";

const { PORTABLE } = math;

/** One thing a metric found: where, when, how bad, and what to do. */
export interface Finding {
  metric: MetricName;
  level: "warn" | "fail";
  t0: number;
  t1: number;
  value: number;
  unit: string;
  /** The body part or end (`footL`, `forearmR`, `legL`), when it is one. */
  where?: string;
  message: string;
}
/** A metric's result: its worst value over the clip and its findings. */
export interface Measured {
  value: number;
  findings: Finding[];
}

/** A threshold's level on this body (scaled by hip height when the metric is a length). */
export function levels(m: Motion, name: MetricName): { warn: number; fail: number } {
  const t = THRESHOLDS[name], k = t.scales ? m.rest.H0 / REFERENCE_H0 : 1;
  return { warn: t.warn * k, fail: t.fail * k };
}
const fmt = (x: number, d = 0) => x.toFixed(d);
const span = (a: number, b: number) => (Math.abs(b - a) < 1e-9 ? `${fmt(a, 2)} s` : `${fmt(a, 2)}–${fmt(b, 2)} s`);
/** A finding if `value` reaches its warn level. */
function finding(m: Motion, name: MetricName, value: number, t0: number, t1: number, where: string | undefined, what: string, fix: string): Finding | null {
  const L = levels(m, name);
  if (!(value >= L.warn)) return null;
  const level = value >= L.fail ? "fail" : "warn";
  return { metric: name, level, t0, t1, value, unit: THRESHOLDS[name].unit, ...(where ? { where } : {}), message: `${where ? where + " " : ""}${span(t0, t1)}: ${what} (${level} at ${fmt(level === "fail" ? L.fail : L.warn, L.fail < 10 ? 2 : 0)}): ${fix}` };
}
/** Runs of samples whose value reaches `min`, each with its worst sample. */
function runs(values: readonly number[], times: readonly number[], min: number): { t0: number; t1: number; worst: number; at: number }[] {
  const out: { t0: number; t1: number; worst: number; at: number }[] = [];
  let cur: (typeof out)[number] | null = null;
  values.forEach((v, i) => {
    if (v >= min) {
      if (!cur) out.push((cur = { t0: times[i]!, t1: times[i]!, worst: v, at: times[i]! }));
      cur.t1 = times[i]!;
      if (v > cur.worst) [cur.worst, cur.at] = [v, times[i]!];
    } else cur = null;
  });
  return out;
}
const keep = (xs: (Finding | null)[]): Finding[] => xs.filter((x): x is Finding => x !== null);

/** Foot sliding: each contact's path of the contact point (its lowest sole point at each step) in the world. */
export function slide(m: Motion): Measured & { skate: number } {
  const findings: (Finding | null)[] = [];
  let worst = 0, total = 0, time = 0;
  for (const s of ["L", "R"] as const) {
    for (const [a, b] of m.contacts[`foot${s}`] ?? []) {
      // a loop's contact past its end continues from its start
      const parts: [number, number][] = m.loop && b > m.dur ? [[a, m.dur], [0, b - m.dur]] : [[a, Math.min(b, m.dur)]];
      let path = 0, peak = 0;
      for (const [p, q] of parts) {
        const i0 = Math.ceil(p / m.dt - 1e-9), i1 = Math.floor(q / m.dt + 1e-9);
        for (let i = i0; i < i1 && i + 1 < m.frames.length; i++) {
          const pts = sole(m, m.frames[i]!, s), low = pts.reduce((x, y) => (y.p[2] < x.p[2] ? y : x));
          const next = sole(m, m.frames[i + 1]!, s).find((x) => x.name === low.name)!;
          const w0 = world(m, i, low.p), w1 = world(m, i + 1, next.p), d = PORTABLE.hypot(w1[0] - w0[0], w1[1] - w0[1]);
          path += d;
          peak = Math.max(peak, d / m.dt);
          time += m.dt;
        }
      }
      total += path;
      worst = Math.max(worst, path);
      findings.push(finding(m, "slide", path, a, Math.min(b, a + m.dur), "foot" + s, `the planted foot slides ${fmt(path)} mm (peak ${fmt(peak / 10)} cm/s)`, "hold it still while planted (fix: bake foot locks), or end the contact where it lifts"));
    }
  }
  return { value: worst, skate: time > 0 ? total / time / 10 : 0, findings: keep(findings) };
}

/** A sole under the floor, and other body parts under it. */
export function penetration(m: Motion): { soles: Measured; body: Measured } {
  const soleDepth = m.frames.map((X) => Math.max(0, ...(["L", "R"] as const).flatMap((s) => sole(m, X, s).map((p) => -p.p[2]))));
  const BODY = ["kneeL", "kneeR", "elbowL", "elbowR", "fistL", "fistR", "pelvis", "head", "headTop", "chest"];
  const bodyDepth = m.frames.map((X) => Math.max(0, ...BODY.map((n) => -at(X, n)[2])));
  const lowest = (X: Float32Array) => BODY.reduce((a, n) => (at(X, n)[2] < at(X, a)[2] ? n : a));
  const s = levels(m, "penetration"), b = levels(m, "bodyPenetration");
  return {
    soles: { value: Math.max(0, ...soleDepth), findings: keep(runs(soleDepth, m.times, s.warn).map((r) => finding(m, "penetration", r.worst, r.t0, r.t1, undefined, `a sole goes ${fmt(r.worst)} mm under the floor`, "lift the pose so the sole touches it (fix: lift penetration)"))) },
    body: { value: Math.max(0, ...bodyDepth), findings: keep(runs(bodyDepth, m.times, b.warn).map((r) => finding(m, "bodyPenetration", r.worst, r.t0, r.t1, lowest(m.frames[Math.round(r.at / m.dt)]!), `goes ${fmt(r.worst)} mm under the floor`, "raise the body, or tag the clip lying, sitting or acrobatic if it rests there"))) },
  };
}

/** The closest distance between segments ab and cd, and where along each (0 to 1). */
function segments(a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[]): { dist: number; s: number; t: number } {
  const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!], v = [d[0]! - c[0]!, d[1]! - c[1]!, d[2]! - c[2]!], w = [a[0]! - c[0]!, a[1]! - c[1]!, a[2]! - c[2]!];
  const dot = (x: number[], y: number[]) => x[0]! * y[0]! + x[1]! * y[1]! + x[2]! * y[2]!;
  const A = dot(u, u), B = dot(u, v), C = dot(v, v), D = dot(u, w), E = dot(v, w), den = A * C - B * B;
  let s = den > 1e-9 ? Math.min(1, Math.max(0, (B * E - C * D) / den)) : 0;
  let t = C > 1e-9 ? Math.min(1, Math.max(0, (B * s + E) / C)) : 0;
  s = A > 1e-9 ? Math.min(1, Math.max(0, (B * t - D) / A)) : 0;
  t = C > 1e-9 ? Math.min(1, Math.max(0, (B * s + E) / C)) : 0;
  const p = [a[0]! + u[0]! * s - c[0]! - v[0]! * t, a[1]! + u[1]! * s - c[1]! - v[1]! * t, a[2]! + u[2]! * s - c[2]! - v[2]! * t];
  return { dist: Math.sqrt(dot(p, p)), s, t };
}
/** The pairs of parts that shouldn't pass through each other: a forearm or hand and the torso; one lower leg and the other. */
const PAIRS: readonly [string, string][] = [
  ...["L", "R"].flatMap((s) => ["forearm" + s, "hand" + s].flatMap((a) => ["hips", "pelvis", "belly", "chest", "pecs"].map((b) => [a, b] as [string, string]))),
  ["shinL", "shinR"], ["footL", "footR"], ["shinL", "footR"], ["footL", "shinR"],
];
/** Self-intersection: how deep a part sits in another, as a share of the thinner one's width. */
export function intersection(m: Motion): Measured {
  const depth: number[] = [], where: string[] = [];
  for (const X of m.frames) {
    const parts = new Map(capsules(X).map((c) => [c.name, c]));
    let worst = 0, w = "";
    for (const [p, q] of PAIRS) {
      const A = parts.get(p)!, B = parts.get(q)!, d = segments(A.a, A.b, B.a, B.b);
      const ra = A.ra + (A.rb - A.ra) * d.s, rb = B.ra + (B.rb - B.ra) * d.t, inside = (ra + rb - d.dist) / (2 * Math.min(ra, rb));
      if (inside > worst) [worst, w] = [inside, `${p} in ${q}`];
    }
    depth.push(worst);
    where.push(w);
  }
  const L = levels(m, "intersection");
  return { value: Math.max(0, ...depth), findings: keep(runs(depth, m.times, L.warn).map((r) => finding(m, "intersection", r.worst, r.t0, r.t1, where[Math.round(r.at / m.dt)], `sits ${fmt(r.worst * 100)}% of its width inside`, "move the limb out of the body (an arm through the torso, a leg through the other)"))) };
}

/**
 * Jitter: noise, a point shaking back and forth sample after sample. Per point and sample, the back-and-forth is the
 * geometric mean of two consecutive accelerations of opposite sign (0 for a kink or a hard stop); jitter is its median
 * over 9 samples (0.15 s), so a single reversal, a pop or a snap reads 0 and only sustained shaking counts.
 */
export function jitter(m: Motion): Measured {
  const F = m.frames, n = F.length, P = format.P, per = new Array<number>(n).fill(0), point = new Array<string>(n).fill("");
  const osc = new Float64Array(n);
  for (let j = 0; j < P; j++) {
    osc.fill(0);
    for (let i = 1; i + 2 < n; i++) {
      let prod = 0;
      for (let c = 0; c < 3; c++) {
        const k = j * 3 + c, a0 = F[i + 1]![k]! - 2 * F[i]![k]! + F[i - 1]![k]!, a1 = F[i + 2]![k]! - 2 * F[i + 1]![k]! + F[i]![k]!;
        prod += a0 * a1;
      }
      osc[i] = prod < 0 ? Math.sqrt(-prod) : 0;
    }
    for (let i = 4; i + 4 < n; i++) {
      const w = Array.from(osc.subarray(i - 4, i + 5)).sort((a, b) => a - b), med = w[4]!;
      if (med > per[i]!) [per[i], point[i]] = [med, format.POINTS[j]!];
    }
  }
  const L = levels(m, "jitter");
  return { value: Math.max(0, ...per), findings: keep(runs(per, m.times, L.warn).map((r) => finding(m, "jitter", r.worst, r.t0, r.t1, point[Math.round(r.at / m.dt)], `shakes ${fmt(r.worst, 1)} mm back and forth, sample after sample`, "smooth it (fix: filter jitter)"))) };
}

/** Pops: a point's step far faster than the steps around it (my-3d2dge's rule), as its speed above theirs. */
export function pops(m: Motion): Measured {
  const F = m.frames, n = F.length, P = format.P, excess = new Array<number>(n).fill(0), point = new Array<string>(n).fill("");
  for (let j = 0; j < P; j++) {
    const speed = [0];
    for (let i = 1; i < n; i++) speed.push(PORTABLE.hypot(F[i]![j * 3]! - F[i - 1]![j * 3]!, F[i]![j * 3 + 1]! - F[i - 1]![j * 3 + 1]!, F[i]![j * 3 + 2]! - F[i - 1]![j * 3 + 2]!) / m.dt);
    for (let i = 1; i < n; i++) {
      // the median speed of the steps around it, leaving out the three either side (a pop's own way in and out)
      const around: number[] = [];
      for (let k = i - 10; k <= i + 10; k++) if (k >= 1 && k < n && Math.abs(k - i) > 3) around.push(speed[k]!);
      if (around.length < 4) continue;
      around.sort((a, b) => a - b);
      const base = around[around.length >> 1]!;
      if (speed[i]! > 4 * base && speed[i]! - base > excess[i]!) [excess[i], point[i]] = [speed[i]! - base, format.POINTS[j]!];
    }
  }
  const L = levels(m, "pop");
  return { value: Math.max(0, ...excess), findings: keep(runs(excess, m.times, L.warn).map((r) => finding(m, "pop", r.worst, r.t0, r.t1, point[Math.round(r.at / m.dt)], `jumps at ${fmt(r.worst / 1000, 1)} m/s above the steps around it`, "ease into the pose, or remove the key that jumps"))) };
}

/** Twist flips: a limb's twist, a hand's roll or a foot's heading jumping most of a half turn between close keys. */
export function twistFlips(m: Motion): Measured {
  const findings: (Finding | null)[] = [];
  let worst = 0;
  const K = (m.keys ?? []) as unknown as Record<string, unknown>[];
  const fields: [string, number, string][] = [["armL", 4, "twist"], ["armR", 4, "twist"], ["legL", 4, "twist"], ["legR", 4, "twist"], ["handL", 2, "roll"], ["handR", 2, "roll"], ["footL", 1, "heading"], ["footR", 1, "heading"]];
  for (let k = 0; k + 1 < K.length; k++) {
    const a = K[k]!, b = K[k + 1]!, dt = (b.t as number) - (a.t as number);
    if (!(dt > 0 && dt <= 0.1 + 1e-9)) continue;
    for (const [f, i, what] of fields) {
      const va = (a[f] as number[] | undefined)?.[i], vb = (b[f] as number[] | undefined)?.[i];
      if (va === undefined || vb === undefined) continue;
      const jump = Math.abs(vb - va);
      worst = Math.max(worst, jump);
      findings.push(finding(m, "twistFlip", jump, a.t as number, b.t as number, f, `its ${what} jumps ${fmt(jump)}° in ${fmt(dt * 1000)} ms`, "unwrap it against the keys either side (fix: repair twist flips)"));
    }
  }
  return { value: worst, findings: keep(findings) };
}

/**
 * Joint limits: a knee bending backwards (its twist past the limit while bent: the knee points back), the head turned
 * past the limit from the chest. Elbows aren't judged: a format-1 arm carries no hand frame, and its twist's reference
 * (the natural pole, carried from hanging down) isn't anatomical with the arm raised.
 */
export function jointLimits(m: Motion): Measured {
  const values: number[] = [], where: string[] = [], times: number[] = [];
  for (const key of (m.keys ?? []) as unknown as Record<string, unknown>[]) {
    let worst = 0, w = "";
    for (const f of ["legL", "legR"]) {
      const v = key[f] as number[] | undefined;
      if (!v || (v[3] ?? 0) < 20) continue;
      const tw = Math.abs(ops.wrap180(v[4] ?? 0));
      if (tw > worst) [worst, w] = [tw, `${f} (the knee bends back)`];
    }
    const head = key.head as number[] | undefined, turn = head ? Math.abs(ops.wrap180(head[0]!)) : 0;
    if (turn > worst) [worst, w] = [turn, "head (turned from the chest)"];
    values.push(worst);
    where.push(w);
    times.push(key.t as number);
  }
  const L = levels(m, "jointLimit");
  return { value: Math.max(0, ...values), findings: keep(runs(values, times, L.warn).map((r) => finding(m, "jointLimit", r.worst, r.t0, r.t1, where[times.indexOf(r.at)], `reaches ${fmt(r.worst)}°`, "turn the joint back within its range"))) };
}

/** Bone stretch: limb segments against the rest's lengths, in %. */
export function stretch(m: Motion): Measured {
  const R = m.rest, segs: [string, string, number][] = ["L", "R"].flatMap((s) => [["hip" + s, "knee" + s, R.thigh], ["knee" + s, "ankle" + s, R.shin], ["sh" + s, "elbow" + s, R.up], ["elbow" + s, "wrist" + s, R.fore]] as [string, string, number][]);
  const per: number[] = [], where: string[] = [];
  for (const X of m.frames) {
    let worst = 0, w = "";
    for (const [a, b, len] of segs) {
      const p = at(X, a), q = at(X, b), d = (Math.abs(PORTABLE.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) / len - 1) * 100) || 0;
      if (d > worst) [worst, w] = [d, `${a}–${b}`];
    }
    per.push(worst);
    where.push(w);
  }
  const L = levels(m, "stretch");
  return { value: Math.max(0, ...per), findings: keep(runs(per, m.times, L.warn).map((r) => finding(m, "stretch", r.worst, r.t0, r.t1, where[Math.round(r.at / m.dt)], `changes length by ${fmt(r.worst, 1)}%`, "keep bone lengths: solve the pose again from its parameters"))) };
}

/** A loop's seam: the jump from its last pose to its first, and the change of velocity across it. */
export function seam(m: Motion): { pose: Measured; velocity: Measured } {
  if (!m.loop || m.frames.length < 3) return { pose: { value: 0, findings: [] }, velocity: { value: 0, findings: [] } };
  const F = m.frames, n = F.length - 1, a = F[n]!, b = F[0]!;
  let jump = 0, vel = 0, jw = "", vw = "";
  for (let j = 0; j < format.P; j++) {
    const d = PORTABLE.hypot(a[j * 3]! - b[j * 3]!, a[j * 3 + 1]! - b[j * 3 + 1]!, a[j * 3 + 2]! - b[j * 3 + 2]!);
    if (d > jump) [jump, jw] = [d, format.POINTS[j]!];
    const dv = [0, 1, 2].map((c) => (F[n]![j * 3 + c]! - F[n - 1]![j * 3 + c]! - (F[1]![j * 3 + c]! - F[0]![j * 3 + c]!)) / m.dt), v = PORTABLE.hypot(dv[0]!, dv[1]!, dv[2]!);
    if (v > vel) [vel, vw] = [v, format.POINTS[j]!];
  }
  return {
    pose: { value: jump, findings: keep([finding(m, "seam", jump, m.dur, m.dur, jw, `jumps ${fmt(jump)} mm from the loop's last pose to its first`, "close the seam, spreading the gap over the cycle (fix: close a loop seam)")]) },
    velocity: { value: vel, findings: keep([finding(m, "seamVelocity", vel, m.dur, m.dur, vw, `changes speed by ${fmt(vel / 1000, 2)} m/s across the seam`, "match the ends' velocities (fix: close a loop seam)")]) },
  };
}

/** The import's recorded fit against its source (mean, worst mm). */
export function fit(m: Motion): Measured {
  const f = (m.quality as { fit?: number[] } | undefined)?.fit;
  if (!f) return { value: 0, findings: [] };
  const worstOk = (f[1] ?? 0) <= 300;
  return { value: f[0]!, findings: keep([finding(m, "fit", worstOk ? f[0]! : Math.max(f[0]!, THRESHOLDS.fit.fail), 0, m.dur, undefined, `strays ${fmt(f[0]!)} mm on average, ${fmt(f[1] ?? 0)} at worst, from its source`, "import it again or fit more keys (fix: re-fit keys to a budget)")]) };
}

/** Non-numbers in the keys or the decoded points. */
export function nan(m: Motion): Measured {
  let count = 0, first = -1;
  for (const key of (m.keys ?? []) as unknown as Record<string, unknown>[]) {
    for (const v of Object.values(key)) for (const x of Array.isArray(v) ? v : [v]) if (typeof x === "number" && !Number.isFinite(x)) [count, first] = [count + 1, first < 0 ? (key.t as number) : first];
  }
  m.frames.forEach((X, i) => {
    for (const x of X) if (!Number.isFinite(x)) [count, first] = [count + 1, first < 0 ? m.times[i]! : first];
  });
  return { value: count, findings: keep([finding(m, "nan", count, Math.max(0, first), Math.max(0, first), undefined, `${count} values are not numbers`, "find the key that holds them and give it numbers")]) };
}

/** Events out of order, outside the clip, or without a name. */
export function events(m: Motion): Measured {
  const bad: { t: number; why: string }[] = [];
  m.events.forEach((e, i) => {
    if (typeof e.name !== "string" || !e.name) bad.push({ t: e.t, why: "has no name" });
    if (!(e.t >= 0 && e.t <= m.dur + 0.05)) bad.push({ t: e.t, why: `is outside the clip (0–${fmt(m.dur, 2)} s)` });
    if (i > 0 && e.t < m.events[i - 1]!.t) bad.push({ t: e.t, why: `comes before the event listed above it (${fmt(m.events[i - 1]!.t, 2)} s)` });
  });
  return { value: bad.length, findings: keep(bad.map((b) => finding(m, "events", bad.length, Math.max(0, b.t), Math.max(0, b.t), undefined, `an event ${b.why}`, "list events in time order, within the clip, each named"))) };
}

/**
 * A clip against its mirrored pair: `other` mirrored, sample by sample (its rest is this motion's). The index and
 * pinky points are left out: format 1 places them on the chest's right axis whichever the hand, so they don't mirror.
 */
export function symmetry(m: Motion, other: Motion): Measured {
  const per: number[] = [], n = Math.min(m.frames.length, other.frames.length);
  for (let i = 0; i < n; i++) {
    const X = m.frames[i]!, Y = other.frames[i]!;
    let worst = 0;
    for (let j = 0; j < format.P; j++) {
      if (/^(index|pinky)/.test(format.POINTS[j]!)) continue;
      const name = format.POINTS[j]!, mj = format.IDX[name.endsWith("L") ? name.slice(0, -1) + "R" : name.endsWith("R") ? name.slice(0, -1) + "L" : name]!;
      worst = Math.max(worst, PORTABLE.hypot(X[j * 3]! - Y[mj * 3]!, X[j * 3 + 1]! + Y[mj * 3 + 1]!, X[j * 3 + 2]! - Y[mj * 3 + 2]!));
    }
    per.push(worst);
  }
  const L = levels(m, "symmetry");
  return { value: Math.max(0, ...per), findings: keep(runs(per, m.times.slice(0, n), L.warn).map((r) => finding(m, "symmetry", r.worst, r.t0, r.t1, undefined, `differs from its pair's mirror by ${fmt(r.worst)} mm`, "mirror the pair again (the wrong side was mirrored), or don't pair them"))) };
}

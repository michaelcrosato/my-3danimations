// Synchronized blends (PLAN.md WP-2.3): two loops blended by contact phase, so a walk and a run step together. Each
// loop's cycle is mapped to a phase in [0, 1) that is 0 when the left foot plants and 0.5 when the right does (linear
// between); a blend at weight w lasts lerp(durA, durB, w) and, at each phase, blends the two clips' keys at that phase.
// Without contacts a clip's phase is its time over its duration.
// Given a rest body, the legs blend in point space: both poses are decoded, the points blended and the pelvis and legs
// encoded back (unrounded), so a foot both clips plant stays on the floor (a foot's height isn't linear in a leg's
// direction and bend: blending those numbers lifts a planted foot by up to 35 mm between a walk and a run).
import { P, type Rest } from "../format/body.ts";
import { decodePose, encodePose } from "../format/pose.ts";
import { keyAt } from "../format/sample.ts";
import type { Contacts } from "../format/types.ts";
import type { Playable } from "../clip/sample.ts";
import { blend, type Mask, type Pose } from "./pose.ts";

/** A loop's phase map: clip time to phase and back, anchored on its feet's plants. */
export interface PhaseMap {
  dur: number;
  /** The contacts it was anchored on, if any. */
  contacts?: Contacts;
  /** The phase (0 to 1) at clip time t. */
  phase(t: number): number;
  /** The clip time (0 to dur) at phase p. */
  time(p: number): number;
}

/** The phase map of a loop from its contacts: the left foot's first plant is phase 0, the right foot's next plant 0.5. */
export function phaseMap(clip: Playable, contacts?: Contacts): PhaseMap {
  const dur = clip.dur;
  const l = contacts?.footL?.[0]?.[0], r0 = contacts?.footR?.[0]?.[0];
  if (l === undefined || r0 === undefined) return { dur, ...(contacts ? { contacts } : {}), phase: (t) => (((t / dur) % 1) + 1) % 1, time: (p) => (((p % 1) + 1) % 1) * dur };
  const r = r0 > l ? r0 : r0 + dur; // the right plant after the left, within the cycle
  // anchors (time, phase): l → 0, r → 0.5, l + dur → 1
  const phase = (t: number) => {
    let u = ((t - l) % dur + dur) % dur + l; // into [l, l + dur)
    if (u < l) u += dur;
    return u < r ? ((u - l) / (r - l)) * 0.5 : 0.5 + ((u - r) / (l + dur - r)) * 0.5;
  };
  const time = (p0: number) => {
    const p = ((p0 % 1) + 1) % 1;
    const u = p < 0.5 ? l + (p / 0.5) * (r - l) : r + ((p - 0.5) / 0.5) * (l + dur - r);
    return ((u % dur) + dur) % dur;
  };
  return { dur, contacts: contacts!, phase, time };
}

/** Two loops blended in step: the blend's cycle length, its pose at any phase, and its contacts. */
export interface SyncedBlend {
  dur: number;
  /** The blended pose at phase p (0 is the left foot's plant). */
  at(p: number): Pose;
  /** The blend's contacts over one cycle (time = phase × dur): a foot is planted where the inputs, weighted, plant it. */
  contacts: Contacts;
}

/** How a synchronized blend reads its inputs. */
export interface SyncOptions {
  /** Blend only these fields (by weight); the legs then blend as numbers. */
  mask?: Mask;
  /** The body to blend the legs on in point space (omitted: they blend as numbers). */
  rest?: Rest;
}

/** The fields a point-space leg blend writes: the pelvis's place and frame, the legs and the feet. */
const LEG_FIELDS = ["hips", "body", "legL", "legR", "footL", "footR"] as const;

/** a and b blended at weight w in step: each read at the same contact phase, the cycle lasting lerp(a.dur, b.dur, w). */
export function syncBlend(a: Playable, ma: PhaseMap, b: Playable, mb: PhaseMap, w: number, opts: SyncOptions = {}): SyncedBlend {
  const A = new Float32Array(P * 3), B = new Float32Array(P * 3), X = new Float32Array(P * 3);
  const dur = a.dur + (b.dur - a.dur) * w;
  return {
    dur,
    contacts: blendContacts(ma, mb, w, dur),
    at: (p) => {
      const ka = keyAt(a, ma.time(p)), kb = keyAt(b, mb.time(p));
      const k = blend(ka, kb, w, opts.mask);
      if (!opts.rest || opts.mask) return k;
      decodePose(opts.rest, ka, A);
      decodePose(opts.rest, kb, B);
      for (let i = 0; i < X.length; i++) X[i] = A[i]! + (B[i]! - A[i]!) * w;
      const e = encodePose(opts.rest, X, k, { round: false });
      for (const f of LEG_FIELDS) if (e[f] !== undefined) k[f] = e[f];
      return k;
    },
  };
}

/** Whether a contact list plants `end` at clip time t of a loop of length dur. */
const plantedAt = (c: Contacts | undefined, end: "footL" | "footR" | "handL" | "handR", t: number, dur: number) =>
  (c?.[end] ?? []).some(([x, y]) => (t >= x && t <= y) || (y > dur && t <= y - dur));

/** The blend's contacts: at each of 240 phases, an end is planted where (1 − w)·A's plant + w·B's reaches a half. */
function blendContacts(ma: PhaseMap, mb: PhaseMap, w: number, dur: number): Contacts {
  const out: Contacts = { by: "detected" };
  const N = 240;
  for (const end of ["footL", "footR", "handL", "handR"] as const) {
    const on: boolean[] = [];
    for (let i = 0; i < N; i++) {
      const p = i / N;
      const v = (1 - w) * (plantedAt(ma.contacts, end, ma.time(p), ma.dur) ? 1 : 0) + w * (plantedAt(mb.contacts, end, mb.time(p), mb.dur) ? 1 : 0);
      on.push(v >= 0.5);
    }
    const iv: [number, number][] = [];
    for (let i = 0; i < N; i++) if (on[i] && !on[(i + N - 1) % N]) {
      let j = i;
      while (on[(j + 1) % N] && j - i < N - 1) j++;
      const a = (i / N) * dur, b = ((j + 1) / N) * dur;
      iv.push([Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000]);
    }
    if (on.every(Boolean)) iv.push([0, Math.round(dur * 1000) / 1000]);
    if (iv.length) out[end] = iv;
  }
  return out;
}

// Rest measurement (spec/SKELETON.md): `measure` turns a library's captured clips into its rest body and per-library
// spine shares, ported from my-3d2dge's readable.js:148-183 operation for operation (it reproduces tier 1a's rests);
// `restPoints` places the 36 body points on a recognized skeleton at rest, as an importer would, so a target body can
// be measured the same way.
import { P, POINTS, pt, type Rest } from "../format/body.ts";
import { DG, frameFR, frameUF, len, loc, qFromTo, qrot, qslerp, sub, type Frame } from "../format/math.ts";
import { capSample, type Capture } from "../format/sample.ts";
import { BODY_POINTS, type Place } from "./bones.ts";
import type { Recognition, SkeletonIn } from "./recognize.ts";

const rnd = (v: number, k = 10): number => Math.round(v * k) / k;
const rndV = (v: readonly number[], k = 10) => v.map((x) => rnd(x, k)) as [number, number, number];
const rndF = (F: Frame, k: number) => F.map((r) => rndV(r, k)) as unknown as Frame;

/**
 * A body's rest measurements from its own captured clips: proportions and offsets from the T-pose (`tposeName`, or the
 * first clip's first frame), and how much of the hips-to-chest turn each spine bone takes (the neck likewise).
 */
export function measure(clips: Record<string, Capture>, tposeName = "A_TPose"): Rest {
  const list = Object.values(clips);
  const T = capSample(clips[tposeName] || list[0]!, 0);
  const q = (n: string) => pt(T, n);
  const d = (a: string, b: string) => len(sub(q(a), q(b)));
  const Pr = frameFR(sub(q("hipR"), q("hipL")), sub(q("pelvisF"), q("pelvis")));
  const Cr = frameUF(sub(q("neck"), q("chest")), sub(q("chestF"), q("chest")));
  const Hr = frameUF(sub(q("headTop"), q("head")), sub(q("faceF"), q("head")));
  const spine = [sub(q("spine1"), q("pelvis")), sub(q("spine2"), q("spine1")), sub(q("chest"), q("spine2")), sub(q("neck"), q("chest"))];
  const neckSeg = sub(q("head"), q("neck"));
  const fr = (X: Float32Array) => {
    const p = (n: string) => pt(X, n);
    return { P: frameFR(sub(p("hipR"), p("hipL")), sub(p("pelvisF"), p("pelvis"))), C: frameUF(sub(p("neck"), p("chest")), sub(p("chestF"), p("chest"))), H: frameUF(sub(p("headTop"), p("head")), sub(p("faceF"), p("head"))) };
  };
  const frames: { X: Float32Array; qP: ReturnType<typeof qFromTo>; qC: ReturnType<typeof qFromTo>; qH: ReturnType<typeof qFromTo> }[] = [];
  for (const c of list) {
    for (let f = 0; f < c.n; f += Math.max(1, Math.floor(c.n / 6))) {
      const X = capSample(c, f / c.fps);
      const F = fr(X);
      frames.push({ X, qP: qFromTo(Pr, F.P), qC: qFromTo(Cr, F.C), qH: qFromTo(Hr, F.H) });
    }
  }
  const fitW = (a: string, b: string, from: "qP" | "qC", to: "qC" | "qH", rest: readonly number[]) => {
    let best = 0;
    let be = Infinity;
    for (let w = 0; w <= 1.0001; w += 0.05) {
      let e = 0;
      for (const S of frames) e += len(sub(qrot(qslerp(S[from], S[to], w), rest), sub(pt(S.X, b), pt(S.X, a))));
      if (e < be) {
        be = e;
        best = w;
      }
    }
    return Math.round(best * 100) / 100;
  };
  const spineW = [fitW("pelvis", "spine1", "qP", "qC", spine[0]!), fitW("spine1", "spine2", "qP", "qC", spine[1]!), fitW("spine2", "chest", "qP", "qC", spine[2]!), 1];
  const neckW = fitW("neck", "head", "qC", "qH", neckSeg);
  return {
    H0: rnd(q("pelvis")[2], 100),
    hipZ: rnd((q("hipL")[2] + q("hipR")[2]) / 2, 100),
    ankleZ: rnd(q("ankleL")[2], 100),
    Pr: rndF(Pr, 1e5),
    Cr: rndF(Cr, 1e5),
    Hr: rndF(Hr, 1e5),
    hip: { L: rndV(loc(Pr, sub(q("hipL"), q("pelvis")))), R: rndV(loc(Pr, sub(q("hipR"), q("pelvis")))) },
    spine: spine.map((v) => rndV(v)) as Rest["spine"],
    neckSeg: rndV(neckSeg),
    clav: { L: rndV(loc(Cr, sub(q("clavL"), q("neck")))), R: rndV(loc(Cr, sub(q("clavR"), q("neck")))) },
    cv: { L: rndV(loc(Cr, sub(q("shL"), q("clavL")))), R: rndV(loc(Cr, sub(q("shR"), q("clavR")))) },
    topH: rndV(loc(Hr, sub(q("headTop"), q("head")))),
    faceH: rndV(loc(Hr, sub(q("faceF"), q("head")))),
    up: rnd(d("shL", "elbowL"), 100),
    fore: rnd(d("elbowL", "wristL"), 100),
    knuck: rnd(d("knuckL", "wristL"), 100),
    fist: rnd(d("fistL", "wristL"), 100),
    thigh: rnd(d("hipL", "kneeL"), 100),
    shin: rnd(d("kneeL", "ankleL"), 100),
    ab: rnd(d("ankleL", "ballL"), 100),
    bt: rnd(d("ballL", "toeL"), 100),
    abPitch: rnd(Math.asin((q("ankleL")[2] - q("ballL")[2]) / d("ankleL", "ballL")) / DG, 100),
    btPitch: rnd(Math.asin((q("ballL")[2] - q("toeL")[2]) / d("ballL", "toeL")) / DG, 100),
    spineW,
    neckW,
  };
}

type V = [number, number, number];

/**
 * The 36 body points of a recognized skeleton at rest, in the format's frame (forward, right, up; mm), with the root
 * on the ground below the hips. `frame` is the skeleton's measured rest frame (`restFrame`); `toMm` converts its units
 * (1000 for glTF's metres). A point whose bones are all missing is NaN.
 */
export function restPoints(sk: SkeletonIn, rec: Recognition, frame: { forward: V; right: V; up: V }, toMm = 1000): Float32Array {
  const head = new Map(sk.bones.map((b) => [b.name, b.head as V]));
  const kids = new Map<string, string[]>(sk.bones.map((b) => [b.name, []]));
  for (const b of sk.bones) if (b.parent && kids.has(b.parent)) kids.get(b.parent)!.push(b.name);
  const parentOf = new Map(sk.bones.map((b) => [b.name, b.parent ?? null]));
  const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const tip = (n: string): V => {
    const c = kids.get(n)!.sort((a, b) => len(sub(head.get(b)!, head.get(n)!)) - len(sub(head.get(a)!, head.get(n)!)))[0];
    if (c) return head.get(c)!;
    const p = parentOf.get(n);
    return p ? add(head.get(n)!, sub(head.get(n)!, head.get(p)!) as V, 0.5) : head.get(n)!;
  };
  const place = (pl: Place): V | null => {
    const src = rec.bones[pl.bone];
    if (!src || !head.has(src)) return null;
    const h = head.get(src)!;
    if (pl.at === "along") return add(h, sub(tip(src), h) as V, pl.share);
    if (pl.at === "across") return add(add(h, sub(tip(src), h) as V, pl.share), frame.forward, (pl.side * 35) / toMm);
    if (pl.at === "tip") return tip(src);
    return pl.at === "ahead" ? add(h, frame.forward, 120 / toMm) : h;
  };
  const pelvis = place({ bone: "hips", at: "joint" }) ?? [0, 0, 0];
  const feet = ["leftToes", "rightToes", "leftFoot", "rightFoot"].map((b) => place({ bone: b, at: "joint" })).filter((v): v is V => v !== null);
  const ground = feet.length ? Math.min(...feet.map((v) => v[0] * frame.up[0] + v[1] * frame.up[1] + v[2] * frame.up[2])) : 0;
  const base = (pelvis[0] * frame.up[0] + pelvis[1] * frame.up[1] + pelvis[2] * frame.up[2]) - ground;
  const out = new Float32Array(P * 3);
  POINTS.forEach((name, i) => {
    const p = BODY_POINTS[name]!.map(place).find((v) => v !== null);
    if (!p) {
      out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = NaN;
      return;
    }
    const d = sub(p, pelvis);
    out[i * 3] = (d[0] * frame.forward[0] + d[1] * frame.forward[1] + d[2] * frame.forward[2]) * toMm;
    out[i * 3 + 1] = (d[0] * frame.right[0] + d[1] * frame.right[1] + d[2] * frame.right[2]) * toMm;
    out[i * 3 + 2] = (d[0] * frame.up[0] + d[1] * frame.up[1] + d[2] * frame.up[2] + base) * toMm;
  });
  return out;
}

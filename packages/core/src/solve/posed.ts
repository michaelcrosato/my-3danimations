// A posed skeleton's body points (WP-F.18): the 36 points BODY_POINTS places on a recognized skeleton, read from its
// bones as a host poses them (each bone's head and turn in skeleton space), in the format's frame (forward, right, up;
// mm from the format's origin), as restPoints reads them at rest. A point ahead of or across a bone takes the rest
// frame's forward turned by the bone's turn since rest, so a turned body's front points turn with it. A host reads its
// engine back through it to draw or measure what it plays (the engine sheet), against the clip's own points.
import { BODY_POINTS, type Place } from "../skeleton/bones.ts";
import { POINTS } from "../format/body.ts";
import { qconj, qmul, qrot } from "../format/math.ts";
import { PORTABLE } from "../math/portable.ts";
import type { Quat } from "../math/quat.ts";
import { toFormat, type Bound } from "./bind.ts";

type V = [number, number, number];

/** A source bone as posed: its head and its turn in skeleton space (null when the host has no such bone). */
export type PosedBone = (source: string) => { head: readonly number[]; q: Quat } | null;

/** The 36 body points of skeleton `b` as `at` poses its bones, format frame, mm; a point whose bones are all missing is
 *  NaN. At rest (each bone at its rest head and `restWorld` turn) they are `b.restPts`, to rounding. */
export function posedPoints(b: Bound, at: PosedBone): Float32Array {
  const kids = new Map<string, string[]>(), restHead = new Map(b.order.map((o) => [o.name, o.head]));
  for (const o of b.order) if (o.parent >= 0) {
    const p = b.order[o.parent]!.name;
    kids.set(p, [...(kids.get(p) ?? []), o.name]);
  }
  const parentOf = new Map(b.order.map((o) => [o.name, o.parent >= 0 ? b.order[o.parent]!.name : null]));
  const add = (a: readonly number[], d: readonly number[], k = 1): V => [a[0]! + d[0]! * k, a[1]! + d[1]! * k, a[2]! + d[2]! * k];
  const sub = (a: readonly number[], c: readonly number[]): V => [a[0]! - c[0]!, a[1]! - c[1]!, a[2]! - c[2]!];
  const dist = (a: readonly number[], c: readonly number[]) => PORTABLE.hypot(a[0]! - c[0]!, a[1]! - c[1]!, a[2]! - c[2]!);
  // a bone's tip as restPoints reads it: the child whose head is farthest at rest (the same child in every pose), or
  // half a bone past the head along the parent's direction
  const tip = (n: string, head: readonly number[]): V | null => {
    const rh = restHead.get(n)!, c = [...(kids.get(n) ?? [])].sort((x, y) => dist(restHead.get(y)!, rh) - dist(restHead.get(x)!, rh)).find((x) => at(x));
    if (c) return [...at(c)!.head] as V;
    const p = parentOf.get(n), ph = p ? at(p)?.head : undefined;
    return ph ? add(head, sub(head, ph), 0.5) : [...head] as V;
  };
  // the rest frame's forward turned by bone n's turn since rest, `mm` long in skeleton units
  const ahead = (n: string, q: Quat, mm: number): V => {
    const v = qrot(qmul(q, qconj(b.restWorld[n] ?? [0, 0, 0, 1])), b.frame.forward);
    return [v[0] * mm * b.scale, v[1] * mm * b.scale, v[2] * mm * b.scale];
  };
  const place = (pl: Place): V | null => {
    const src = b.recognition.bones[pl.bone], got = src ? at(src) : null;
    if (!src || !got) return null;
    const h = got.head;
    if (pl.at !== "along" && pl.at !== "across") return pl.at === "joint" ? ([...h] as V) : pl.at === "tip" ? tip(src, h) : add(h, ahead(src, got.q, 120));
    const t = tip(src, h), along = t ? add(h, sub(t, h), pl.share) : null;
    if (!along) return null;
    return pl.at === "along" ? along : add(along, ahead(src, got.q, pl.side * 35));
  };
  const out = new Float32Array(POINTS.length * 3);
  POINTS.forEach((name, i) => {
    const p = BODY_POINTS[name]!.map(place).find((v) => v !== null);
    const f = p ? toFormat(b, p) : [NaN, NaN, NaN];
    out.set(f, i * 3);
  });
  return out;
}

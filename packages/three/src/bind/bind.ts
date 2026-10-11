// Binding a three.js character (PLAN.md WP-4.3): find its skinned skeleton (or a VRM's humanoid), recognize it
// (WP-1.4, by name or by topology), read its rest (heads and orientations in the character's own space, metres), bind
// it for the solver (core's bind: the rest frame, the body measured from the bones), measure each humanoid bone's
// length, and say how sure it is in a report of at most 20 lines with a patch an agent can edit and pass back.
import type { Bone, Object3D, SkinnedMesh } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";
import { bind as bindSkeleton, recognize, skeleton, type Bound, type SkeletonIn } from "@m3a/core";

/** A mapping an agent writes: each humanoid bone's source bone, or null to unmap it (the report's `patch`). */
export interface MappingPatch {
  bones: Record<string, string | null>;
}
/** How to bind: a mapping patch (or the file's parsed JSON) applied over what recognition found. */
export interface BindOptions {
  mapping?: MappingPatch;
}
/** What binding found: how, how sure, what is missing or odd, the bone lengths, a patch to edit, and the text. */
export interface MappingReport {
  method: "table" | "topology" | "none";
  table: string | null;
  confidence: number;
  missing: string[];
  unmapped: string[];
  issues: string[];
  /** The rest pose as read: T, A or relaxed, and how far the arms hang below level (degrees). */
  rest: { kind: "T" | "A" | "relaxed"; armDrop: number };
  /** Lengths in mm: the spine (hips to neck), and each limb bone to the next (upper arm to forearm, ...). */
  lengths: Record<string, number>;
  /** The mapping as a patch: edit it and pass it back as `mapping` (null unmaps a bone). */
  patch: MappingPatch;
  /** The report, at most 20 lines. */
  text: string;
}
/** A bound three.js character: the solver's skeleton, the three bones by humanoid name and by source name, and the
 * report. Skeleton space is the character root's own (its world transform left out), in metres. */
export interface ThreeBound {
  root: Object3D;
  mesh: SkinnedMesh | null;
  core: Bound;
  /** Every source bone, parent first, as the solver orders them. */
  bones: Bone[];
  /** Each mapped humanoid bone's three bone. */
  humanoid: Record<string, Bone>;
  report: MappingReport;
}

/** The lengths bind measures: each from a bone's head to the first of the bones after it that is mapped. */
const SEGMENTS: Readonly<Record<string, readonly [string, readonly string[]]>> = {
  spine: ["hips", ["neck", "head"]],
  ...Object.fromEntries(["left", "right"].flatMap((s) => [
    [`${s}UpperArm`, [`${s}UpperArm`, [`${s}LowerArm`]]],
    [`${s}LowerArm`, [`${s}LowerArm`, [`${s}Hand`]]],
    [`${s}UpperLeg`, [`${s}UpperLeg`, [`${s}LowerLeg`]]],
    [`${s}LowerLeg`, [`${s}LowerLeg`, [`${s}Foot`]]],
    [`${s}Foot`, [`${s}Foot`, [`${s}Toes`]]],
  ])),
};
/** The skinned mesh whose skeleton has the most bones under `root`, or null. */
function skinnedOf(root: Object3D): SkinnedMesh | null {
  let best: SkinnedMesh | null = null;
  root.traverse((o) => {
    const m = o as SkinnedMesh;
    if (m.isSkinnedMesh && (!best || m.skeleton.bones.length > best.skeleton.bones.length)) best = m;
  });
  return best;
}
/** A VRM's humanoid (three-vrm puts it on `userData.vrm`): each humanoid bone's node, when the character is one. */
function vrmHumanoid(root: Object3D): Record<string, Object3D> | null {
  const h = (root.userData?.vrm as { humanoid?: { humanBones?: Record<string, { node?: Object3D }> } } | undefined)?.humanoid?.humanBones;
  if (!h) return null;
  const out: Record<string, Object3D> = {};
  for (const [name, b] of Object.entries(h)) if (b?.node) out[name] = b.node;
  return out;
}

/**
 * Binds a three.js character: its skinned skeleton (or its VRM humanoid) recognized, its rest read in the root's own
 * space, bound for the solver. Throws when a required bone is missing, with the report's text (patch the mapping).
 */
export function bind(root: Object3D, opts: BindOptions = {}): ThreeBound {
  root.updateMatrixWorld(true);
  const mesh = skinnedOf(root), vrm = vrmHumanoid(root);
  const bones: Bone[] = mesh ? [...mesh.skeleton.bones] : [];
  if (!bones.length && vrm) for (const n of Object.values(vrm)) if ((n as Bone).isBone || n) bones.push(n as Bone);
  if (!bones.length) throw new Error("bind: no skinned mesh (or VRM humanoid) under this object: load the character's glTF and pass its scene");
  const inv = new Matrix4().copy(root.matrixWorld).invert(), m = new Matrix4(), p = new Vector3(), q = new Quaternion(), s = new Vector3();
  const set = new Set(bones);
  const sk: SkeletonIn = { bones: [] };
  const restWorld: Record<string, [number, number, number, number]> = {};
  for (const b of bones) {
    m.multiplyMatrices(inv, b.matrixWorld).decompose(p, q, s);
    sk.bones.push({ name: b.name, parent: b.parent && set.has(b.parent as Bone) ? b.parent.name : null, head: [p.x, p.y, p.z] });
    restWorld[b.name] = [q.x, q.y, q.z, q.w];
  }
  // recognized by name, then by topology; a VRM's own humanoid wins; an agent's patch over it all
  let rec = recognize(sk);
  if (vrm) {
    const byNode = new Map(bones.map((b) => [b as Object3D, b.name]));
    rec = skeleton.patchMapping(sk, rec, Object.fromEntries(Object.entries(vrm).filter(([h]) => skeleton.HUMANOID_BONES.includes(h) && byNode.has(vrm[h]!)).map(([h, n]) => [h, byNode.get(n)!])));
  }
  if (opts.mapping) rec = skeleton.patchMapping(sk, rec, opts.mapping.bones);
  const frame = skeleton.restFrame(sk, rec);
  const head = new Map(sk.bones.map((b) => [b.name, b.head!]));
  const lengths: Record<string, number> = {};
  for (const [h, [a, b]] of Object.entries(SEGMENTS)) {
    const to = b.find((x) => rec.bones[x]);
    if (!rec.bones[a] || !to) continue;
    const p0 = head.get(rec.bones[a]!)!, p1 = head.get(rec.bones[to]!)!;
    lengths[h] = Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) * 1000);
  }
  const report = reportOf(root, bones.length, rec, frame, lengths);
  if (rec.missing.length) throw new Error(`bind:\n${report.text}`);
  const core = bindSkeleton(sk, { recognition: rec, restWorld });
  const byName = new Map(bones.map((b) => [b.name, b]));
  const humanoid: Record<string, Bone> = {};
  for (const [h, src] of Object.entries(rec.bones)) humanoid[h] = byName.get(src)!;
  return { root, mesh, core, bones: core.order.map((o) => byName.get(o.name)!), humanoid, report };
}

/** The report: how the skeleton was read, how sure, what is missing or odd, the lengths and the patch (≤ 20 lines). */
function reportOf(root: Object3D, n: number, rec: ReturnType<typeof recognize>, frame: ReturnType<typeof skeleton.restFrame>, lengths: Record<string, number>): MappingReport {
  const patch: MappingPatch = { bones: { ...rec.bones, ...Object.fromEntries(rec.missing.map((b) => [b, null])) } };
  const L = (a: string, b: string) => (lengths[a] !== undefined || lengths[b] !== undefined ? `${lengths[a] ?? "?"}/${lengths[b] ?? "?"}` : "?");
  const how = rec.method === "table" ? `by name (${rec.table})` : rec.method === "topology" ? "by topology (names matched no table)" : "not at all";
  const lines = [
    `bind ${root.name || "character"}: ${n} bones, recognized ${how}, confidence ${rec.confidence.toFixed(2)}`,
    `rest: ${frame.kind}, the arms ${Math.round(frame.armDrop)}° below level`,
    `mapped: ${Object.keys(rec.bones).length} humanoid bones, ${15 - rec.missing.length} of the 15 required; ${rec.unmapped.length} source bones unmapped${rec.unmapped.length ? ` (${rec.unmapped.slice(0, 6).join(", ")}${rec.unmapped.length > 6 ? ", ..." : ""})` : ""}`,
    `missing: ${rec.missing.length ? rec.missing.join(", ") : "none"}`,
    ...rec.issues.slice(0, 5).map((x) => `issue: ${x}`),
    ...(rec.issues.length > 5 ? [`... ${rec.issues.length - 5} more issues`] : []),
    `lengths (mm, left/right): upper arm ${L("leftUpperArm", "rightUpperArm")}, forearm ${L("leftLowerArm", "rightLowerArm")}, thigh ${L("leftUpperLeg", "rightUpperLeg")}, shin ${L("leftLowerLeg", "rightLowerLeg")}`,
    rec.missing.length ? `patch: write each missing bone's source bone into "bones" (now null) and pass it back as { mapping }` : `patch: none needed; to change a bone, pass { mapping: { bones: { humanoidBone: "sourceBone" } } }`,
  ];
  return { method: rec.method, table: rec.table, confidence: rec.confidence, missing: rec.missing, unmapped: rec.unmapped, issues: rec.issues, rest: { kind: frame.kind, armDrop: frame.armDrop }, lengths, patch, text: lines.slice(0, 20).join("\n") };
}

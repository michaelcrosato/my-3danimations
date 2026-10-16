// Characters for the tools (PLAN.md WP-7.2b, D93): a character file (.glb, .gltf or .vrm) read through @m3a/io's
// skeleton reader and bound through core (recognize, an agent's mapping patch, bind), never three.js's loader, which
// fails in Node and renames bones, so a patch names the file's own bones. A VRM's humanoid (1.0's or 0.x's) maps its
// bones before any patch. `tiny` is the 34-bone conformance rig, graph.sim's default body. The report says how the
// bones were recognized, how sure, what is missing or odd, the rest pose, limb lengths and a patch to edit back, in at
// most 20 lines; retarget.inspect shows it, and a tool that needs the body bound refuses with it (bodyOf).
import { bind, skeleton, type Bound, type SkeletonIn } from "@m3a/core";
import { IoError, parseGlb, parseGltf, skeletonOfGltf, type GltfJson, type GltfSkeleton } from "@m3a/io";
import { ToolError, type ToolContext } from "../registry/registry.ts";
import { didYouMean, quote, type Schema } from "../registry/schema.ts";
import { count } from "./common.ts";

/** The character parameter: a character file under the working directory, or the tiny rig. */
export const CHARACTER: Schema = { type: "string", description: ".glb .gltf .vrm file, or tiny" };
/** The mapping parameter: retarget.inspect's patch, edited ({bones: {humanoid bone: file's bone, or null to unmap}}). */
export const MAPPING: Schema = { type: "object", description: "patch: {bones: {hips: \"pelvis\"}}", properties: { bones: { type: "object" } }, required: ["bones"] };

/** A mapping an agent writes: each humanoid bone's source bone (the file's own name), or null to unmap it. */
export interface MappingPatch {
  bones: Record<string, string | null>;
}
/** What binding found: the source bones, how they were recognized (a VRM by its own humanoid), how sure, what is missing
 *  or odd, the rest pose, lengths in mm (the spine, hips to neck; each limb bone to the next), the patch, the text. */
export interface CharacterReport {
  bones: number;
  method: "table" | "topology" | "none";
  table: string | null;
  vrm: boolean;
  confidence: number;
  missing: string[];
  unmapped: string[];
  issues: string[];
  rest: { kind: "T" | "A" | "relaxed"; armDrop: number };
  lengths: Record<string, number>;
  patch: MappingPatch;
  text: string;
}
/** A character for the tools: bound (null while a required bone is missing; the report names it), the recognition the
 *  binding used, and the report. */
export interface Character {
  bound: Bound | null;
  recognition: skeleton.Recognition;
  report: CharacterReport;
}

/** The tiny rig (tier 1b's rig.gltf; conformance tier 3's skeleton, spec/conformance/runner/skeleton.ts rigSkeleton()):
 *  34 bones, Unreal's names, metres, +y up, facing +z, each head its parent's plus the node's translation. */
export const TINY: SkeletonIn = (() => {
  const bones: skeleton.BoneIn[] = [], at = new Map<string, [number, number, number]>();
  const bone = (name: string, parent: string | null, t: readonly [number, number, number]) => {
    const p = parent === null ? undefined : at.get(parent)!, head: [number, number, number] = p ? [p[0] + t[0], p[1] + t[1], p[2] + t[2]] : [t[0], t[1], t[2]];
    at.set(name, head);
    bones.push({ name, parent, head });
  };
  bone("root", null, [0, 0, 0]);
  bone("pelvis", "root", [0, 0.06 + 0.89, 0]); // the ankle 0.06 m up, the leg 0.89 m, summed as the generator sums them
  let up = "pelvis";
  for (const [name, y] of [["spine_01", 0.1], ["spine_02", 0.12], ["spine_03", 0.12], ["neck_01", 0.16], ["Head", 0.1], ["head_leaf", 0.18]] as const) {
    bone(name, up, [0, y, 0]);
    up = name;
  }
  for (const [s, x] of [["l", 1], ["r", -1]] as const) {
    const n = (b: string) => `${b}_${s}`;
    bone(n("clavicle"), "spine_03", [0.03 * x, 0.12, 0]);
    bone(n("upperarm"), n("clavicle"), [0.15 * x, 0, 0]);
    bone(n("lowerarm"), n("upperarm"), [0.28 * x, 0, 0]);
    bone(n("hand"), n("lowerarm"), [0.25 * x, 0, 0]);
    bone(n("index_01"), n("hand"), [0.09 * x, 0, 0.03]);
    bone(n("middle_01"), n("hand"), [0.09 * x, 0, 0]);
    bone(n("middle_02"), n("middle_01"), [0.045 * x, 0, 0]);
    bone(n("pinky_01"), n("hand"), [0.08 * x, 0, -0.03]);
    bone(n("thigh"), "pelvis", [0.1 * x, -0.02, 0]);
    bone(n("calf"), n("thigh"), [0, -0.44, 0]);
    bone(n("foot"), n("calf"), [0, -0.43, 0]);
    bone(n("ball"), n("foot"), [0, -0.06, 0.13]);
    bone(n("ball_leaf"), n("ball"), [0, 0, 0.06]);
  }
  return { bones, up: [0, 1, 0] };
})();

// VRM 0.x's thumb names in VRM 1.0's (0.x's proximal is 1.0's metacarpal, its intermediate 1.0's proximal)
const VRM0: Readonly<Record<string, string>> = { leftThumbProximal: "leftThumbMetacarpal", leftThumbIntermediate: "leftThumbProximal", rightThumbProximal: "rightThumbMetacarpal", rightThumbIntermediate: "rightThumbProximal" };

/** A VRM's own humanoid (VRMC_vrm's, or VRM 0.x's, its thumbs renamed) as patch entries over the skeleton's bone names;
 *  null when the file has none. An entry naming no humanoid bone, or a node that is no bone, is left out. */
export function vrmMapping(json: GltfJson, g: GltfSkeleton): Record<string, string> | null {
  const ext = json.extensions as Record<string, { humanoid?: { humanBones?: unknown } } | undefined> | undefined;
  const v1 = ext?.VRMC_vrm?.humanoid?.humanBones, v0 = ext?.VRM?.humanoid?.humanBones;
  const entries = v1 && typeof v1 === "object" && !Array.isArray(v1) ? Object.entries(v1 as Record<string, { node?: unknown } | null>).map(([h, b]) => [h, b?.node] as const)
    : Array.isArray(v0) ? (v0 as ({ bone?: unknown; node?: unknown } | null)[]).map((b) => [typeof b?.bone === "string" ? (VRM0[b.bone] ?? b.bone) : undefined, b?.node] as const) : null;
  if (!entries) return null;
  const byNode = new Map(g.nodes.map((n, k) => [n, g.skeleton.bones[k]!.name])), out: Record<string, string> = {};
  for (const [h, n] of entries) if (h !== undefined && skeleton.HUMANOID_BONES.includes(h) && byNode.has(n as number)) out[h] = byNode.get(n as number)!;
  return out;
}

/** A character's skeleton: the tiny rig, or a .glb, .gltf or .vrm file read through io (E_ARGS for anything else; an
 *  unreadable file is an error with io's code). */
async function skeletonOf(ctx: ToolContext, ref: string): Promise<{ sk: SkeletonIn; restWorld?: GltfSkeleton["restWorld"]; vrm: Record<string, string> | null }> {
  if (ref === "tiny") return { sk: TINY, vrm: null };
  const ext = /\.(glb|gltf|vrm)$/i.exec(ref)?.[1]!.toLowerCase();
  if (!ext) throw new ToolError("E_ARGS", `${quote(ref)} is not a character: give a .glb, .gltf or .vrm file, or "tiny"`, true);
  try {
    const doc = ext === "gltf" ? parseGltf(await ctx.read(ref), ref) : parseGlb(await ctx.bytes(ref), ref), g = skeletonOfGltf(doc);
    return { sk: g.skeleton, restWorld: g.restWorld, vrm: vrmMapping(doc.json, g) };
  } catch (err) {
    throw err instanceof IoError ? new ToolError(err.code, err.file ? err.message : `${ref}: ${err.message}`) : err;
  }
}

/** Refuses (E_ARGS, with the closest name) a patch naming a bone that isn't humanoid, or one the character lacks. */
function checkPatch(sk: SkeletonIn, m: MappingPatch): void {
  const names = sk.bones.map((b) => b.name);
  for (const [h, src] of Object.entries(m.bones)) {
    if (!skeleton.HUMANOID_BONES.includes(h)) throw new ToolError("E_ARGS", `mapping: ${quote(h)} is not a VRM 1.0 humanoid bone${didYouMean(h, skeleton.HUMANOID_BONES)}`, true);
    if (src !== null && (typeof src !== "string" || !names.includes(src))) throw new ToolError("E_ARGS", `mapping: ${h}: the character has no bone ${quote(src)}${typeof src === "string" ? didYouMean(src, names) : ""}`, true);
  }
}

/**
 * A character bound for the tools: `ref` (a .glb, .gltf or .vrm file, or "tiny") read, its bones recognized (a VRM's by
 * its humanoid), `mapping` patched over them, and bound through core. A required bone still missing leaves it unbound,
 * the report saying which; no humanoid bone recognized at all is E_RIG (an error).
 */
export async function characterOf(ctx: ToolContext, ref: string, mapping?: MappingPatch | null): Promise<Character> {
  const { sk, restWorld, vrm } = await skeletonOf(ctx, ref);
  let rec = skeleton.recognize(sk);
  const byVrm = vrm !== null && Object.keys(vrm).length > 0;
  if (byVrm) {
    // a VRM's humanoid is the file's own word, not a hand patch
    const r = skeleton.patchMapping(sk, rec, vrm);
    rec = { ...r, issues: r.issues.filter((i) => i !== "patched by hand") };
  }
  if (mapping) {
    checkPatch(sk, mapping);
    rec = skeleton.patchMapping(sk, rec, mapping.bones);
  }
  if (!Object.keys(rec.bones).length) throw new ToolError("E_RIG", `${ref}: no humanoid bone recognized among its ${sk.bones.length} bones, by name or by shape; give each bone in mapping {bones: {hips: "<its bone>", ...}}`);
  const report = reportOf(ref, sk, rec, byVrm);
  let bound: Bound | null;
  try {
    bound = rec.missing.length ? null : bind(sk, { recognition: rec, ...(restWorld ? { restWorld } : {}) });
  } catch (err) {
    throw new ToolError("E_RIG", `${ref}: can't bind it (${err instanceof Error ? err.message : String(err)}); retarget.inspect shows its mapping`);
  }
  return { bound, recognition: rec, report };
}

/** A character bound, or E_RIG (an error) naming the required bones it lacks and how to patch them. */
export async function bodyOf(ctx: ToolContext, ref: string, mapping?: MappingPatch | null): Promise<Character & { bound: Bound }> {
  const c = await characterOf(ctx, ref, mapping);
  if (!c.bound) throw new ToolError("E_RIG", `${ref}: ${c.report.missing.join(", ")} not mapped; retarget.inspect ${ref} shows the mapping: write each into its patch and pass it as mapping`);
  return c as Character & { bound: Bound };
}

/** The lengths the report measures: each from a bone's head to the first of the bones after it that is mapped. */
const SEGMENTS: Readonly<Record<string, readonly [string, readonly string[]]>> = {
  spine: ["hips", ["neck", "head"]],
  ...Object.fromEntries(["left", "right"].flatMap((s) => ["UpperArm>LowerArm", "LowerArm>Hand", "UpperLeg>LowerLeg", "LowerLeg>Foot", "Foot>Toes"].map((ab) => {
    const [a, b] = ab.split(">") as [string, string];
    return [`${s}${a}`, [`${s}${a}`, [`${s}${b}`]]];
  }))),
};

/** The report (at most 20 lines): how the bones were read, how sure, what is missing or odd, the lengths, the patch. */
function reportOf(ref: string, sk: SkeletonIn, rec: skeleton.Recognition, vrm: boolean): CharacterReport {
  const frame = skeleton.restFrame(sk, rec), head = new Map(sk.bones.map((b) => [b.name, b.head!])), lengths: Record<string, number> = {};
  for (const [h, [a, b]] of Object.entries(SEGMENTS)) {
    const to = b.find((x) => rec.bones[x]);
    if (!rec.bones[a] || !to) continue;
    const p = head.get(rec.bones[a]!)!, q = head.get(rec.bones[to]!)!;
    lengths[h] = Math.round(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * 1000);
  }
  const patch: MappingPatch = { bones: { ...rec.bones, ...Object.fromEntries(rec.missing.map((b) => [b, null])) } };
  const L = (s: string) => `${lengths[`left${s}`] ?? "?"}/${lengths[`right${s}`] ?? "?"}`, un = rec.unmapped;
  const how = vrm ? "by its VRM humanoid" : rec.method === "table" ? `by name (${rec.table})` : rec.method === "topology" ? "by topology (names matched no table)" : "not at all";
  const lines = [
    `${ref}: ${count(sk.bones.length, "bone")}, recognized ${how}, confidence ${rec.confidence.toFixed(2)}`,
    `rest: ${frame.kind}, the arms ${Math.round(frame.armDrop)}° below level`,
    `mapped: ${count(Object.keys(rec.bones).length, "humanoid bone")}, ${skeleton.REQUIRED_BONES.length - rec.missing.length} of the ${skeleton.REQUIRED_BONES.length} required; ${count(un.length, "source bone")} unmapped${un.length ? ` (${un.slice(0, 6).join(", ")}${un.length > 6 ? ", ..." : ""})` : ""}`,
    `missing: ${rec.missing.length ? rec.missing.join(", ") : "none"}`,
    ...rec.issues.slice(0, 5).map((x) => `issue: ${x}`),
    ...(rec.issues.length > 5 ? [`... ${rec.issues.length - 5} more issues`] : []),
    `lengths (mm, left/right): upper arm ${L("UpperArm")}, forearm ${L("LowerArm")}, thigh ${L("UpperLeg")}, shin ${L("LowerLeg")}`,
    rec.missing.length ? `patch: write each missing bone's source bone into "bones" (now null) and pass it back as mapping` : `patch: none needed; to change a bone, pass mapping {bones: {humanoidBone: "sourceBone"}}`,
  ];
  return { bones: sk.bones.length, method: rec.method, table: rec.table, vrm, confidence: rec.confidence, missing: rec.missing, unmapped: un, issues: rec.issues, rest: { kind: frame.kind, armDrop: frame.armDrop }, lengths, patch, text: lines.join("\n") };
}

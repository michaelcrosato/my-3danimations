// Characters for the tools (PLAN.md WP-7.2b, D93): a character file (.glb, .gltf or .vrm) read through @m3a/io's
// skeleton reader and bound through core (recognize, an agent's mapping patch, bind), never three.js's loader, which
// fails in Node and renames bones, so a patch names the file's own bones. A VRM's humanoid (1.0's or 0.x's) maps its
// bones before any patch. A foot that ends with no child gets an end bone where its mesh ends, on the sole (D49), as
// three's bind gives it, so the body bound here stands as the game's does (a compressed mesh, whose weights io can't
// read, gives none: every joint is kept and the report says so; so does a mesh whose positions io can't read, which
// leaves the hips low). `tiny` is the 34-bone conformance rig, graph.sim's default body. The report says how the bones
// were recognized, how sure, what is missing or odd, the rest pose, limb lengths and a patch to edit back, in at most
// 20 lines, with each missing bone's likely source bones, and hips under half the legs' length as an issue (a wrong
// bone for them, such as the rig's root, which no other check sees; a mesh's issue no patch clears, meshIssue);
// retarget.inspect shows it, and a tool that needs the body bound refuses with it (bodyOf). Replies name the character
// as clips.ts names a file: never by an absolute path.
import { bind, skeleton, type Bound, type SkeletonIn } from "@m3a/core";
import { IoError, meshEnds, parseGlb, parseGltf, skeletonOfGltf, type GltfDoc, type GltfJson, type GltfSkeleton } from "@m3a/io";
import { ToolError, type ToolContext } from "../registry/registry.ts";
import { didYouMean, quote, type Schema } from "../registry/schema.ts";
import { naming } from "./clips.ts";
import { call, count, cut } from "./common.ts";

/** The character parameter: a character file under the working directory, or the tiny rig. */
export const CHARACTER: Schema = { type: "string", description: ".glb .gltf .vrm file, or tiny" };
/** The mapping parameter: retarget.inspect's patch, edited ({bones: {humanoid bone: file's bone, or null to unmap}}). */
export const MAPPING: Schema = { type: "object", description: "patch: {bones: {hips: \"pelvis\"}}", properties: { bones: { type: "object" } }, required: ["bones"] };

/** How replies name character `ref` (clips.ts naming): as given, single-quoted where a shell would split it, or `<the
 *  character's file>` for an absolute path or one with a control character, which no reply echoes (D95). */
export const characterName = (ref: string): string => naming({ id: ref, where: "file", path: ref, name: null }, "the character's").as;

/** Whether a report's issue is its mesh's (compressed, unreadable, or its soles unread): no mapping patch clears it. */
export const meshIssue = (issue: string): boolean => /^mesh (compressed|unreadable)|^sole end bones unread/.test(issue);
/** What the report's patch line says of mesh issue `i`: a compressed mesh re-exported uncompressed, or one io can't
 *  read re-exported so it can, gives exact soles; weights io can't read, re-exported so it can (as is, every joint is
 *  kept: a broken weights accessor, three's loader refuses the whole file). */
const mend = (i: string): string => (/^mesh compressed/.test(i) ? "re-export it uncompressed for exact soles" : /^mesh unreadable/.test(i) ? "re-export it so io can read its weights (as is, every joint is kept)" : "re-export it so io can read it, for exact soles");

/** A mapping an agent writes: each humanoid bone's source bone (the file's own name), or null to unmap it. */
export interface MappingPatch {
  bones: Record<string, string | null>;
}
/** What binding found: the source bones, how they were recognized (a VRM by its own humanoid), how sure, what is missing
 *  (with each missing bone's likely source bones, `candidates`) or odd, the rest pose, lengths in mm (the spine, hips to
 *  neck; each limb bone to the next), the patch, the text. */
export interface CharacterReport {
  bones: number;
  method: "table" | "topology" | "none";
  table: string | null;
  vrm: boolean;
  confidence: number;
  missing: string[];
  candidates: Record<string, string[]>;
  unmapped: string[];
  issues: string[];
  rest: { kind: "T" | "A" | "relaxed"; armDrop: number };
  lengths: Record<string, number>;
  patch: MappingPatch;
  text: string;
}
/** A character for the tools: bound (null while a required bone is missing; the report names it), the recognition the
 *  binding used, and the report. The bound skeleton may hold end bones the file doesn't (`<foot's last bone>_end`, on
 *  the sole, D49); they have no node. */
export interface Character {
  bound: Bound | null;
  recognition: skeleton.Recognition;
  report: CharacterReport;
}

/** The tiny rig (tier 1b's rig.gltf; conformance tier 3's skeleton, spec/conformance/runner/skeleton.ts rigSkeleton()):
 *  34 bones, Unreal's names, metres, +y up, facing +z, each head its parent's plus the node's translation. Frozen, deep:
 *  every character bound from it shares it. */
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
  const sk: SkeletonIn = { bones, up: [0, 1, 0] };
  for (const x of [...bones.flatMap((b) => [b.head, b]), bones, sk.up, sk]) Object.freeze(x);
  return sk;
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

/** A character read: its skeleton, and for a file its document and glTF skeleton (the soles are read from its mesh). */
interface Read {
  sk: SkeletonIn;
  file: { doc: GltfDoc; g: GltfSkeleton } | null;
  vrm: Record<string, string> | null;
}
/** A character's skeleton: the tiny rig, or a .glb, .gltf or .vrm file read through io (E_ARGS for anything else; an
 *  unreadable file is an error with io's code). */
async function skeletonOf(ctx: ToolContext, ref: string): Promise<Read> {
  if (ref === "tiny") return { sk: TINY, file: null, vrm: null };
  const ext = /\.(glb|gltf|vrm)$/i.exec(ref)?.[1]!.toLowerCase(), name = characterName(ref);
  if (!ext) throw new ToolError("E_ARGS", `${name} is not a character: give a .glb, .gltf or .vrm file, or "tiny"`, true);
  try {
    const doc = ext === "gltf" ? parseGltf(await ctx.read(ref), name) : parseGlb(await ctx.bytes(ref), name), g = skeletonOfGltf(doc);
    return { sk: g.skeleton, file: { doc, g }, vrm: vrmMapping(doc.json, g) };
  } catch (err) {
    throw err instanceof IoError ? new ToolError(err.code, err.file ? err.message : `${name}: ${err.message}`) : err;
  }
}

/** The skeleton bound, with D49's end bones (as three's bind adds them): each foot's last bone (its toes, else the foot)
 *  that has no child ends where its mesh does, on the sole, so its toe and the ground under it are the foot's real tip;
 *  the tiny rig, and a foot no vertex is weighted to, as they are; `unread` says why a mesh that would give one went
 *  unread (meshEnds). */
function withSoles({ sk, file }: Read, rec: skeleton.Recognition): { sk: SkeletonIn; restWorld?: GltfSkeleton["restWorld"]; unread: string | null } {
  if (!file) return { sk, unread: null };
  const lasts = [...new Set(["left", "right"].map((s) => rec.bones[`${s}Toes`] ?? rec.bones[`${s}Foot`]))].filter((b): b is string => !!b && !sk.bones.some((x) => x.parent === b));
  const { ends, unread } = meshEnds(file.doc, lasts.map((b) => file.g.nodes[sk.bones.findIndex((x) => x.name === b)]!)), bones = [...sk.bones], restWorld = { ...file.g.restWorld };
  lasts.forEach((b, k) => {
    const at = ends[k];
    if (!at) return;
    let name = `${b}_end`;
    while (bones.some((x) => x.name === name)) name += "_";
    bones.push({ name, parent: b, head: at });
    restWorld[name] = [0, 0, 0, 1];
  });
  return { sk: { ...sk, bones }, restWorld, unread };
}

/** The most bones a character may have (recognition by shape is quadratic in them), and the most on one chain (core's
 *  recognition by shape recurses down it: about 3,000 deep runs out of stack). */
const MAX_BONES = 4096, MAX_DEPTH = 1024;

/** The most bones on one chain of `sk`, root to leaf (io's bones form a tree; a parent the skeleton lacks is none). */
function deepest(sk: SkeletonIn): number {
  const parent = new Map(sk.bones.map((b) => [b.name, b.parent ?? null])), depth = new Map<string, number>();
  for (const b of sk.bones) {
    const up: string[] = [];
    for (let p: string | null = b.name; p !== null && parent.has(p) && !depth.has(p); p = parent.get(p)!) up.push(p);
    for (const n of up.reverse()) depth.set(n, (depth.get(parent.get(n)!) ?? 0) + 1);
  }
  return Math.max(0, ...depth.values());
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
 * the report saying which; no humanoid bone recognized at all, or bones of no usable length (their rest points not
 * finite, or the legs' length none), is E_RIG (an error), and too many bones or too long a chain E_LIMIT. Hips bound
 * under half the legs' length are an issue: a wrong bone for them.
 */
export async function characterOf(ctx: ToolContext, ref: string, mapping?: MappingPatch | null): Promise<Character> {
  const read = await skeletonOf(ctx, ref), { sk, vrm } = read, name = characterName(ref);
  if (sk.bones.length > MAX_BONES) throw new ToolError("E_LIMIT", `${name}: ${sk.bones.length} bones; a character may have at most ${MAX_BONES}`);
  const deep = deepest(sk);
  if (deep > MAX_DEPTH) throw new ToolError("E_LIMIT", `${name}: a chain of ${deep} bones; a character's chains may be at most ${MAX_DEPTH} bones long`);
  const named = skeleton.recognize(sk), byVrm = vrm !== null && Object.keys(vrm).length > 0;
  let rec = byVrm ? skeleton.patchMapping(sk, named, vrm) : named;
  if (mapping) {
    checkPatch(sk, mapping);
    rec = skeleton.patchMapping(sk, rec, mapping.bones);
  }
  if (byVrm) {
    // a VRM's humanoid is the file's own word, not a hand patch; a required bone it doesn't give is said, with how it was found
    const given = (h: string) => h in vrm || (mapping ? h in mapping.bones : false), how = named.method === "table" ? `by name (${named.table})` : "by topology";
    const own = skeleton.REQUIRED_BONES.filter((h) => rec.bones[h] && !given(h)).map((h) => `${h}: not in its VRM humanoid; found ${how}`);
    rec = { ...rec, issues: [...own, ...rec.issues.filter((i) => mapping || i !== "patched by hand")] };
  }
  if (!Object.keys(rec.bones).length) throw new ToolError("E_RIG", `${name}: no humanoid bone recognized among its ${sk.bones.length} bones, by name or by shape; give each bone in mapping {bones: {hips: "<its bone>", ...}}`);
  // the weights unread (every joint kept; a compressed mesh gives no soles), and the soles' mesh unread if it was
  // another reason: said first, for retarget.inspect to show
  const body = rec.missing.length ? null : withSoles(read, rec), unread = read.file?.g.unread ?? null, said: string[] = [];
  if (unread) said.push(unread === "unreadable" ? "mesh unreadable: weights unread, every joint kept" : `mesh compressed (${unread}): weights and soles unread; every joint kept`);
  if (body?.unread && body.unread !== unread) said.push(`sole end bones unread: ${body.unread}; the hips may sit 10-40 mm low`);
  if (said.length) rec = { ...rec, issues: [...said, ...rec.issues] };
  let bound: Bound | null = null;
  try {
    if (body) bound = bind(body.sk, { recognition: rec, ...(body.restWorld ? { restWorld: body.restWorld } : {}) });
  } catch (err) {
    throw new ToolError("E_RIG", `${name}: can't bind it (${err instanceof Error ? err.message : String(err)}): give each humanoid bone its source bone in mapping {bones: {hips: "<its bone>", ...}}`);
  }
  // no body to play clips on, nor numbers a reply holds: the file's nodes at one point, or scaled to 0 or out of range
  const legs = bound ? bound.rest.thigh + bound.rest.shin : 0;
  if (bound && !(legs > 0 && bound.restPts.every(Number.isFinite))) throw new ToolError("E_RIG", `${name}: can't bind it: bones of no usable length (every node at one point, or scaled to 0 or out of range); check the file's node transforms`);
  // hips under half the legs' length (the rig's root taken for them, say: an ancestor of every bone, so nothing else
  // flags it, and every clip played on it fails)
  if (bound && !(bound.rest.H0 >= legs / 2)) {
    rec = { ...rec, issues: [...rec.issues, `hips (${rec.bones.hips}) likely the wrong bone: only ${Math.round(bound.rest.H0)} mm up, under half the legs' ${Math.round(legs)} mm`] };
  }
  return { bound, recognition: rec, report: reportOf(name, sk, rec, byVrm, new Set([...Object.keys(named.bones), ...Object.keys(vrm ?? {})])) };
}

/** A character bound, or E_RIG (an error) naming the required bones it lacks and how to patch them, its next the
 *  retarget.inspect call that gives the patch. */
export async function bodyOf(ctx: ToolContext, ref: string, mapping?: MappingPatch | null): Promise<Character & { bound: Bound }> {
  const c = await characterOf(ctx, ref, mapping);
  const name = characterName(ref), see = call("retarget.inspect", [name], { mapping: mapping ?? undefined });
  if (!c.bound) throw new ToolError("E_RIG", `${name}: ${c.report.missing.join(", ")} not mapped; ${see} gives the patch: write each into it and pass it as mapping`, false, { next: `${see} gives the patch to fill in` });
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

/** Each missing bone's likely source bones (at most 3, the likeliest first), among the unmapped ones. Under each nearest
 *  mapped humanoid bone below it: the bones on the chain from that one's source up to its nearest mapped humanoid
 *  ancestor's (or the root), the one as many up as there are gaps between them leading (for a missing shin, the foot's
 *  parent; for missing hips, the spine's and the thighs' parent). With none mapped below it: the bones under that
 *  ancestor's, the one as far down as it is leading. A gap is a humanoid bone unmapped that every rig has (a required
 *  one) or that this rig's names gave before the patch (`had`): a rig without clavicles has no shoulder between. */
function candidatesOf(sk: SkeletonIn, rec: skeleton.Recognition, had: ReadonlySet<string>): Record<string, string[]> {
  const parent = new Map(sk.bones.map((b) => [b.name, b.parent ?? null])), free = new Set(rec.unmapped), P = skeleton.HUMANOID_PARENT, kids = new Map<string | null, string[]>();
  for (const b of sk.bones) if (free.has(b.name)) kids.set(b.parent ?? null, [...(kids.get(b.parent ?? null) ?? []), b.name]);
  const gap = (h: string) => !rec.bones[h] && (skeleton.REQUIRED_BONES.includes(h) || had.has(h));
  return Object.fromEntries(rec.missing.map((h) => {
    let a = 0, p = P[h];
    for (; p && !rec.bones[p]; p = P[p]) a += Number(gap(p));
    const top = p ? rec.bones[p]! : null, score = new Map<string, number>(), put = (b: string, v: number) => void (score.get(b)! <= v || score.set(b, v));
    const down = (x: string, gaps: number): void => {
      for (const y of skeleton.HUMANOID_BONES.filter((y) => P[y] === x)) {
        if (!rec.bones[y]) down(y, gaps + Number(gap(y)));
        const chain: string[] = [], up = top === null || gaps < a; // counted from the nearer end: a twist bone falls behind
        for (let q = rec.bones[y] ? (parent.get(rec.bones[y]) ?? null) : null; q !== null && q !== top; q = parent.get(q) ?? null) if (free.has(q)) chain.unshift(q);
        chain.forEach((b, i) => {
          const t = Math.abs(i - a), u = Math.abs(chain.length - 1 - i - gaps);
          put(b, up ? u * 4096 + t : t * 4096 + u);
        });
      }
    };
    // as far down as it is: a + 1 levels under the ancestor's source, the nearer levels first, the shallower of two
    const walk = (x: string | null, d: number): void => {
      for (const b of kids.get(x) ?? []) {
        put(b, 2 * Math.abs(d - a - 1) + Number(d > a + 1));
        if (d <= a + 1) walk(b, d + 1);
      }
    };
    down(h, 0);
    if (!score.size) walk(top, 1);
    return [h, [...score].sort((x, y) => x[1] - y[1]).slice(0, 3).map(([b]) => b)];
  }));
}

/** The report (at most 20 lines): how the bones were read, how sure, what is missing (and what may stand in for it) or
 *  odd, the lengths, the patch; `name` the character as replies name it (characterName); `had` the humanoid bones its
 *  names gave before any patch (candidatesOf). */
function reportOf(name: string, sk: SkeletonIn, rec: skeleton.Recognition, vrm: boolean, had: ReadonlySet<string>): CharacterReport {
  const frame = skeleton.restFrame(sk, rec), head = new Map(sk.bones.map((b) => [b.name, b.head!])), lengths: Record<string, number> = {};
  for (const [h, [a, b]] of Object.entries(SEGMENTS)) {
    const to = b.find((x) => rec.bones[x]);
    if (!rec.bones[a] || !to) continue;
    const p = head.get(rec.bones[a]!)!, q = head.get(rec.bones[to]!)!;
    lengths[h] = Math.round(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * 1000);
  }
  const patch: MappingPatch = { bones: { ...rec.bones, ...Object.fromEntries(rec.missing.map((b) => [b, null])) } };
  const L = (s: string) => `${lengths[`left${s}`] ?? "?"}/${lengths[`right${s}`] ?? "?"}`, un = rec.unmapped, candidates = candidatesOf(sk, rec, had);
  const how = vrm ? "by its VRM humanoid" : rec.method === "table" ? `by name (${rec.table})` : rec.method === "topology" ? "by topology (names matched no table)" : "not at all";
  const lines = [
    `${name}: ${count(sk.bones.length, "bone")}, recognized ${how}, confidence ${rec.confidence.toFixed(2)}`,
    `rest: ${frame.kind}, the arms ${Math.round(frame.armDrop)}° below level`,
    `mapped: ${count(Object.keys(rec.bones).length, "humanoid bone")}, ${skeleton.REQUIRED_BONES.length - rec.missing.length} of the ${skeleton.REQUIRED_BONES.length} required; ${count(un.length, "source bone")} unmapped`,
    ...(un.length ? [cut(`unmapped: ${un.slice(0, 6).join(", ")}${un.length > 6 ? ", ..." : ""}`)] : []),
    cut(`missing: ${rec.missing.length ? rec.missing.map((h) => (candidates[h]![0] ? `${h} (${candidates[h]![0]}?)` : h)).join(", ") : "none"}`),
    ...rec.issues.slice(0, 5).map((x) => `issue: ${cut(x)}`),
    ...(rec.issues.length > 5 ? [`... ${rec.issues.length - 5} more issues`] : []),
    `lengths (mm, left/right): upper arm ${L("UpperArm")}, forearm ${L("LowerArm")}, thigh ${L("UpperLeg")}, shin ${L("LowerLeg")}`,
    rec.missing.length ? `patch: write each missing bone's source bone into "bones" (now null) and pass it back as mapping`
      : rec.issues.some((i) => i !== "patched by hand" && !meshIssue(i)) ? "patch: check the issues above; edit the patch and pass it back as mapping"
      : rec.issues.some(meshIssue) ? `patch: none clears the mesh's ${rec.issues.filter(meshIssue).length > 1 ? "issues" : "issue"}; ${[...new Set(rec.issues.filter(meshIssue).map(mend))].join("; ")}`
      : `patch: none needed; to change a bone, pass mapping {bones: {humanoidBone: "sourceBone"}}`,
  ];
  return { bones: sk.bones.length, method: rec.method, table: rec.table, vrm, confidence: rec.confidence, missing: rec.missing, candidates, unmapped: un, issues: rec.issues, rest: { kind: frame.kind, armDrop: frame.armDrop }, lengths, patch, text: lines.join("\n") };
}

// Characters for the tools (WP-7.2b b0): a character's bytes read by the Node host as text is, confined to the working
// directory (R6), a file past io's size limit refused unread; the tiny rig equal to the conformance skeleton (B1),
// frozen; a character bound through io and core, never three.js: .gltf text and .glb bytes alike, tiny as tier 1b's
// rig.gltf, each bone's rest orientation as read, a patch unmapping or swapping bones, a misspelt bone named with the
// closest, a file that is no character, a chain with no humanoid, too many bones and too long a chain refused; the
// soles' end bones (D49) put Rigify, every generated character, one with its mesh under its turned, moved and scaled
// armature (the mesh node's transform ignored, as three ignores it), one beside a bigger skin no mesh uses, a skinned
// VRM (three given its humanoid), the real rigs when fetched (KayKit's knight, G4's held-out orangejuice-male-base and
// talkinghead-mpfb, each skipped visibly when not) and a quantized mesh (KHR_mesh_quantization's shorts) at three's
// bind's rest points, hip height and end bones exactly; an end bone's name the file already has made unique; a foot
// whose last bone keeps a child gets none, as in three's bind; a mesh io can't read said: compressed (no soles), the
// soles' positions (sparse, the hips then low), or weights broken (in a hat that skins no foot, the soles still read;
// in the body, both said), the patch line saying what re-exporting mends in each; bones of no usable length (all at
// one point, scaled to 0 or past a double, io naming a bone whose head overflows) refused, not taken for wrong hips;
// each missing bone's likely source bones in their order (the hips' own bone before the root, the head's before the
// neck's, a clavicle-less rig's upper arm before its forearm); a VRM's humanoid, 1.0's or 0.x's, mapping bones no table
// names, a required bone it leaves out said with how it was found (V1).
import { readFileSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recognize, type Bound } from "@m3a/core";
import { gltfToGlb, LIMITS, packGlb, parseGlb, parseGltf, skeletonOfGltf, type GltfSkeleton } from "@m3a/io";
import { bind as threeBind } from "@m3a/three";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { defineTool, Registry, type Host, type ToolContext } from "../src/registry/index.ts";
import { bodyOf, CHARACTER, characterOf, MAPPING, TINY, vrmMapping, type MappingPatch } from "../src/tools/body.ts";
import { rigSkeleton } from "../../../spec/conformance/runner/skeleton.ts";
import { rigBytes, type Manifest } from "../../../tools/fixtures/fixtures.ts";
import { character, loadGlb, TEST_SEEDS, variant } from "../../three/test-characters/index.ts";
import { exampleCwd } from "./helpers/surfaces.ts";

/** demo.body: a character bound (bodyOf with `bound`), its report and rest as data; findings while it is unbound. */
const body = defineTool({
  name: "demo.body",
  description: "Bind a character.",
  params: { type: "object", properties: { character: CHARACTER, mapping: MAPPING, bound: { type: "boolean" } }, required: ["character"] },
  examples: [{ args: { character: "tiny" } }],
  async run(a: { character: string; mapping?: MappingPatch; bound?: boolean }, ctx) {
    const c = await (a.bound ? bodyOf : characterOf)(ctx, a.character, a.mapping), { text, ...report } = c.report;
    return { verdict: text.split("\n")[0]!, data: { ...report, H0: c.bound?.rest.H0 ?? null, restPts: c.bound ? [...c.bound.restPts] : null }, lines: text.split("\n"), findings: !c.bound, next: "retarget.inspect" };
  },
});
const RIG = "spec/vectors/tier1b/rig.gltf", RIGIFY = "spec/vectors/tier1b/rigify.gltf";
/** Calls demo.body in a fresh working directory holding `files` beside the seeded ones; `host` replaces the Node host. */
async function bodies(files: Record<string, string | Uint8Array>, calls: object[], host?: (h: Host) => Host) {
  const { cwd, rm } = exampleCwd(), reg = new Registry([body]);
  try {
    for (const [f, d] of Object.entries(files)) writeFileSync(join(cwd, f), d);
    const h = nodeHost(cwd);
    return await Promise.all(calls.map((args) => reg.call("demo.body", args, { host: host ? host(h) : h })));
  } finally {
    rm();
  }
}
const rigText = (f: string) => readFileSync(join(import.meta.dirname, "../../..", f), "utf8");
/** A context that reads one character file, whatever its name. */
const holding = (glb: Uint8Array, text = "") => ({ bytes: async () => glb, read: async () => text }) as unknown as ToolContext;
/** G4's held-out rig of run `n` (bench/results/heldout/G4/run-n/rig.json): its bytes when fetched, else null. */
const heldOut = (id: string, n: number) => rigBytes(id, JSON.parse(rigText(`bench/results/heldout/G4/run-${n}/rig.json`)) as Manifest);
/** Generated character `seed` with its mesh moved under its armature (Blender's usual layout), the armature turned a
 *  quarter about +y and moved, its scale kept (seed 1's is 0.01): the mesh node's own transform is then the armature's.
 *  Seed 1's toe tips have no two vertices equally far across the ground (a tie io and three break by float noise). */
function underArmature(seed: number): Uint8Array {
  const doc = parseGlb(character(variant(seed)).glb), J = structuredClone(doc.json), nodes = J.nodes!, body = nodes.findIndex((n) => n.mesh !== undefined), arm = nodes.findIndex((n) => n.name === "Armature");
  nodes[arm] = { ...nodes[arm]!, rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2], translation: [0.3, -1, 0.2], children: [...nodes[arm]!.children!, body] };
  (J as { scenes: { nodes: number[] }[] }).scenes[0]!.nodes = [arm];
  return packGlb(J, doc.bin!.raw());
}
/** Generated character `seed` (one mesh, one skin) with its positions quantized to normalized shorts (KHR_mesh_quantization,
 *  as gltf-transform's quantize writes them, 8 bytes a vertex), their scale folded into the inverse bind matrices; or
 *  `sparse`, its positions said again for the first vertex by a sparse block (valid glTF, three reads it; io doesn't);
 *  or a `hat`, a mesh more that a skin of the head alone skins, its weights' count past their buffer (broken: three's
 *  loader refuses the file); or a skin of 30 more nodes that no mesh uses (`unused`). */
function repacked(seed: number, how: "short" | "sparse" | "hat" | "unused"): Uint8Array {
  const doc = parseGlb(character(variant(seed)).glb), J = structuredClone(doc.json), raw = doc.bin!.raw(), acc = J.accessors!, views = J.bufferViews!, more: Uint8Array[] = [];
  const floats = (i: number) => new Float32Array(raw.slice(views[acc[i]!.bufferView!]!.byteOffset ?? 0, (views[acc[i]!.bufferView!]!.byteOffset ?? 0) + views[acc[i]!.bufferView!]!.byteLength).buffer);
  let at = raw.length;
  const view = (bytes: Uint8Array, stride?: number) => {
    views.push({ buffer: 0, byteOffset: at, byteLength: bytes.length, ...(stride ? { byteStride: stride } : {}) });
    more.push(bytes);
    at += bytes.length;
    return views.length - 1;
  };
  const pos = J.meshes![0]!.primitives[0]!.attributes.POSITION!, P = floats(pos), n = P.length / 3, scene = (J as { scenes: { nodes: number[] }[] }).scenes[0]!.nodes;
  if (how === "short") {
    const S = P.reduce((m, x) => Math.max(m, Math.abs(x)), 0), q = new Int16Array(4 * n), ibm = J.skins![0]!.inverseBindMatrices!, M = floats(ibm);
    for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) q[4 * v + k] = Math.round((P[3 * v + k]! / S) * 32767);
    for (let m = 0; m < M.length; m += 16) for (let k = 0; k < 12; k++) M[m + k]! *= S;
    const bound = (f: (...x: number[]) => number) => [0, 1, 2].map((k) => f(...Array.from({ length: n }, (_, v) => q[4 * v + k]!)));
    acc[pos] = { bufferView: view(new Uint8Array(q.buffer), 8), componentType: 5122, normalized: true, count: n, type: "VEC3", min: bound(Math.min), max: bound(Math.max) } as (typeof acc)[number];
    acc[ibm] = { ...acc[ibm]!, bufferView: view(new Uint8Array(M.buffer)) };
    Object.assign(J, { extensionsUsed: ["KHR_mesh_quantization"], extensionsRequired: ["KHR_mesh_quantization"] });
  } else if (how === "sparse") acc[pos] = { ...acc[pos]!, sparse: { count: 1, indices: { bufferView: view(new Uint8Array(4)), componentType: 5121 }, values: { bufferView: view(new Uint8Array(P.slice(0, 3).buffer)) } } } as (typeof acc)[number];
  else if (how === "hat") {
    const a = J.meshes![0]!.primitives[0]!.attributes, head = character(variant(seed)).bones.find((b) => b.humanoid === "head")!.name;
    acc.push({ ...acc[a.WEIGHTS_0!]!, count: 2 * n });
    J.meshes!.push({ primitives: [{ attributes: { POSITION: pos, JOINTS_0: a.JOINTS_0!, WEIGHTS_0: acc.length - 1 } }] });
    J.skins!.push({ joints: [J.nodes!.findIndex((x) => x.name === head)] });
    scene.push(J.nodes!.push({ name: "Hat", mesh: J.meshes!.length - 1, skin: J.skins!.length - 1 }) - 1);
  } else {
    const chain = Array.from({ length: 30 }, (_, i) => J.nodes!.length + i);
    J.nodes!.push(...chain.map((i, k) => ({ name: `chain${k}`, ...(k < 29 ? { children: [i + 1] } : {}) })));
    J.skins!.push({ joints: chain });
    scene.push(chain[0]!);
  }
  const bin = new Uint8Array(at);
  bin.set(raw);
  more.reduce((o, b) => (bin.set(b, o), o + b.length), raw.length);
  return packGlb(J, bin);
}
/** Generated character `seed` as a VRM 1.0: every node renamed J_<node>, past every name table, its humanoid said in
 *  VRMC_vrm; and that humanoid, each bone's node. */
function asVrm(seed: number): [Uint8Array, Record<string, number>] {
  const { glb, bones } = character(variant(seed)), doc = parseGlb(glb), J = structuredClone(doc.json), nodes = J.nodes!;
  const human = Object.fromEntries(bones.filter((b) => b.humanoid).map((b) => [b.humanoid!, nodes.findIndex((x) => x.name === b.name)]));
  nodes.forEach((x, i) => (x.name = `J_${i}`));
  J.extensions = { ...J.extensions, VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones: Object.fromEntries(Object.entries(human).map(([h, node]) => [h, { node }])) } } };
  return [packGlb(J, doc.bin!.raw()), human];
}
/** A bound body's end bones (D49's), by name. */
const endsOf = (b: Bound) => b.skeleton.bones.filter((x) => x.name.endsWith("_end")).map((x) => x.name);
/** A bone's name as three.js gives it (PropertyBinding.sanitizeNodeName). */
const threeName = (n: string) => n.replace(/\s/g, "_").replace(/[[\].:/]/g, "");
/** characterOf's body beside three's bind's, on the same bytes: H0, the end bones (by three's names), and whether every
 *  rest point is within 1e-3 mm of three's. A VRM's `human` (asVrm's) is given three as three-vrm gives it. */
async function parity(glb: Uint8Array, human?: Record<string, number>): Promise<[unknown[], unknown[]]> {
  const c = (await characterOf(holding(glb), human ? "c.vrm" : "c.glb")).bound!, { scene } = await loadGlb(glb, { textures: false });
  if (human) scene.userData.vrm = { humanoid: { humanBones: Object.fromEntries(Object.entries(human).map(([h, n]) => [h, { node: scene.getObjectByName(`J_${n}`) }])) } };
  const t = threeBind(scene).core;
  return [[c.rest.H0, endsOf(c).map(threeName), Math.max(...c.restPts.map((v, i) => Math.abs(v - t.restPts[i]!))) < 1e-3], [t.rest.H0, endsOf(t), true]];
}

describe("a character's bytes (R6)", () => {
  it("reads a binary file under the working directory, refused out of it, through a link or missing; a host without bytes refuses", async () => {
    const { cwd, rm } = exampleCwd(false), out = exampleCwd(false), glb = gltfToGlb(rigText(RIGIFY)), host = nodeHost(cwd);
    try {
      writeFileSync(join(cwd, "rigify.glb"), glb);
      writeFileSync(join(out.cwd, "x.glb"), glb);
      symlinkSync(join(out.cwd, "x.glb"), join(cwd, "link.glb"));
      expect(await host.bytes!("rigify.glb")).toEqual(glb);
      for (const bad of ["../x.glb", join(out.cwd, "x.glb"), "link.glb", "nope.glb"]) await expect(host.bytes!(bad), bad).rejects.toMatchObject({ code: "E_PATH", usage: true });
      // a file a byte past io's limit (sparse: nothing written) refused before it is read, as io would refuse it read
      writeFileSync(join(cwd, "huge.glb"), "");
      truncateSync(join(cwd, "huge.glb"), LIMITS.file + 1);
      await expect(host.bytes!("huge.glb")).rejects.toMatchObject({ code: "E_LIMIT", usage: false, message: `huge.glb: ${LIMITS.file + 1} bytes, over the ${LIMITS.file}-byte limit` });
    } finally {
      rm();
      out.rm();
    }
    // the path named as prose names a file: as given, quoted where a shell would split it, an absolute one "the file"
    const hostless = await bodies({ "rigify.glb": glb }, ["rigify.glb", "my rig.glb", "/abs/rig.glb"].map((character) => ({ character })), (h) => ({ read: h.read }));
    expect(hostless.map((r) => r.error)).toEqual(["(rigify.glb)", "('my rig.glb')", "(the file)"].map((p) => ({ code: "E_HOST", message: `this surface opens no binary files ${p}; run it through m3a (the CLI or MCP) or the API with a Node host` })));
  });
});

describe("characters bound through core", () => {
  it("has the tiny rig as the conformance skeleton, frozen, bound as tier 1b's rig.gltf is", async () => {
    expect(TINY).toEqual(rigSkeleton());
    expect([TINY, TINY.bones, TINY.up, ...TINY.bones.flatMap((b) => [b, b.head])].every((x) => Object.isFrozen(x))).toBe(true);
    const [tiny, rig] = await bodies({}, [{ character: "tiny" }, { character: RIG }]);
    expect([tiny!.status, tiny!.data]).toEqual(["ok", rig!.data]);
    expect(tiny!.data).toMatchObject({ bones: 34, table: "unreal4", confidence: 1, missing: [], unmapped: ["root", "head_leaf", "ball_leaf_l", "ball_leaf_r"], rest: { kind: "T", armDrop: 0 } });
  });
  it("binds the Rigify rig from .gltf text and .glb bytes alike: by name, sure, at rest T, its limbs measured", async () => {
    const [gltf, glb] = await bodies({ "rigify.glb": gltfToGlb(rigText(RIGIFY)) }, [{ character: RIGIFY }, { character: "rigify.glb" }]);
    expect([glb!.status, glb!.data, glb!.lines.slice(1)]).toEqual(["ok", gltf!.data, gltf!.lines.slice(1)]);
    expect(glb!.data).toMatchObject({ bones: 31, method: "table", table: "rigify", vrm: false, confidence: 1, missing: [], unmapped: ["root"], issues: [], rest: { kind: "T", armDrop: 2 }, H0: 930.35 });
    expect(glb!.verdict).toBe("rigify.glb: 31 bones, recognized by name (rigify), confidence 1.00");
    expect(glb!.lines).toContain("lengths (mm, left/right): upper arm 280/280, forearm 250/250, thigh 430/430, shin 420/420");
    // each bone's rest orientation as io read it; the soles' end bones unturned
    const c = await characterOf(holding(new Uint8Array(), rigText(RIGIFY)), RIGIFY);
    expect(c.bound!.restWorld).toEqual({ ...skeletonOfGltf(parseGltf(rigText(RIGIFY))).restWorld, "DEF-toe.L_end": [0, 0, 0, 1], "DEF-toe.R_end": [0, 0, 0, 1] });
    // an end bone's name a bone of the file already has (its root renamed so): the end bone's made unique
    const json = JSON.parse(rigText(RIGIFY)) as { nodes: { name: string }[] };
    json.nodes.find((n) => n.name === "root")!.name = "DEF-toe.L_end";
    const taken = (await characterOf(holding(new Uint8Array(), JSON.stringify(json)), "r.gltf")).bound!;
    expect([taken.skeleton.bones.slice(-2).map((b) => b.name), taken.rest.H0]).toEqual([["DEF-toe.L_end_", "DEF-toe.R_end"], 930.35]);
  });
  it("stands each foot that ends with no child on an end bone where its mesh ends (D49), at three's bind's rest exactly", async () => {
    const glbs: [string, Uint8Array][] = [["rigify", gltfToGlb(rigText(RIGIFY))], ...TEST_SEEDS.map((s): [string, Uint8Array] => [`seed ${s}`, character(variant(s)).glb]), ["seed 1 under its armature", underArmature(1)],
      ["seed 1 beside a bigger skin no mesh uses", repacked(1, "unused")]];
    for (const [id, glb] of glbs) {
      const [got, want] = await parity(glb);
      expect(got, id).toEqual(want);
    }
  });
  for (const [id, bytes] of [["kaykit-knight", () => rigBytes("kaykit-knight")], ["orangejuice-male-base", () => heldOut("orangejuice-male-base", 1)], ["talkinghead-mpfb", () => heldOut("talkinghead-mpfb", 2)]] as const) {
    it(`stands ${id} on its soles' end bones at three's bind's rest exactly`, async (ctx) => {
      const glb = bytes();
      if (!glb) return ctx.skip(`${id} isn't fetched: npm run fixtures -- fetch`);
      const [got, want] = await parity(glb);
      expect(got).toEqual(want);
    });
  }
  it("reads a quantized mesh's positions (KHR_mesh_quantization's normalized shorts) for its soles, as three's bind does", async () => {
    const glb = repacked(1, "short"), [got, want] = await parity(glb);
    expect([got, (await characterOf(holding(glb), "q.glb")).report.issues]).toEqual([want, []]);
    expect(want[1]).toHaveLength(2);
  });
  it("binds a skinned VRM, its humanoid naming every bone, on its soles' end bones at three's bind's rest (three-vrm's humanoid given)", async () => {
    const [vrm, human] = asVrm(1), [got, want] = await parity(vrm, human);
    expect([got, (await characterOf(holding(vrm), "c.vrm")).report]).toMatchObject([want, { vrm: true, confidence: 1, issues: [] }]);
    expect(want[1]).toHaveLength(2);
  });
  it("says when a mesh can't be read: the soles' (a sparse position) leaves no end bones, the hips low; a hat's, the weights", async () => {
    const plain = (await characterOf(holding(character(variant(1)).glb), "c.glb")).bound!, c = await characterOf(holding(repacked(1, "sparse")), "s.glb");
    expect([c.report.issues, endsOf(c.bound!), endsOf(plain).length]).toEqual([["sole end bones unread: accessor 0 is sparse, which isn't read; the hips may sit 10-40 mm low"], [], 2]);
    expect([c.bound!.rest.H0, plain.rest.H0]).toEqual([1006.71, 1046.71]);
    expect(c.report.text).toContain("issue: sole end bones unread: accessor 0 is sparse");
    // a hat that skins the head alone, its weights past their buffer: every joint kept, and said; the soles read still
    const hat = await characterOf(holding(repacked(1, "hat")), "h.glb");
    expect([hat.report.issues[0], endsOf(hat.bound!), hat.bound!.rest.H0]).toEqual(["mesh unreadable: weights unread, every joint kept", endsOf(plain), plain.rest.H0]);
    // compressed: neither weights nor positions read, said once; the body's own weights broken: both said
    const doc = parseGlb(character(variant(1)).glb), w = doc.json.meshes![0]!.primitives[0]!.attributes.WEIGHTS_0!;
    const as = (json: object) => characterOf(holding(packGlb({ ...doc.json, ...json }, doc.bin!.raw())), "m.glb");
    const packed = await as({ extensionsRequired: ["EXT_meshopt_compression"] }), broken = await as({ accessors: doc.json.accessors!.map((a, i) => (i === w ? { ...a, count: 2 * a.count } : a)) });
    expect([packed.report.issues, endsOf(packed.bound!)]).toEqual([["mesh compressed (EXT_meshopt_compression): weights and soles unread; every joint kept"], []]);
    expect([broken.report.issues.map((i) => i.split(":")[0]), endsOf(broken.bound!)]).toEqual([["mesh unreadable", "sole end bones unread"], []]);
    // the patch line: no patch clears a mesh's issue, and what re-exporting the mesh mends for each
    const patchLine = (x: { report: { text: string } }) => x.report.text.split("\n").at(-1), mend = "patch: none clears the mesh's issue; ", weights = "re-export it so io can read its weights (as is, every joint is kept)";
    expect([c, hat, packed, broken].map(patchLine)).toEqual([`${mend}re-export it so io can read it, for exact soles`, `${mend}${weights}`, `${mend}re-export it uncompressed for exact soles`,
      `patch: none clears the mesh's issues; ${weights}; re-export it so io can read it, for exact soles`]);
  });
  it("refuses bones of no usable length (all at one point, scaled to 0 or past a double), not taking them for wrong hips", async () => {
    const rig = JSON.parse(rigText(RIG)) as { nodes: { name: string; translation?: number[] }[] }, scaled = (s: number, at = /^root$/) => rig.nodes.map((n) => (at.test(n.name) ? { ...n, scale: [s, s, s] } : n));
    const of = (nodes: object[]) => characterOf(holding(new Uint8Array(), JSON.stringify({ ...rig, animations: undefined, nodes })), "c.gltf").catch((e: unknown) => e);
    const said = { code: "E_RIG", message: "c.gltf: can't bind it: bones of no usable length (every node at one point, or scaled to 0 or out of range); check the file's node transforms" };
    // a head past a double (a forearm and a hand each scaled 1e300: a finger 1e600 times its offset away) is io's
    // refusal, naming the bone
    const over = { code: "E_RIG", message: "c.gltf: bone index_01_l's rest head isn't finite: the node transforms down to it overflow" };
    expect(await Promise.all([of(rig.nodes.map(({ translation: _, ...n }) => n)), of(scaled(0)), of(scaled(1e300)), of(scaled(1e300, /^(lowerarm|hand)_l$/))])).toMatchObject([said, said, said, over]);
  });
  it("gives no end bone to a foot whose last bone keeps a child (its toes unmapped), as three's bind does", async () => {
    const glb = character(variant(0)).glb, mapping = { bones: { leftToes: null } };
    const c = (await characterOf(holding(glb), "c.glb", mapping)).bound!, t = threeBind((await loadGlb(glb, { textures: false })).scene, { mapping }).core;
    expect([endsOf(c), c.rest.H0, Math.max(...c.restPts.map((v, i) => Math.abs(v - t.restPts[i]!))) < 1e-3]).toEqual([["rightToes_end"], t.rest.H0, true]);
    expect(endsOf(t)).toEqual(endsOf(c));
  });
  it("says when a compressed mesh leaves its weights unread: every joint kept, no soles", async (ctx) => {
    const glb = rigBytes("quaternius-mannequin-m");
    if (!glb) return ctx.skip("quaternius-mannequin-m isn't fetched: npm run fixtures -- fetch");
    const c = await characterOf(holding(glb), "m.glb");
    expect([c.report.issues[0], c.report.bones, c.bound!.skeleton.bones.length]).toEqual(["mesh compressed (EXT_meshopt_compression): weights and soles unread; every joint kept", 65, 65]);
    expect(c.report.text).toContain("issue: mesh compressed (EXT_meshopt_compression)");
  });
  it("takes a patch: a bone unmapped leaves it unbound (bodyOf refuses, naming it); swapped arms bind, the issue named", async () => {
    const swap = { leftUpperArm: "DEF-forearm.L", leftLowerArm: "DEF-upper_arm.L" }, [plain, gone, need, swapped] = await bodies({}, [
      { character: RIGIFY }, { character: RIGIFY, mapping: { bones: { leftUpperLeg: null } } }, { character: RIGIFY, mapping: { bones: { leftUpperLeg: null } }, bound: true }, { character: RIGIFY, mapping: { bones: swap } }]);
    expect([gone!.status, gone!.data]).toMatchObject(["findings", { missing: ["leftUpperLeg"], patch: { bones: { leftUpperLeg: null } }, H0: null }]);
    expect(gone!.lines).toContain('patch: write each missing bone\'s source bone into "bones" (now null) and pass it back as mapping');
    expect(need!.error).toEqual({ code: "E_RIG", message: `${RIGIFY}: leftUpperLeg not mapped; \`retarget.inspect ${RIGIFY} --mapping '{"bones":{"leftUpperLeg":null}}'\` gives the patch: write each into it and pass it as mapping` });
    expect([swapped!.status, (swapped!.data as { issues: string[] }).issues]).toEqual(["ok", ["patched by hand", "leftLowerArm (DEF-upper_arm.L) does not descend from leftUpperArm (DEF-forearm.L)"]]);
    // the report's patch passed back binds as recognized
    const [back] = await bodies({}, [{ character: RIGIFY, mapping: (plain!.data as { patch: MappingPatch }).patch }]);
    expect((back!.data as { restPts: number[] }).restPts).toEqual((plain!.data as { restPts: number[] }).restPts);
  });
  it("names each missing bone's likely source bones, the likeliest first: the hips' own bone, the head's, a clavicle-less rig's upper arm", async () => {
    // tier 1b's rig without its clavicles (each upper arm under spine_03): no shoulder stands between its arm and chest
    const rig = JSON.parse(rigText(RIG)) as { nodes: { name: string; children?: number[] }[] }, clav = (i: number) => rig.nodes[i]!.name.startsWith("clavicle");
    const keep = rig.nodes.flatMap((_, i) => (clav(i) ? [] : [i])), at = new Map(keep.map((i, k) => [i, k]));
    const bare = { ...rig, animations: undefined, nodes: keep.map((i) => ({ ...rig.nodes[i]!, ...(rig.nodes[i]!.children ? { children: rig.nodes[i]!.children!.flatMap((c) => (clav(c) ? rig.nodes[c]!.children! : [c])).map((c) => at.get(c)!) } : {}) })) };
    const of = async (text: string, bones: MappingPatch["bones"]) => (await characterOf(holding(new Uint8Array(), text), "c.gltf", { bones })).report.candidates;
    expect(await Promise.all([of(rigText(RIGIFY), { hips: null }), of(rigText(RIG), { hips: null }), of(rigText(RIG), { neck: null, head: null }), of(JSON.stringify(bare), { leftUpperArm: null, leftLowerArm: null })])).toEqual([
      { hips: ["DEF-hips", "root"] }, { hips: ["pelvis", "root"] }, { head: ["Head", "neck_01", "head_leaf"] }, { leftUpperArm: ["upperarm_l", "lowerarm_l"], leftLowerArm: ["lowerarm_l", "upperarm_l"] },
    ]);
  });
  it("refuses a misspelt bone with the closest name, a file that is no character or no glTF, a chain with no humanoid, too many bones or too long a chain", async () => {
    const chain = (n: number) => JSON.stringify({ asset: { version: "2.0" }, nodes: Array.from({ length: n }, (_, i) => ({ name: `b${i}`, ...(i < n - 1 ? { children: [i + 1] } : {}) })) });
    // a chain of 4,096 bones, as many as a character may have: core's recognition by shape runs out of stack down it
    const got = await bodies({ "chain.gltf": chain(3), "long.gltf": chain(4097), "deep.gltf": chain(4096), "junk.glb": "this is no binary glTF, only text" }, [{ character: RIGIFY, mapping: { bones: { leftUpperLegg: "x" } } },
      { character: RIGIFY, mapping: { bones: { leftHand: "DEF-hand.l" } } }, { character: "spec/vectors/tier1b/rig-catalog.json" }, { character: "junk.glb" }, { character: "chain.gltf" }, { character: "long.gltf" }, { character: "deep.gltf" }]);
    expect(got.map((r) => [r.status, r.error?.code, r.error?.message])).toEqual([
      ["usage", "E_ARGS", 'mapping: "leftUpperLegg" is not a VRM 1.0 humanoid bone; did you mean "leftUpperLeg"?'],
      ["usage", "E_ARGS", 'mapping: leftHand: the character has no bone "DEF-hand.l"; did you mean "DEF-hand.L"?'],
      ["usage", "E_ARGS", 'spec/vectors/tier1b/rig-catalog.json is not a character: give a .glb, .gltf or .vrm file, or "tiny"'],
      ["error", "E_FORMAT", "junk.glb: not a binary glTF (.glb): its first 4 bytes aren't 'glTF' (at byte 0)"],
      ["error", "E_RIG", 'chain.gltf: no humanoid bone recognized among its 3 bones, by name or by shape; give each bone in mapping {bones: {hips: "<its bone>", ...}}'],
      ["error", "E_LIMIT", "long.gltf: 4097 bones; a character may have at most 4096"],
      ["error", "E_LIMIT", "deep.gltf: a chain of 4096 bones; a character's chains may be at most 1024 bones long"],
    ]);
  });
});

describe("a VRM's humanoid (V1)", () => {
  it("maps bones no table names by the file's own humanoid, before a patch, as the file's word; a required bone it leaves out said", async () => {
    // tier 1b's rig, its bones renamed past every table, and its humanoid said in VRMC_vrm
    const json = JSON.parse(rigText(RIG)) as { nodes: { name: string }[]; extensions?: object }, names = json.nodes.map((n) => n.name);
    const humanBones = Object.fromEntries(Object.entries(recognize(TINY).bones).map(([h, n]) => [h, { node: names.indexOf(n) }])), { leftHand: _, ...noHand } = humanBones;
    // its own names kept, the humanoid without the left hand, which is then found by name
    const named = gltfToGlb(JSON.stringify({ ...json, extensions: { VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones: noHand } } } }));
    json.nodes.forEach((n, i) => (n.name = `J_${i}`));
    const plain = gltfToGlb(JSON.stringify(json));
    json.extensions = { VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones } } };
    const vrmFile = gltfToGlb(JSON.stringify(json));
    json.extensions = { VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones: noHand } } };
    const [tiny, vrm, patched, notVrm, handless, handGiven, byName] = await bodies({ "char.vrm": vrmFile, "plain.glb": plain, "handless.vrm": gltfToGlb(JSON.stringify(json)), "named.vrm": named }, [{ character: "tiny" }, { character: "char.vrm" },
      { character: "char.vrm", mapping: { bones: { leftHand: null } } }, { character: "plain.glb" }, { character: "handless.vrm" }, { character: "handless.vrm", mapping: { bones: { leftHand: "J_11" } } }, { character: "named.vrm" }]);
    expect(vrm!.data).toMatchObject({ vrm: true, confidence: 1, missing: [], issues: [], patch: { bones: Object.fromEntries(Object.entries(humanBones).map(([h, b]) => [h, `J_${b.node}`])) } });
    expect([vrm!.verdict, (vrm!.data as { restPts: number[] }).restPts]).toEqual(["char.vrm: 34 bones, recognized by its VRM humanoid, confidence 1.00", (tiny!.data as { restPts: number[] }).restPts]);
    expect(patched!.data).toMatchObject({ vrm: true, missing: ["leftHand"], issues: ["patched by hand", expect.stringMatching(/^required bones not found: leftHand/)] });
    expect(notVrm!.data).toMatchObject({ vrm: false, method: "topology" });
    // a humanoid without the left hand: bound, the hand found by topology and said so, unless a patch gives it
    expect([handless!.status, (handless!.data as { issues: string[] }).issues, (handGiven!.data as { issues: string[] }).issues]).toEqual(["ok", ["leftHand: not in its VRM humanoid; found by topology"], ["patched by hand"]]);
    expect([byName!.status, (byName!.data as { issues: string[] }).issues]).toEqual(["ok", ["leftHand: not in its VRM humanoid; found by name (unreal4)"]]);
  });
  it("reads VRM 0.x's humanoid, its thumbs renamed as 1.0 names them, leaving out what is no humanoid bone or no bone", () => {
    const g = { skeleton: { bones: ["a", "b", "c"].map((name) => ({ name })) }, nodes: [4, 5, 6], restWorld: {} } as GltfSkeleton;
    const humanBones = [{ bone: "hips", node: 4 }, { bone: "leftThumbProximal", node: 5 }, { bone: "leftThumbIntermediate", node: 6 }, { bone: "tail", node: 4 }, { bone: "spine", node: 9 }, null];
    expect(vrmMapping({ extensions: { VRM: { humanoid: { humanBones } } } }, g)).toEqual({ hips: "a", leftThumbMetacarpal: "b", leftThumbProximal: "c" });
    expect([vrmMapping({}, g), vrmMapping({ extensions: { VRMC_vrm: { humanoid: { humanBones: { hips: { node: 6 } } } } } }, g)]).toEqual([null, { hips: "c" }]);
  });
});

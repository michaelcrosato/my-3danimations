// Characters for the tools (WP-7.2b b0): a character's bytes read by the Node host as text is, confined to the working
// directory (R6); the tiny rig equal to the conformance skeleton (B1); a character bound through io and core, never
// three.js: .gltf text and .glb bytes alike, tiny as tier 1b's rig.gltf, a patch unmapping or swapping bones, a misspelt
// bone named with the closest, a file that is no character and a chain with no humanoid refused; a VRM's humanoid,
// 1.0's or 0.x's, mapping bones no table names (V1).
import { readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recognize } from "@m3a/core";
import { gltfToGlb, type GltfSkeleton } from "@m3a/io";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { defineTool, Registry, type Host } from "../src/registry/index.ts";
import { bodyOf, CHARACTER, characterOf, MAPPING, TINY, vrmMapping, type MappingPatch } from "../src/tools/body.ts";
import { rigSkeleton } from "../../../spec/conformance/runner/skeleton.ts";
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

describe("a character's bytes (R6)", () => {
  it("reads a binary file under the working directory, refused out of it, through a link or missing; a host without bytes refuses", async () => {
    const { cwd, rm } = exampleCwd(false), out = exampleCwd(false), glb = gltfToGlb(rigText(RIGIFY)), host = nodeHost(cwd);
    try {
      writeFileSync(join(cwd, "rigify.glb"), glb);
      writeFileSync(join(out.cwd, "x.glb"), glb);
      symlinkSync(join(out.cwd, "x.glb"), join(cwd, "link.glb"));
      expect(await host.bytes!("rigify.glb")).toEqual(glb);
      for (const bad of ["../x.glb", join(out.cwd, "x.glb"), "link.glb", "nope.glb"]) await expect(host.bytes!(bad), bad).rejects.toMatchObject({ code: "E_PATH", usage: true });
    } finally {
      rm();
      out.rm();
    }
    const [r] = await bodies({ "rigify.glb": glb }, [{ character: "rigify.glb" }], (h) => ({ read: h.read }));
    expect(r!.error).toEqual({ code: "E_HOST", message: 'this surface opens no binary files ("rigify.glb"); run it through m3a (the CLI or MCP) or the API with a Node host' });
  });
});

describe("characters bound through core", () => {
  it("has the tiny rig as the conformance skeleton, bound as tier 1b's rig.gltf is", async () => {
    expect(TINY).toEqual(rigSkeleton());
    const [tiny, rig] = await bodies({}, [{ character: "tiny" }, { character: RIG }]);
    expect([tiny!.status, tiny!.data]).toEqual(["ok", rig!.data]);
    expect(tiny!.data).toMatchObject({ bones: 34, table: "unreal4", confidence: 1, missing: [], unmapped: ["root", "head_leaf", "ball_leaf_l", "ball_leaf_r"], rest: { kind: "T", armDrop: 0 } });
  });
  it("binds the Rigify rig from .gltf text and .glb bytes alike: by name, sure, at rest T, its limbs measured", async () => {
    const [gltf, glb] = await bodies({ "rigify.glb": gltfToGlb(rigText(RIGIFY)) }, [{ character: RIGIFY }, { character: "rigify.glb" }]);
    expect([glb!.status, glb!.data, glb!.lines.slice(1)]).toEqual(["ok", gltf!.data, gltf!.lines.slice(1)]);
    expect(glb!.data).toMatchObject({ bones: 31, method: "table", table: "rigify", vrm: false, confidence: 1, missing: [], unmapped: ["root"], issues: [], rest: { kind: "T", armDrop: 2 }, H0: 930 });
    expect(glb!.verdict).toBe("rigify.glb: 31 bones, recognized by name (rigify), confidence 1.00");
    expect(glb!.lines).toContain("lengths (mm, left/right): upper arm 280/280, forearm 250/250, thigh 430/430, shin 420/420");
  });
  it("takes a patch: a bone unmapped leaves it unbound (bodyOf refuses, naming it); swapped arms bind, the issue named", async () => {
    const swap = { leftUpperArm: "DEF-forearm.L", leftLowerArm: "DEF-upper_arm.L" }, [plain, gone, need, swapped] = await bodies({}, [
      { character: RIGIFY }, { character: RIGIFY, mapping: { bones: { leftUpperLeg: null } } }, { character: RIGIFY, mapping: { bones: { leftUpperLeg: null } }, bound: true }, { character: RIGIFY, mapping: { bones: swap } }]);
    expect([gone!.status, gone!.data]).toMatchObject(["findings", { missing: ["leftUpperLeg"], patch: { bones: { leftUpperLeg: null } }, H0: null }]);
    expect(gone!.lines).toContain('patch: write each missing bone\'s source bone into "bones" (now null) and pass it back as mapping');
    expect(need!.error).toEqual({ code: "E_RIG", message: `${RIGIFY}: leftUpperLeg not mapped; retarget.inspect ${RIGIFY} shows the mapping: write each into its patch and pass it as mapping` });
    expect([swapped!.status, (swapped!.data as { issues: string[] }).issues]).toEqual(["ok", ["patched by hand", "leftLowerArm (DEF-upper_arm.L) does not descend from leftUpperArm (DEF-forearm.L)"]]);
    // the report's patch passed back binds as recognized
    const [back] = await bodies({}, [{ character: RIGIFY, mapping: (plain!.data as { patch: MappingPatch }).patch }]);
    expect((back!.data as { restPts: number[] }).restPts).toEqual((plain!.data as { restPts: number[] }).restPts);
  });
  it("refuses a misspelt bone with the closest name, a file that is no character or no glTF, and a chain with no humanoid", async () => {
    const chain = JSON.stringify({ asset: { version: "2.0" }, nodes: [{ name: "a", children: [1] }, { name: "b", children: [2] }, { name: "c" }] });
    const got = await bodies({ "chain.gltf": chain, "junk.glb": "this is no binary glTF, only text" }, [{ character: RIGIFY, mapping: { bones: { leftUpperLegg: "x" } } }, { character: RIGIFY, mapping: { bones: { leftHand: "DEF-hand.l" } } },
      { character: "spec/vectors/tier1b/rig-catalog.json" }, { character: "junk.glb" }, { character: "chain.gltf" }]);
    expect(got.map((r) => [r.status, r.error?.code, r.error?.message])).toEqual([
      ["usage", "E_ARGS", 'mapping: "leftUpperLegg" is not a VRM 1.0 humanoid bone; did you mean "leftUpperLeg"?'],
      ["usage", "E_ARGS", 'mapping: leftHand: the character has no bone "DEF-hand.l"; did you mean "DEF-hand.L"?'],
      ["usage", "E_ARGS", '"spec/vectors/tier1b/rig-catalog.json" is not a character: give a .glb, .gltf or .vrm file, or "tiny"'],
      ["error", "E_FORMAT", "junk.glb: not a binary glTF (.glb): its first 4 bytes aren't 'glTF' (at byte 0)"],
      ["error", "E_RIG", 'chain.gltf: no humanoid bone recognized among its 3 bones, by name or by shape; give each bone in mapping {bones: {hips: "<its bone>", ...}}'],
    ]);
  });
});

describe("a VRM's humanoid (V1)", () => {
  it("maps bones no table names by the file's own humanoid, before a patch, as the file's word rather than a hand patch", async () => {
    // tier 1b's rig, its bones renamed past every table, and its humanoid said in VRMC_vrm
    const json = JSON.parse(rigText(RIG)) as { nodes: { name: string }[]; extensions?: object }, names = json.nodes.map((n) => n.name);
    const humanBones = Object.fromEntries(Object.entries(recognize(TINY).bones).map(([h, n]) => [h, { node: names.indexOf(n) }]));
    json.nodes.forEach((n, i) => (n.name = `J_${i}`));
    const plain = gltfToGlb(JSON.stringify(json));
    json.extensions = { VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones } } };
    const [tiny, vrm, patched, notVrm] = await bodies({ "char.vrm": gltfToGlb(JSON.stringify(json)), "plain.glb": plain }, [{ character: "tiny" }, { character: "char.vrm" }, { character: "char.vrm", mapping: { bones: { leftHand: null } } }, { character: "plain.glb" }]);
    expect(vrm!.data).toMatchObject({ vrm: true, confidence: 1, missing: [], issues: [], patch: { bones: Object.fromEntries(Object.entries(humanBones).map(([h, b]) => [h, `J_${b.node}`])) } });
    expect([vrm!.verdict, (vrm!.data as { restPts: number[] }).restPts]).toEqual(["char.vrm: 34 bones, recognized by its VRM humanoid, confidence 1.00", (tiny!.data as { restPts: number[] }).restPts]);
    expect(patched!.data).toMatchObject({ vrm: true, missing: ["leftHand"], issues: ["patched by hand", expect.stringMatching(/^required bones not found: leftHand/)] });
    expect(notVrm!.data).toMatchObject({ vrm: false, method: "topology" });
  });
  it("reads VRM 0.x's humanoid, its thumbs renamed as 1.0 names them, leaving out what is no humanoid bone or no bone", () => {
    const g = { skeleton: { bones: ["a", "b", "c"].map((name) => ({ name })) }, nodes: [4, 5, 6], restWorld: {} } as GltfSkeleton;
    const humanBones = [{ bone: "hips", node: 4 }, { bone: "leftThumbProximal", node: 5 }, { bone: "leftThumbIntermediate", node: 6 }, { bone: "tail", node: 4 }, { bone: "spine", node: 9 }, null];
    expect(vrmMapping({ extensions: { VRM: { humanoid: { humanBones } } } }, g)).toEqual({ hips: "a", leftThumbMetacarpal: "b", leftThumbProximal: "c" });
    expect([vrmMapping({}, g), vrmMapping({ extensions: { VRMC_vrm: { humanoid: { humanBones: { hips: { node: 6 } } } } } }, g)]).toEqual([null, { hips: "c" }]);
  });
});

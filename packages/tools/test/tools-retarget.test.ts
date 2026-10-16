// The retarget tools (PLAN.md WP-7.2b): each example the same on every surface; retarget.inspect on tier 1b's Rigify
// vector giving its expected mapping (the rig's table, its limb lengths, and every proportion the mapping decides as the
// origin's importer measured them); findings for a bone unmapped (no body, a fill-in call next), swapped arms (bent at
// rest, its turntable attached) and bones named by their shape alone; unmapped bones capped with the shared more; its
// refusals, and no absolute path echoed. retarget.apply judging clips as the sweep does (D80): swapped arms miss their
// points, a body that adds a fail finding, a warn it adds listed, the tiny rig, clips as a path and as JSON named as
// given; its refusals (too many clips or none, a misspelt clip, a character missing a bone). Every next and every
// refusal's call runs as written. One working directory for the file: the tools only read, and write images.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { turntable } from "@m3a/sensors";
import { png } from "@m3a/sensors/node";
import { afterAll, describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { Registry, type Reply, type ToolContext } from "../src/registry/index.ts";
import { characterOf } from "../src/tools/body.ts";
import { RETARGET } from "../src/tools/index.ts";
import { exampleCwd, hintedCalls, ROOT, runExamples } from "./helpers/surfaces.ts";

type Row = Record<string, unknown>;
const RIGIFY = "spec/vectors/tier1b/rigify.gltf", WALK = "QUATERNIUS_3D2DGE/Walk_Loop", SWAP = { bones: { leftUpperArm: "DEF-forearm.L", leftLowerArm: "DEF-upper_arm.L" } };
const text = (f: string) => readFileSync(join(ROOT, f), "utf8"), { cwd, rm } = exampleCwd(), reg = new Registry(RETARGET), host = nodeHost(cwd);
afterAll(rm);
// Rigify with every node renamed past the name tables; tier 1b's rig with 12 more bones; a chain of 3; a clip file
const rigify = JSON.parse(text(RIGIFY)) as { nodes: { name: string }[] }, rig = JSON.parse(text("spec/vectors/tier1b/rig.gltf")) as { nodes: { name: string; children?: number[] }[] };
const extra = Array.from({ length: 12 }, (_, i) => rig.nodes.length + i);
rig.nodes.find((n) => n.name === "root")!.children!.push(...extra);
for (const [f, data] of Object.entries({
  "renamed.gltf": { ...rigify, nodes: rigify.nodes.map((n, i) => ({ ...n, name: `n${i}` })) }, "wide.gltf": { ...rig, nodes: [...rig.nodes, ...extra.map((i) => ({ name: `extra${i}` }))] },
  "chain.gltf": { asset: { version: "2.0" }, nodes: [{ name: "a", children: [1] }, { name: "b", children: [2] }, { name: "c" }] }, "punch.json": JSON.parse(text("library/sets/QUATERNIUS_3D2DGE/Punch_Jab.json")) as object,
})) writeFileSync(join(cwd, f), JSON.stringify(data));
/** Calls a retarget tool on the Node host in the file's working directory; its PNGs go to `pngs`. */
const call = async (tool: string, args: object, pngs?: Map<string, Uint8Array>) => (await reg.call(tool, args, { host, pngs })) as Reply<Row>;
/** A reply's next (or a refusal's message): each call in it, as the m3a command parses it, none with a problem. */
const runs = (hint: string) => hintedCalls(hint).map((h) => (h.problem ? h : { tool: h.tool, args: h.args }));

describe("the retarget tools", () => {
  runExamples(RETARGET);

  it("retarget.inspect gives tier 1b's Rigify its expected mapping: the rig's table, its limbs, every proportion the mapping decides", async () => {
    const v = JSON.parse(text("spec/vectors/tier1b/rigify-expected.json")) as { rig: string; rest: Record<string, unknown> }, r = await call("retarget.inspect", { character: RIGIFY });
    expect([r.status, r.images, r.verdict]).toEqual(["ok", [], `retarget.inspect ${RIGIFY}: 31 bones by name (rigify), confidence 1.00, 15 of 15 required, rest T, hip height 930 mm`]);
    expect(r.data).toMatchObject({ character: RIGIFY, method: "table", table: v.rig, vrm: false, confidence: 1, required: { mapped: 15, of: 15 }, missing: [], unmapped: ["root"], issues: [], rest: { kind: "T", armDrop: 2 }, H0: 930 });
    const limbs = { UpperArm: "up", LowerArm: "fore", UpperLeg: "thigh", LowerLeg: "shin", Foot: "ab" };
    expect(r.data!.lengths).toEqual({ spine: 500, ...Object.fromEntries(["left", "right"].flatMap((s) => Object.entries(limbs).map(([b, k]) => [`${s}${b}`, Math.round(v.rest[k] as number)]))) });
    // the body behind it measures as the importer measured the rig, bit for bit, but for its ground (core's under the
    // lowest foot or toe joint, 19.65 mm above the file's origin, the importer's) and its head's and toes' tips (which
    // core and the importer read by different rules)
    const body = (await characterOf({ read: async () => text(RIGIFY) } as unknown as ToolContext, RIGIFY)).bound!.rest as unknown as Record<string, unknown>;
    const same = ["Pr", "Cr", "hip", "spine", "neckSeg", "clav", "cv", "up", "fore", "knuck", "fist", "thigh", "shin", "ab", "abPitch", "spineW", "neckW"], of = (x: Record<string, unknown>) => JSON.stringify(same.map((k) => x[k]));
    expect(of(body)).toBe(of(v.rest));
    expect([body.H0, body.ankleZ, v.rest.H0, v.rest.ankleZ]).toEqual([930.35, 60.35, 950, 80]);
    expect(runs(r.next)).toEqual([{ tool: "retarget.apply", args: { character: RIGIFY, clips: [WALK] } }]);
    // its patch passed back is no finding: the patch is the only issue
    expect(await call("retarget.inspect", { character: RIGIFY, mapping: r.data!.patch })).toMatchObject({ status: "ok", data: { issues: ["patched by hand"], H0: 930 }, images: [] });
  });

  it("retarget.inspect finds a bone unmapped, swapped arms (their rest in a turntable) and bones named by shape alone; caps unmapped bones", async () => {
    const pngs = new Map<string, Uint8Array>(), gone = await call("retarget.inspect", { character: RIGIFY, mapping: { bones: { leftUpperLeg: null, leftHand: "DEF-hand.L" } } }), swapped = await call("retarget.inspect", { character: RIGIFY, mapping: SWAP }, pngs);
    expect([gone.status, gone.images, gone.verdict]).toEqual(["findings", [], `retarget.inspect ${RIGIFY}: 31 bones by name (rigify), confidence 1.00, 14 of 15 required, rest T`]);
    expect(gone.data).toMatchObject({ missing: ["leftUpperLeg"], required: { mapped: 14, of: 15 }, H0: null, unmapped: ["root", "DEF-thigh.L"], patch: { bones: { leftUpperLeg: null } } });
    expect(runs(gone.next)).toEqual([{ tool: "retarget.inspect", args: { character: RIGIFY, mapping: { bones: { leftUpperLeg: "<its bone>", leftHand: "DEF-hand.L" } } } }]);
    // swapped arms bind, but the forearm reads 530 mm and its rest is bent: four sides of it, ~137 tokens
    expect([swapped.status, swapped.data!.issues, (swapped.data!.lengths as Row).leftLowerArm, swapped.images.map((i) => [i.name, i.width, i.height, i.tokens])]).toEqual(["findings", ["patched by hand", "leftLowerArm (DEF-upper_arm.L) does not descend from leftUpperArm (DEF-forearm.L)"], 530, [["rest", 640, 160, 137]]]);
    const bent = (await characterOf({ read: async () => text(RIGIFY) } as unknown as ToolContext, RIGIFY, SWAP)).bound!;
    expect(Buffer.from([...pngs.values()][0]!).equals(Buffer.from(png(turntable(bent.restPts, { n: 4, size: 160 }))))).toBe(true);
    expect(runs(swapped.next).map((h) => h.tool)).toEqual(["retarget.inspect", "retarget.apply"]);
    const shaped = await call("retarget.inspect", { character: "renamed.gltf" }), wide = await call("retarget.inspect", { character: "wide.gltf" });
    expect([shaped.status, shaped.verdict, shaped.data!.issues, shaped.images.length]).toEqual(["findings", "retarget.inspect renamed.gltf: 31 bones by topology, confidence 0.85, 15 of 15 required, rest T, hip height 930 mm", ["no table matched; mapped by topology from n1"], 1]);
    // its patch passed back confirms what its shape named
    expect(await call("retarget.inspect", { character: "renamed.gltf", mapping: shaped.data!.patch })).toMatchObject({ status: "ok", data: { method: "topology", confidence: 1, issues: ["patched by hand"] } });
    expect([wide.status, wide.data!.unmapped, wide.data!.more]).toEqual(["ok", ["root", "head_leaf", "ball_leaf_l", "ball_leaf_r", ...extra.slice(0, 6).map((i) => `extra${i}`)], { unmapped: 6 }]);
  });

  it("retarget.inspect refuses a misspelt humanoid bone and a chain with no humanoid, and never echoes an absolute path", async () => {
    const [bad, chain, abs, json] = [await call("retarget.inspect", { character: RIGIFY, mapping: { bones: { leftUpperLegg: "DEF-thigh.L" } } }), await call("retarget.inspect", { character: "chain.gltf" }),
      await call("retarget.inspect", { character: join(cwd, RIGIFY) }), await call("retarget.inspect", { character: join(cwd, "punch.json") })];
    expect([bad.status, bad.error]).toEqual(["usage", { code: "E_ARGS", message: 'mapping: "leftUpperLegg" is not a VRM 1.0 humanoid bone; did you mean "leftUpperLeg"?' }]);
    expect([chain.status, chain.error]).toEqual(["error", { code: "E_RIG", message: 'chain.gltf: no humanoid bone recognized among its 3 bones, by name or by shape; give each bone in mapping {bones: {hips: "<its bone>", ...}}' }]);
    expect([abs.verdict, abs.lines[0], abs.next]).toEqual([expect.stringMatching(/^retarget.inspect <the character's file>: 31 bones/), "rest: T, the arms 2° below level", expect.stringMatching(/^`retarget.apply <the character's file> --clips /)]);
    expect([json.error, [abs, json].map((r) => JSON.stringify(r).includes(cwd))]).toEqual([{ code: "E_ARGS", message: `<the character's file> is not a character: give a .glb, .gltf or .vrm file, or "tiny"` }, [false, false]]);
  });

  it("retarget.apply judges clips as the sweep does (D80): swapped arms miss their points; a body adding a fail, or a warn; clips named as given", async () => {
    const swapped = await call("retarget.apply", { character: RIGIFY, clips: [WALK], mapping: SWAP });
    expect([swapped.status, swapped.data!.mapped, swapped.data!.clips, swapped.lines]).toEqual(["findings", "patched", [{ clip: WALK, ok: false, own: "warn", played: "pass", reach: 833, why: ["a joint 833 mm from its point at 0.30 s (at most 5)"], worse: [] }],
      [`FAIL ${WALK}: a joint 833 mm from its point at 0.30 s (at most 5)`]]);
    expect(runs(swapped.next)).toEqual([{ tool: "retarget.inspect", args: { character: RIGIFY, mapping: SWAP } }]);
    // rigify's arms go into its body kneeling, as the clip's own body's don't: a fail it adds; a jab's jitter past its warn level
    const body = await call("retarget.apply", { character: RIGIFY, clips: ["MESH2MOTION/Kneeling_Tired", "QUATERNIUS_3D2DGE/Punch_Cross"] });
    expect([body.status, body.verdict, body.data!.mapped, body.data!.passed, body.data!.failed]).toEqual(["findings", `retarget.apply ${RIGIFY}: 1 of 2 clips passes on it (hip height 930 mm)`, "recognized", 1, 1]);
    expect(body.data!.clips).toMatchObject([{ ok: false, why: [expect.stringMatching(/^bodyPenetration 0\.0 on its own body → 61\.2 played on this one/)], worse: [{ metric: "bodyPenetration", level: "fail", own: 0, played: 61.2 }] }, { ok: true, why: [], worse: [{ metric: "jitter", level: "warn" }] }]);
    expect([body.lines[1], runs(body.next)]).toEqual(["PASS QUATERNIUS_3D2DGE/Punch_Cross: own pass, played warn, reach 0 mm; this body adds a warn: jitter", [{ tool: "search", args: { query: "Kneeling Tired" } }]]);
    // the tiny rig plays a clip file and a clip's JSON; the next names them as given
    const tiny = await call("retarget.apply", { character: "tiny", clips: ["punch.json", text("library/sets/QUATERNIUS_3D2DGE/Walk_Loop.json")] });
    expect([tiny.status, tiny.verdict, tiny.lines.map((l) => l.split(":")[0])]).toEqual(["ok", "retarget.apply tiny: 2 of 2 clips pass on it (hip height 950 mm)", ["PASS punch.json", `PASS ${WALK} (the clip's JSON)`]]);
    expect(runs(tiny.next)).toEqual([{ tool: "license.check", args: { clips: ["punch.json", "<the clip's JSON>"] } }]);
  });

  it("retarget.apply refuses too many clips or none, a misspelt clip before any plays, and a character missing a bone (E_RIG, its call to make)", async () => {
    const got = [await call("retarget.apply", { character: RIGIFY, clips: Array(21).fill(WALK) }), await call("retarget.apply", { character: RIGIFY, clips: [] }), await call("retarget.apply", { character: RIGIFY, clips: [WALK, "QUATERNIUS_3D2DGE/Walk_Lop"] }),
      await call("retarget.apply", { character: RIGIFY, clips: [WALK], mapping: { bones: { leftUpperLeg: null } } })];
    expect(got.map((r) => [r.status, r.error])).toEqual([
      ["usage", { code: "E_ARGS", message: "clips lists 21 clips; give 1 to 20, and call again for more" }], ["usage", { code: "E_ARGS", message: "clips lists 0 clips; give 1 to 20, and call again for more" }],
      ["usage", { code: "E_NO_CLIP", message: 'no clip "QUATERNIUS_3D2DGE/Walk_Lop"; did you mean "QUATERNIUS_3D2DGE/Walk_Loop"?' }],
      ["error", { code: "E_RIG", message: `${RIGIFY}: leftUpperLeg not mapped; \`retarget.inspect ${RIGIFY} --mapping '{"bones":{"leftUpperLeg":null}}'\` gives the patch: write each into it and pass it as mapping` }],
    ]);
    for (const hint of [got[3]!.error!.message, got[3]!.next]) expect(runs(hint)).toEqual([{ tool: "retarget.inspect", args: { character: RIGIFY, mapping: { bones: { leftUpperLeg: null } } } }]);
  });
});

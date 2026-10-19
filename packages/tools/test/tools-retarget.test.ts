// The retarget tools (PLAN.md WP-7.2b): each example the same on every surface; retarget.inspect on tier 1b's Rigify
// vector giving its expected mapping (the rig's table, its limb lengths, and every proportion the mapping decides as
// the origin's importer measured them); findings for a bone unmapped (no body, its likely bone named though the
// unmapped bones' cap cuts it, a fill-in call next), swapped arms (bent at rest, its turntable attached), hips on the
// rig's root and bones named by their shape alone; its refusals, and no absolute path echoed. retarget.apply judging
// clips as the sweep does (D80): swapped arms miss their points (inspect's issue a warning), hips on the root (that
// issue the next call; a row's reasons capped), a body that adds a fail finding (its frames drawn, its line first), a
// warn it adds listed, a VRM's humanoid, the tiny rig, clips as a path and as JSON named as given; its refusals (too
// many clips or none, misspelt clips before any plays, clips past 600 s in all, a character missing a bone, a patch
// leaving two humanoid bones on one source bone; a metric that is no finite number written so, and null in data). A
// compressed mesh is said by both, but is no mapping issue (meshIssue): no finding, turntable, patch hint or warning of
// its own. A clip holding a foot past MAX_HOLD (15 s) refused before it plays, by retarget.apply, export and graph.sim,
// its contacts bridged as core's planter bridges them (a 12 s hold, and one of 15 s, pass); and one whose feet's holds
// the planter rereads past MAX_REREAD (16 s) at a step (feet held 15 s and 13.4 s from starts 2 s apart), by each of
// them, while feet held from one start, and 8 s and 6.4 s from starts 2 s apart, pass. Every next and every
// refusal's call runs as written. One working directory for the file: the tools only read, and write images (and
// recipe.compile its clip file).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { turntable } from "@m3a/sensors";
import { png } from "@m3a/sensors/node";
import { afterAll, describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { Registry, type Reply, type ToolContext } from "../src/registry/index.ts";
import { characterOf, type MappingPatch } from "../src/tools/body.ts";
import { COMPOSE, EXCHANGE, RETARGET } from "../src/tools/index.ts";
import { boundHolds, heldStretches, MAX_HOLD, MAX_REREAD, reread, spannedSpine, TORSO, valueData, valueText } from "../src/tools/judge.ts";
import { character, variant } from "../../three/test-characters/index.ts";
import { exampleCwd, hintedCalls, ROOT, runExamples } from "./helpers/surfaces.ts";

type Row = Record<string, unknown>;
const RIGIFY = "spec/vectors/tier1b/rigify.gltf", ROOT_HIPS = { bones: { hips: "root" } }, HIPS = `n1${"_".repeat(98)}`, WALK = "QUATERNIUS_3D2DGE/Walk_Loop", SWAP = { bones: { leftUpperArm: "DEF-forearm.L", leftLowerArm: "DEF-upper_arm.L" } };
const text = (f: string) => readFileSync(join(ROOT, f), "utf8"), { cwd, rm } = exampleCwd(), reg = new Registry(RETARGET), host = nodeHost(cwd);
afterAll(rm);
/** Tier 1b's Rigify bound through core, patched with `m`. */
const rigifyBody = async (m?: MappingPatch) => characterOf({ read: async () => text(RIGIFY) } as unknown as ToolContext, RIGIFY, m);
// Rigify with every node renamed past the name tables (its hips' name 100 characters long), with its humanoid said in
// VRMC_vrm, and its mesh said to be compressed; tier 1b's rig with 12 hair bones under its head, ahead of the legs
// (nodes 7 to 18); a chain of 3; a clip file, and the walk slowed to 598.7 s (each clip within M2-E010; with the walk,
// 33 ms past 600 s)
const MESHOPT = "EXT_meshopt_compression", walk = JSON.parse(text("library/sets/QUATERNIUS_3D2DGE/Walk_Loop.json")) as { keys: { t: number }[] };
const rigify = JSON.parse(text(RIGIFY)) as { nodes: { name: string }[] }, rig = JSON.parse(text("spec/vectors/tier1b/rig.gltf")) as { nodes: { name: string; children?: number[] }[] };
const human = Object.fromEntries(Object.entries((await rigifyBody()).recognition.bones).map(([h, b]) => [h, { node: rigify.nodes.findIndex((n) => n.name === b) }]));
const hair: typeof rig.nodes = [...rig.nodes.slice(0, 7), ...Array.from({ length: 12 }, (_, i) => ({ name: `hair${i}` })), ...rig.nodes.slice(7)];
for (const n of hair) if (n.children) n.children = n.children.map((i) => (i < 7 ? i : i + 12));
hair[6]!.children!.unshift(...Array.from({ length: 12 }, (_, i) => 7 + i));
for (const [f, data] of Object.entries({
  "renamed.gltf": { ...rigify, nodes: rigify.nodes.map((n, i) => ({ ...n, name: i === 1 ? HIPS : `n${i}` })) }, "rigify-vrm.gltf": { ...rigify, extensions: { VRMC_vrm: { specVersion: "1.0", humanoid: { humanBones: human } } } },
  "packed.gltf": { ...rigify, extensionsUsed: [MESHOPT], extensionsRequired: [MESHOPT] }, "long.json": { ...walk, dur: 598.7, keys: walk.keys.map((k) => ({ ...k, t: Math.round((k.t * 598_700) / 1.333) / 1000 })) },
  "hair.gltf": { ...rig, nodes: hair, animations: undefined }, "chain.gltf": { asset: { version: "2.0" }, nodes: [{ name: "a", children: [1] }, { name: "b", children: [2] }, { name: "c" }] },
  "my punch.json": JSON.parse(text("library/sets/QUATERNIUS_3D2DGE/Punch_Jab.json")) as object,
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
    expect(r.data).toMatchObject({ character: RIGIFY, method: "table", table: v.rig, vrm: false, confidence: 1, required: { mapped: 15, of: 15 }, missing: [], candidates: {}, unmapped: ["root"], issues: [], rest: { kind: "T", armDrop: 2 }, H0: 930 });
    const limbs = { UpperArm: "up", LowerArm: "fore", UpperLeg: "thigh", LowerLeg: "shin", Foot: "ab" };
    expect(r.data!.lengths).toEqual({ spine: 500, ...Object.fromEntries(["left", "right"].flatMap((s) => Object.entries(limbs).map(([b, k]) => [`${s}${b}`, Math.round(v.rest[k] as number)]))) });
    // the body behind it measures as the importer measured the rig, bit for bit, but for its ground (core's under the
    // soles' end bones, D49, at the mesh's lowest toe vertex, 19.65 mm above the file's origin, where the importer puts
    // it) and its head's and toes' tips (which core and the importer read by different rules)
    const body = (await rigifyBody()).bound!.rest as unknown as Record<string, unknown>;
    const same = ["Pr", "Cr", "hip", "spine", "neckSeg", "clav", "cv", "up", "fore", "knuck", "fist", "thigh", "shin", "ab", "abPitch", "spineW", "neckW"], of = (x: Record<string, unknown>) => JSON.stringify(same.map((k) => x[k]));
    expect(of(body)).toBe(of(v.rest));
    expect([body.H0, body.ankleZ, v.rest.H0, v.rest.ankleZ]).toEqual([930.35, 60.35, 950, 80]);
    expect(runs(r.next)).toEqual([{ tool: "retarget.apply", args: { character: RIGIFY, clips: [WALK] } }]);
    // its patch passed back is no finding: the patch is the only issue, and the call it names keeps the patch
    const back = await call("retarget.inspect", { character: RIGIFY, mapping: r.data!.patch });
    expect([back.status, back.data!.issues, back.data!.H0, back.images, runs(back.next)]).toEqual(["ok", ["patched by hand"], 930, [], [{ tool: "retarget.apply", args: { character: RIGIFY, clips: [WALK], mapping: r.data!.patch } }]]);
  });

  it("retarget.inspect finds a bone unmapped (its likely bone named past the cap), swapped arms (their rest in a turntable), hips on the root, bones named by shape", async () => {
    const gap = { leftUpperLeg: null, leftLowerLeg: null, head: null }, pngs = new Map<string, Uint8Array>();
    const gone = await call("retarget.inspect", { character: RIGIFY, mapping: { bones: { ...gap, rightHand: "DEF-hand.R" } } }), swapped = await call("retarget.inspect", { character: RIGIFY, mapping: SWAP }, pngs);
    expect([gone.status, gone.images, gone.verdict]).toEqual(["findings", [], `retarget.inspect ${RIGIFY}: 31 bones by name (rigify), confidence 1.00, 12 of 15 required, rest T`]);
    // each missing bone's likely bones: the head under the neck; the thigh and the shin between the hips and the foot
    expect(gone.data).toMatchObject({ missing: ["head", "leftUpperLeg", "leftLowerLeg"], candidates: { head: ["DEF-head"], leftUpperLeg: ["DEF-thigh.L", "DEF-shin.L"], leftLowerLeg: ["DEF-shin.L", "DEF-thigh.L"] }, H0: null, patch: { bones: gap } });
    expect(gone.lines.slice(1, 4)).toEqual(["mapped: 27 humanoid bones, 12 of the 15 required; 4 source bones unmapped", "unmapped: root, DEF-head, DEF-thigh.L, DEF-shin.L", "missing: head (DEF-head?), leftUpperLeg (DEF-thigh.L?), leftLowerLeg (DEF-shin.L?)"]);
    expect(runs(gone.next)).toEqual([{ tool: "retarget.inspect", args: { character: RIGIFY, mapping: { bones: { leftUpperLeg: "<its bone>", leftLowerLeg: "<its bone>", head: "<its bone>", rightHand: "DEF-hand.R" } } } }]);
    // swapped arms bind, but the forearm reads 530 mm and its rest is bent: four sides of it, ~137 tokens
    expect([swapped.status, swapped.data!.issues, (swapped.data!.lengths as Row).leftLowerArm, swapped.images.map((i) => [i.name, i.width, i.height, i.tokens])])
      .toEqual(["findings", ["patched by hand", "leftLowerArm (DEF-upper_arm.L) does not descend from leftUpperArm (DEF-forearm.L)"], 530, [["spec_vectors_tier1b_rigify.gltf", 640, 160, 137]]]);
    expect(swapped.lines.at(-1)).toBe("patch: check the issues above; edit the patch and pass it back as mapping");
    const bent = (await rigifyBody(SWAP)).bound!;
    expect(Buffer.from([...pngs.values()][0]!).equals(Buffer.from(png(turntable(bent.restPts, { n: 4, size: 160 }))))).toBe(true);
    expect(runs(swapped.next).map((h) => h.tool)).toEqual(["retarget.inspect", "retarget.apply"]);
    // the rig's root taken for its hips: below the ground, under half the legs; a foot, above it but as low (the left
    // foot's row given its toe, as no two humanoid bones may name one source bone)
    const low = await call("retarget.inspect", { character: RIGIFY, mapping: ROOT_HIPS }), foot = await call("retarget.inspect", { character: RIGIFY, mapping: { bones: { hips: "DEF-foot.L", leftFoot: "DEF-toe.L", leftToes: null } } });
    expect([low.status, low.data!.issues, low.images.length, (foot.data!.issues as string[]).at(-1)]).toEqual(["findings", ["patched by hand", "hips (root) likely the wrong bone: only -20 mm up, under half the legs' 850 mm"], 1,
      "hips (DEF-foot.L) likely the wrong bone: only 60 mm up, under half the legs' 925 mm"]);
    const shaped = await call("retarget.inspect", { character: "renamed.gltf" }), hairy = await call("retarget.inspect", { character: "hair.gltf", mapping: { bones: { leftUpperLeg: null } } });
    // its hips' name, 100 characters, cut in its issue to a row's 90
    expect([shaped.status, shaped.verdict, shaped.data!.issues, shaped.images.length]).toEqual(["findings", "retarget.inspect renamed.gltf: 31 bones by topology, confidence 0.85, 15 of 15 required, rest T, hip height 930 mm",
      [`no table matched; mapped by topology from ${HIPS.slice(0, 45)}...`], 1]);
    expect(shaped.lines).toContain(`issue: ${(shaped.data!.issues as string[])[0]}`);
    // its patch passed back confirms what its shape named
    expect(await call("retarget.inspect", { character: "renamed.gltf", mapping: shaped.data!.patch })).toMatchObject({ status: "ok", data: { method: "topology", confidence: 1, issues: ["patched by hand"] } });
    // 17 bones unmapped, ten shown: the thigh, past them, is named where the missing leg's bone is asked for
    expect([hairy.status, hairy.data!.unmapped, hairy.data!.more, hairy.data!.candidates]).toEqual(["findings", ["root", ...Array.from({ length: 9 }, (_, i) => `hair${i}`)], { unmapped: 7 }, { leftUpperLeg: ["thigh_l"] }]);
    expect(hairy.next).toMatch(/^give each missing bone its source bone \(data\.candidates names the likely ones\): /);
  });

  it("retarget.inspect refuses a misspelt humanoid bone and a chain with no humanoid, and never echoes an absolute path", async () => {
    const [bad, chain, abs, json] = [await call("retarget.inspect", { character: RIGIFY, mapping: { bones: { leftUpperLegg: "DEF-thigh.L" } } }), await call("retarget.inspect", { character: "chain.gltf" }),
      await call("retarget.inspect", { character: join(cwd, RIGIFY) }), await call("retarget.inspect", { character: join(cwd, "my punch.json") })];
    expect([bad.status, bad.error]).toEqual(["usage", { code: "E_ARGS", message: 'mapping: "leftUpperLegg" is not a VRM 1.0 humanoid bone; did you mean "leftUpperLeg"?' }]);
    expect([chain.status, chain.error]).toEqual(["error", { code: "E_RIG", message: 'chain.gltf: no humanoid bone recognized among its 3 bones, by name or by shape; give each bone in mapping {bones: {hips: "<its bone>", ...}}' }]);
    expect([abs.verdict, abs.lines[0], abs.next]).toEqual([expect.stringMatching(/^retarget.inspect the character's file: 31 bones/), "rest: T, the arms 2° below level", expect.stringMatching(/^`retarget.apply <the character's file> --clips /)]);
    expect([json.error, [abs, json].map((r) => JSON.stringify(r).includes(cwd))]).toEqual([{ code: "E_ARGS", message: `the character's file is not a character: give a .glb, .gltf or .vrm file, or "tiny"` }, [false, false]]);
  });

  it("retarget.apply reads a rig without chest bones limb by limb: the torso's miss reported, swapped arms still failing (D107)", async () => {
    // gen-5 (WP-4.2's test set) leaves the chest and upper chest out: one spine bone spans the format's spine2 and chest,
    // so the neck and the shoulders sit a curl's centimetres off their points, which no mapping can close
    writeFileSync(join(cwd, "gen-5.glb"), character(variant(5)).glb);
    type Row = { ok: boolean; reach: number; spans: number };
    const ok = await call("retarget.apply", { character: "gen-5.glb", clips: [WALK] }), row = (ok.data!.clips as Row[])[0]!;
    expect([ok.status, row.ok, row.reach, row.spans > 5, row.spans < TORSO * 443]).toEqual(["ok", true, 0, true, true]);
    expect(ok.lines.at(-1)).toMatch(new RegExp(`^PASS ${WALK}: own warn, played pass, reach 0 mm \\(its spine spans \\d+ mm the rig has no bones for\\)$`));
    const swapped = await call("retarget.apply", { character: "gen-5.glb", clips: [WALK], mapping: { bones: { leftUpperArm: "mixamorig:LeftForeArm", leftLowerArm: "mixamorig:LeftArm" } } });
    const bad = (swapped.data!.clips as Row[])[0]!;
    expect([bad.ok, bad.reach > 50]).toEqual([false, true]);
    // a rig with every spine bone reads every joint against its own point, as before
    expect(spannedSpine({ jointPoint: { hips: "pelvis", spine: "spine1", chest: "spine2", upperChest: "chest", neck: "neck" }, bones: { hips: "h", spine: "s", chest: "c", upperChest: "u", neck: "n" }, order: [] })).toEqual({ torso: new Set(), parent: new Map() });
  });

  it("retarget.apply judges clips as the sweep does (D80): swapped arms miss their points; a body adding a fail, or a warn; clips named as given", async () => {
    const swapped = await call("retarget.apply", { character: RIGIFY, clips: [WALK], mapping: SWAP });
    expect([swapped.status, swapped.data!.mapped, swapped.data!.clips, swapped.lines, swapped.images]).toEqual(["findings", "patched", [{ clip: WALK, ok: false, own: "warn", played: "pass", reach: 833, spans: 0, why: ["a joint 833 mm from its point at 0.30 s (at most 5)"], worse: [] }],
      [`warning: retarget.inspect finds 1 issue on it: leftLowerArm (DEF-upper_arm.L) does not descend from left...; \`retarget.inspect ${RIGIFY} --mapping '${JSON.stringify(SWAP)}'\` shows it`, `FAIL ${WALK}: a joint 833 mm from its point at 0.30 s (at most 5)`], []]);
    expect(runs(swapped.next)).toEqual([{ tool: "retarget.inspect", args: { character: RIGIFY, mapping: SWAP } }]);
    // the rig's root taken for its hips: a jab fails as the body adds it, and inspect's standing issue is the call to make
    const low = await call("retarget.apply", { character: RIGIFY, clips: ["QUATERNIUS_3D2DGE/Punch_Cross"], mapping: ROOT_HIPS });
    expect([low.status, low.lines[0], low.next.split(":")[0], runs(low.next)]).toEqual(["findings", expect.stringMatching(/^warning: retarget\.inspect finds 1 issue on it: hips \(root\) likely the wrong bone: only -20 mm up/),
      "QUATERNIUS_3D2DGE/Punch_Cross fails while retarget.inspect's issue stands", [{ tool: "retarget.inspect", args: { character: RIGIFY, mapping: ROOT_HIPS } }]]);
    // nine reasons on its row: two shown and three metrics, the rest counted
    const [jab] = low.data!.clips as { why: string[]; worse: Row[]; more: Row }[];
    expect([jab!.why.length, jab!.worse.length, jab!.more, low.lines.at(-1)]).toEqual([2, 3, { why: 7, worse: 6 }, "more: 7 reasons"]);
    // rigify (its humanoid said as a VRM's) puts its arms into its body kneeling, as the clip's own body doesn't: a fail
    // it adds, its line first and its frames drawn; a jab's jitter past its warn level
    const body = await call("retarget.apply", { character: "rigify-vrm.gltf", clips: ["QUATERNIUS_3D2DGE/Punch_Cross", "MESH2MOTION/Kneeling_Tired"] });
    expect([body.status, body.verdict, body.data!.mapped, body.data!.H0, body.data!.passed, body.data!.failed]).toEqual(["findings", "retarget.apply rigify-vrm.gltf: 1 of 2 clips passes on it (hip height 930 mm)", "humanoid", 930, 1, 1]);
    expect(body.data!.clips).toMatchObject([{ ok: true, why: [], worse: [{ metric: "jitter", level: "warn" }] }, { ok: false, why: [expect.stringMatching(/^bodyPenetration 0\.0 on its own body → 61\.2 played on this one/)], worse: [{ metric: "bodyPenetration", level: "fail", own: 0, played: 61.2 }] }]);
    expect([body.lines[0]!.split(":")[0], body.lines[1], runs(body.next)]).toEqual(["FAIL MESH2MOTION/Kneeling_Tired", "PASS QUATERNIUS_3D2DGE/Punch_Cross: own pass, played warn, reach 0 mm; this body adds a warn: jitter", [{ tool: "search", args: { query: "Kneeling Tired" } }]]);
    expect(body.images.map((i) => [i.name, i.width, i.height, i.tokens])).toEqual([["MESH2MOTION_Kneeling_Tired-on-rigify-vrm.gltf", 1014, 156, 211]]);
    // the tiny rig plays a clip file (a name the shell would split) and a clip's JSON; the next passes them as given, the
    // file's path once (as export's does), not the name a line quotes for the shell
    const tiny = await call("retarget.apply", { character: "tiny", clips: ["my punch.json", text("library/sets/QUATERNIUS_3D2DGE/Walk_Loop.json")] });
    expect([tiny.status, tiny.verdict, tiny.data!.mapped, tiny.lines.map((l) => l.split(":")[0])]).toEqual(["ok", "retarget.apply tiny: 2 of 2 clips pass on it (hip height 950 mm)", "table", ["PASS 'my punch.json'", `PASS ${WALK} (the clip's JSON)`]]);
    expect(runs(tiny.next)).toEqual([{ tool: "license.check", args: { clips: ["my punch.json", "<the clip's JSON>"] } }]);
  });

  it("says a compressed mesh in both tools, as no mapping issue: inspect ok with no turntable, its patch line's advice, the next plays clips; apply notes it, no warning", async () => {
    const said = `mesh compressed (${MESHOPT}): weights and soles unread; every joint kept`, play = { tool: "retarget.apply", args: { character: "packed.gltf", clips: [WALK] } };
    const [seen, low, played, jab] = [await call("retarget.inspect", { character: "packed.gltf" }), await call("retarget.inspect", { character: "packed.gltf", mapping: ROOT_HIPS }),
      await call("retarget.apply", { character: "packed.gltf", clips: [WALK, "MESH2MOTION/Pushup"] }), await call("retarget.apply", { character: "packed.gltf", clips: ["QUATERNIUS_3D2DGE/Punch_Cross"], mapping: ROOT_HIPS })];
    expect([seen.status, seen.images, seen.data!.issues, seen.lines.at(-1), runs(seen.next)]).toEqual(["ok", [], [said], "patch: none clears the mesh's issue; re-export it uncompressed for exact soles", [play]]);
    // a mapping issue beside it still finds, and is the one the patch line and the next speak of
    expect([low.status, low.images.length, low.lines.at(-1), low.next.split(":")[0]]).toEqual(["findings", 1, "patch: check the issues above; edit the patch and pass it back as mapping", "check data.issues"]);
    // a clip the body fails, with no mapping issue: the fail is the body's (D80), not the mapping's to fix first
    expect([played.status, played.lines[0], played.lines.at(-1), runs(played.next)]).toEqual(["findings", `note: ${said}`, `PASS ${WALK}: own warn, played pass, reach 0 mm`, [{ tool: "search", args: { query: "Pushup" } }]]);
    expect([jab.status, jab.lines[0], jab.lines[1], jab.next.split(":")[0]]).toEqual(["findings", expect.stringMatching(/^warning: retarget\.inspect finds 1 issue on it: hips \(root\) likely the wrong bone/), `note: ${said}`,
      "QUATERNIUS_3D2DGE/Punch_Cross fails while retarget.inspect's issue stands"]);
  });

  it("retarget.apply refuses too many clips or none, misspelt clips before any plays (20 taken), clips past 600 s in all, and a character missing a bone (E_RIG, its call to make)", async () => {
    const got = [await call("retarget.apply", { character: RIGIFY, clips: Array(21).fill(WALK) }), await call("retarget.apply", { character: RIGIFY, clips: [] }), await call("retarget.apply", { character: RIGIFY, clips: [WALK, "QUATERNIUS_3D2DGE/Walk_Lop"] }),
      await call("retarget.apply", { character: RIGIFY, clips: [WALK], mapping: { bones: { leftUpperLeg: null } } }), await call("retarget.apply", { character: RIGIFY, clips: Array(20).fill("QUATERNIUS_3D2DGE/Walk_Lop") }),
      await call("retarget.apply", { character: RIGIFY, clips: [WALK, "long.json"] })];
    const lop = { code: "E_NO_CLIP", message: 'no clip "QUATERNIUS_3D2DGE/Walk_Lop"; did you mean "QUATERNIUS_3D2DGE/Walk_Loop"?' };
    expect(got.map((r) => [r.status, r.error])).toEqual([
      ["usage", { code: "E_ARGS", message: "clips lists 21 clips; give 1 to 20, and call again for more" }], ["usage", { code: "E_ARGS", message: "clips lists 0 clips; give 1 to 20, and call again for more" }], ["usage", lop],
      ["error", { code: "E_RIG", message: `${RIGIFY}: leftUpperLeg not mapped; \`retarget.inspect ${RIGIFY} --mapping '{"bones":{"leftUpperLeg":null}}'\` gives the patch: write each into it and pass it as mapping` }], ["usage", lop],
      ["usage", { code: "E_ARGS", message: "clips last 600.1 s in all, past the 600 s one call plays; give fewer or shorter clips, and call again for the rest" }],
    ]);
    for (const hint of [got[3]!.error!.message, got[3]!.next]) expect(runs(hint)).toEqual([{ tool: "retarget.inspect", args: { character: RIGIFY, mapping: { bones: { leftUpperLeg: null } } } }]);
    // a patch leaving two humanoid bones on one source bone, one of them the patch's: their rows would contradict
    const shared = (who: string, bone: string) => ["usage", { code: "E_ARGS", message: `mapping: ${who} both name "${bone}"; a source bone stands for one humanoid bone: give one another, or null to unmap it` }];
    const twice = [await call("retarget.apply", { character: "tiny", clips: [WALK], mapping: { bones: { spine: "pelvis" } } }), await call("retarget.apply", { character: "tiny", clips: [WALK], mapping: { bones: { hips: "root", leftUpperLeg: "root" } } })];
    expect(twice.map((r) => [r.status, r.error])).toEqual([shared("hips and spine", "pelvis"), shared("hips and leftUpperLeg", "root")]);
    // a metric's value that is no finite number: "not finite" in a row's text, null in its worse[] (JSON has none)
    expect([NaN, Infinity, -Infinity, 61.234, 483.4].map((v) => [valueText(v), valueData(v)])).toEqual([["not finite", null], ["not finite", null], ["not finite", null], ["61.2", 61.234], ["483", 483.4]]);
  });

  it("refuses a clip holding a foot past 15 s, or feet whose holds the planter rereads past 16 s at a step, before it plays (retarget.apply, export, graph.sim), its contacts bridged as core's planter bridges them", async () => {
    // Idle_Loop retimed to 20 s: both feet hold throughout, one stretch each
    const all = new Registry([...RETARGET, ...COMPOSE, ...EXCHANGE]), on = (tool: string, args: object) => all.call(tool, args, { host }) as Promise<Reply<Row>>;
    const made = await on("recipe.compile", { recipe: JSON.stringify({ format: "2.0", id: "RECIPES/Idle_20", steps: [{ op: "clip", id: "QUATERNIUS_3D2DGE/Idle_Loop" }, { op: "retime", in: "s1", dur: 20 }] }) }), file = made.data!.path as string;
    const held = (title: string, foot = "left") => ({ code: "E_ARGS", message: `${title}: its ${foot} foot holds the ground 20.000 s (0.000–20.000 s), past the 15 s one call plays a held foot for; cut it into clips whose feet hold under 15 s (a recipe's or edit's slice), and call again` });
    const graph = JSON.stringify({ format: "2.0", id: "GRAPHS/Still", name: "Still", parameters: {}, start: "idle", states: { idle: { clip: "RECIPES/Idle_20" } }, transitions: [] });
    const got = [await on("retarget.apply", { character: "tiny", clips: [file] }), await on("export", { clip: file, character: "tiny", format: "bvh" }), await on("graph.sim", { graph, script: JSON.stringify({ format: "2.0", id: "SIMS/Stand", dur: 1, input: [] }), clips: [file] })];
    expect(got.map((r) => [r.status, r.error])).toEqual([["usage", held(file)], ["usage", held(file)], ["usage", held("RECIPES/Idle_20")]]);
    // two contacts 0.05 s apart are one stretch, as the planter bridges them (under 0.1 s); 0.15 s apart, two
    const clip = JSON.parse(readFileSync(join(cwd, file), "utf8")) as { contacts: object };
    writeFileSync(join(cwd, "two holds.json"), JSON.stringify({ ...clip, contacts: { by: "labelled", footR: [[0, 10], [10.05, 20]] } }));
    expect((await call("retarget.apply", { character: "tiny", clips: ["two holds.json"] })).error).toEqual(held("'two holds.json'", "right"));
    const once = { dur: 20, loop: false }, at = (h: { foot: string; from: number; to: number }[]) => h.map((x) => [x.foot, x.from, x.to]);
    expect(at(heldStretches({ ...once, contacts: { by: "labelled", footL: [[10.15, 20], [0, 10]], footR: [[0, 10], [10.05, 20]] } }))).toEqual([["footR", 0, 20], ["footL", 0, 10], ["footL", 10.15, 20]]);
    // a loop's seam closed when its gap is under 0.1 s (with more than one stretch), the last running on into the next cycle
    expect(at(heldStretches({ dur: 20, loop: true, contacts: { by: "labelled", footL: [[0, 5], [5.2, 19.95]] } }))).toEqual([["footL", 5.2, 25]]);
    expect(at(heldStretches({ dur: 20, loop: true, contacts: { by: "labelled", footL: [[0, 20]] } }))).toEqual([["footL", 0, 20]]);
    expect(() => boundHolds({ dur: 20, loop: true, contacts: { by: "labelled", footL: [[0, 5], [5.2, 19.95]] } }, "X")).toThrow(/^X: its left foot holds the ground 19\.800 s \(5\.200–25\.000 s, on through its loop's seam\)/);
    // a 12 s hold passes, and one of exactly the limit, both feet from the same start (the same poses reread)
    for (const t of [12, MAX_HOLD]) expect(() => boundHolds({ ...once, contacts: { by: "labelled", footL: [[0, t]], footR: [[0, t]] } }, "X"), String(t)).not.toThrow();
    // what the planter rereads at a step (reread): a stretch from its start to the settle's reach (0.1 s on), one ended
    // within 0.3 s, a loop's last cycle's after its seam; once when both feet start it together, each foot's own in `each`
    const r15 = reread({ dur: 15, loop: true, contacts: { by: "labelled", footL: [[0, 15]], footR: [[0, 15]] } });
    expect([r15.held, r15.each, r15.at].map((x) => Math.round(x * 1000) / 1000)).toEqual([15.4, 30.8, 0.3]);
    // feet holding from different starts are reread together: 8 s and 6.4 s at once pass; 15 s and 13.4 s, one held clip
    // whose pose cache would clear every step (MAX_REREAD), are refused, by every tool that plays a clip
    expect(() => boundHolds({ ...once, contacts: { by: "labelled", footL: [[0, 8]], footR: [[2, 10]] } }, "X")).not.toThrow();
    const stagger = { ...clip, contacts: { by: "labelled", footL: [[0, 15]], footR: [[2, 17]] } };
    writeFileSync(join(cwd, "stagger.json"), JSON.stringify(stagger));
    const rereads = (title: string) => ({ code: "E_ARGS", message: `${title}: at 15.300 s the planter rereads 28.400 s of its feet's holds (left 15.000 s from 0.000 s, right 13.400 s from 2.000 s), past the ${MAX_REREAD} s one call rereads at a step; cut it into clips whose feet's holds add up to under ${MAX_REREAD} s at any time (a recipe's or edit's slice), and call again` });
    const staggered = [await on("retarget.apply", { character: "tiny", clips: ["stagger.json"] }), await on("export", { clip: "stagger.json", character: "tiny", format: "bvh" }), await on("graph.sim", { graph, script: JSON.stringify({ format: "2.0", id: "SIMS/Stand", dur: 1, input: [] }), clips: ["stagger.json"] })];
    expect(staggered.map((r) => [r.status, r.error])).toEqual([["usage", rereads("stagger.json")], ["usage", rereads("stagger.json")], ["usage", rereads("RECIPES/Idle_20")]]);
  });
});

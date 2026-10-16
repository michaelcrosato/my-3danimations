// The writers (WP-7.2b, D93): a clip played on a bound skeleton written as BVH and as a glTF animation on a character's
// own nodes, each read back through io's readers to the joints the Animator put there, within 1 mm: the BVH through
// parseBvh and readBvh (Unreal's names, its travel), the .glb through posedOf and readGltf, the exact reader, with the
// file's own animations and buffer kept, and on Rigify's turned and scaled armature; a VRMA carrying its clip's license
// and credit, read back byte for byte (I5); and a one-frame take imported as a clip that lasts a frame (I4).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Animator, bind, parseClip, playable, solver, validate, format, type AnimClip, type Bound, type Rest } from "@m3a/core";
import { describe, expect, it } from "vitest";
import { addAnimation, bvhGap, bvhPose, decodeVrma, encodeVrma, glbGap, gltfAnimOf, importSet, parseBvh, parseGlb, parseGltf, posedOf, readBvh, readGltf, skeletonOfGltf, writeBvh, writeVrma } from "../src/index.ts";
import { tier1bRigGlb, tier1bText } from "../../../spec/conformance/runner/vectors.ts";

const ROOT = join(import.meta.dirname, "../../.."), KNOCK = "QUATERNIUS_3D2DGE/Hit_Knockback";
/** A library clip ready to play on its own rest. */
function clipOf(id: string): AnimClip {
  const [set, name] = id.split("/") as [string, string], clip = parseClip(readFileSync(join(ROOT, "library/sets", set, `${name}.json`), "utf8"));
  return playable(clip as AnimClip, (JSON.parse(readFileSync(join(ROOT, "library/sets", set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources[clip.restSrc]!.rest);
}
/** A glTF character bound through core, and each bone's node. */
function character(text: string): { doc: ReturnType<typeof parseGltf>; b: Bound; nodes: Record<string, number> } {
  const doc = parseGltf(text), g = skeletonOfGltf(doc);
  return { doc, b: bind(g.skeleton, { restWorld: g.restWorld }), nodes: Object.fromEntries(g.skeleton.bones.map((x, k) => [x.name, g.nodes[k]!])) };
}
/** The worst distance (mm) over every 1/30 s sample between where the Animator puts each bone (the root's travel
 *  added, as the VRMA test reads it) and where `at(i, name)` reads it back (skeleton units, null: not written). */
function worst(clip: AnimClip, b: Bound, at: (i: number, name: string) => number[] | null): number {
  const n = Math.ceil(clip.dur * 30), h = clip.dur / n, a = new Animator(b, { step: h }).layer("clip", { clip });
  let w = 0;
  for (let i = 0; i <= n; i++) {
    const p = a.pose(), o = b.origin, tr = solver.dirToSkeleton(b, [p.root.forward * b.scale, p.root.right * b.scale, 0]);
    for (const { name } of b.order) {
      const j = p.joints[name], got = at(i, name);
      if (j && got) w = Math.max(w, Math.hypot(...[0, 1, 2].map((k) => o[k]! + tr[k]! + (j[k]! - o[k]!) - got[k]!)) / b.scale);
    }
    if (i < n) a.step(h);
  }
  return w;
}

describe("writers", () => {
  const knock = clipOf(KNOCK), rig = character(tier1bText("rig.gltf"));
  it("writes BVH whose joints read back where the Animator put them, within 1 mm, and read as a take by Unreal's names", () => {
    const text = writeBvh(knock, rig.b), back = parseBvh(text), j = new Map(back.names.map((x, k) => [x, k]));
    expect(text.slice(0, 120)).toMatch(/^HIERARCHY\nROOT root\n\{\n {2}OFFSET 0\.0000 0\.0000 0\.0000\n {2}CHANNELS 6 Xposition Yposition Zposition Zrotation/);
    expect(worst(knock, rig.b, (i, name) => bvhPose(back, i)[j.get(name)!]![1].map((x) => x * 0.01))).toBeLessThan(1);
    expect(bvhGap(text, knock, rig.b)).toBeLessThan(0.01);
    const take = readBvh(() => text, ["knock"]);
    expect([take.rig, Math.round(take.clips.knock!.dur * 1000) / 1000, take.clips.knock!.move !== null]).toEqual(["bvh:unreal", knock.dur, true]);
  });
  it("adds a glTF animation on the character's own nodes, its own kept, read back within 1 mm (Rigify's scaled armature too)", () => {
    const bytes = addAnimation(rig.doc, gltfAnimOf(knock, rig.b, rig.doc, rig.nodes)), doc = parseGlb(bytes), an = doc.json.animations!;
    expect([an.map((a) => a.name), (an[3] as unknown as { extras: { license: string } }).extras.license, [...doc.bin!.raw().subarray(0, rig.doc.bin!.length)]]).toEqual([["A_TPose", "Wave_Loop", "Step_RM", KNOCK], "CC0-1.0", [...rig.doc.bin!.raw()]]);
    const back = posedOf(doc, 3, 30 * (Math.ceil(knock.dur * 30) / (knock.dur * 30))), byName = new Map(back.names.map((x, k) => [x, k]));
    expect(worst(knock, rig.b, (i, name) => (byName.has(name) ? bvhPose(back, i)[byName.get(name)!]![1] : null))).toBeLessThan(1);
    expect(Object.keys(readGltf(doc).clips)).toEqual(["A_TPose", "Wave_Loop", "Step_RM", KNOCK]); // the exact reader reads it
    const rigify = character(tier1bText("rigify.gltf"));
    expect(glbGap(addAnimation(rigify.doc, gltfAnimOf(knock, rigify.b, rigify.doc, rigify.nodes)), knock, rigify.b, rigify.nodes)).toBeLessThan(0.01);
  });
  it("writes a VRMA's license in its extras and its credit as the asset's copyright, read back byte for byte (I5)", () => {
    const owed = { ...knock, provenance: { ...(knock as unknown as { provenance: object }).provenance, license: "CC-BY-4.0", credit: "Someone, CC BY 4.0" } } as AnimClip;
    const bytes = writeVrma(owed, rig.b), v = decodeVrma(bytes);
    expect([v.copyright, v.extras.license, (parseGlb(bytes).json.asset as { copyright?: string }).copyright]).toEqual(["Someone, CC BY 4.0", "CC-BY-4.0", "Someone, CC BY 4.0"]);
    expect(encodeVrma(v)).toEqual(bytes);
    expect(decodeVrma(writeVrma(knock, rig.b)).copyright).toBe("CC0-1.0"); // no credit owed: the license itself
  });
  it("imports a one-frame take as a clip that lasts a frame, its one key the fit's (I4)", () => {
    const lib = readGltf(parseGlb(tier1bRigGlb())), out = importSet([{ id: "RIG", file: "rig.glb", ...lib }], {}, { name: "RIG", credit: "the tiny rig" }), pose = out.set.clips.A_TPose!;
    expect([lib.clips.A_TPose!.n, pose.dur, pose.keys.length]).toEqual([1, 0.033, 1]);
    const clip = format.fromFormat1(pose as unknown as format.Clip1, { set: "RIG", slug: "A_TPose", name: "A_TPose", fps: 30, restSrc: "RIG", license: "CC0-1.0", producer: { tool: "test", version: "1" }, qaVersion: "none" });
    expect(validate(clip, { mode: "read" }).errors).toEqual([]);
  });
});

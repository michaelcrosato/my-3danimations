// Playback and baking (WP-4.4): a baked clip plays within 1 mm of the live solve on characters of three namings
// (Mixamo's centimetres, UE5's root, Rigify's twist bones), and carries the source clip's loop, events, contacts and
// facts in userData, which GLTFExporter writes to the animation's extras; an attached Animator writes its crossfades and
// masked layers to the bones and hands the root's motion to the game, along the way the character faces (`travel`: a
// model facing +X walks along +X, its standing foot still); the adapter's per-frame write allocates nothing
// (measured), and a whole update's cost is stated.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { Group, Vector3, type Bone } from "three";
import { describe, expect, it } from "vitest";
import { Animator, playable, type Clip } from "@m3a/core";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { libraryClips } from "../../../tools/qa/qa.ts";
import { attach, bake, bakeError, bind, type Attached, type BakedData } from "../src/index.ts";
import { character, loadGlb, variant } from "../test-characters/index.ts";

const lib = new Map(libraryClips().map((c) => [c.clip.id, c.clip]));
const clip = (id: string) => lib.get(id)! as Clip;
const boundOf = async (seed: number) => bind((await loadGlb(character(variant(seed)).glb)).scene);
const quat = (b: Bone) => b.quaternion.toArray() as number[];
const close = (a: number[], b: number[], tol = 1e-6) => a.every((x, i) => Math.abs(x - b[i]!) < tol) || a.every((x, i) => Math.abs(x + b[i]!) < tol);

describe("baking", () => {
  it("plays within 1 mm of the live solve, on Mixamo, UE5 and Rigify characters", async () => {
    const lines: string[] = [];
    for (const seed of [1, 2, 7]) {
      const b = await boundOf(seed);
      for (const id of ["QUATERNIUS_3D2DGE/Walk_Loop", "QUATERNIUS_3D2DGE/Punch_Jab", "CMU_CURATED/Run_Loop", "MESH2MOTION/Jump_2"]) {
        const baked = bake(clip(id), b), data = baked.userData as unknown as BakedData, check = bakeError(baked, clip(id), b);
        expect(data.error.max, `${variant(seed).naming} ${id}`).toBeLessThanOrEqual(1);
        // three's own mixer, played at every sample and halfway between, agrees
        expect(check.max, `${variant(seed).naming} ${id} through AnimationMixer`).toBeLessThanOrEqual(1);
        lines.push(`${variant(seed).naming} ${id.split("/")[1]} ${check.max.toFixed(2)} mm (${data.error.samples} samples)`);
      }
    }
    console.log(`bake: ${lines.join("; ")}`);
  }, 60_000);
  it("carries the clip's loop, events, contacts and facts in userData, which GLTFExporter writes to extras", async () => {
    const walk = clip("STYLE100/Neutral_Walk"), b = await boundOf(2);
    const src = { ...walk, events: [{ t: 0.3, name: "step" }], contacts: { by: "labelled", footL: [[0, 0.5]] } } as Clip, baked = bake(src, b);
    expect(src.facts).toBeDefined();
    const data = baked.userData as unknown as BakedData;
    expect([data.id, data.loop, data.events, data.contacts, data.facts]).toEqual([src.id, src.loop, src.events, src.contacts, src.facts]);
    // Node has no FileReader; GLTFExporter reads its buffers through one
    (globalThis as { FileReader?: unknown }).FileReader ??= class {
      result: unknown = null;
      onloadend: (() => void) | null = null;
      readAsArrayBuffer(blob: Blob) {
        void blob.arrayBuffer().then((x) => ((this.result = x), this.onloadend?.()));
      }
      readAsDataURL(blob: Blob) {
        void blob.arrayBuffer().then((x) => ((this.result = `data:application/octet-stream;base64,${Buffer.from(x).toString("base64")}`), this.onloadend?.()));
      }
    };
    const gltf = (await new GLTFExporter().parseAsync(b.root, { animations: [baked], binary: false })) as { animations: { extras?: BakedData }[] };
    expect(gltf.animations[0]!.extras).toMatchObject({ id: src.id, loop: src.loop, events: [{ t: 0.3, name: "step" }], contacts: src.contacts, facts: JSON.parse(JSON.stringify(src.facts)) });
  });
});

describe("an attached Animator", () => {
  it("writes its crossfades and masked layers to the bones", async () => {
    const b = await boundOf(2), walk = clip("QUATERNIUS_3D2DGE/Walk_Loop"), punch = clip("QUATERNIUS_3D2DGE/Punch_Jab");
    const legs = [b.humanoid.leftUpperLeg!, b.humanoid.leftLowerLeg!], arm = b.humanoid.rightLowerArm!;
    // walk alone, then walk with an upper-body punch over it, then that punch at half weight: same time each
    const pose = (layers: (a: Animator) => Animator) => {
      const att = attach(layers(new Animator(b.core)), b);
      for (let i = 0; i < 20; i++) att.update(1 / 60, { lod: 1 });
      return { legs: legs.map(quat), arm: quat(arm) };
    };
    const alone = pose((a) => a.layer("base", { clip: walk })), masked = pose((a) => a.layer("base", { clip: walk }).layer("upper", { clip: punch, mask: "upper" }));
    const half = pose((a) => a.layer("base", { clip: walk }).layer("upper", { clip: punch, mask: "upper", weight: 0.5 }));
    expect(masked.legs.every((q, i) => close(q, alone.legs[i]!)), "the legs are the walk's").toBe(true);
    expect(close(masked.arm, alone.arm, 1e-3), "the arm is the punch's").toBe(false);
    // the crossfade: the half-weight arm lies between the walk's and the punch's
    const angle = (p: number[], q: number[]) => 2 * Math.acos(Math.min(1, Math.abs(p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]! + p[3]! * q[3]!)));
    expect(angle(half.arm, alone.arm) + angle(half.arm, masked.arm)).toBeCloseTo(angle(alone.arm, masked.arm), 2);
    expect(angle(half.arm, alone.arm)).toBeGreaterThan(0.2 * angle(alone.arm, masked.arm));
  });
  it("hands the root's motion to the game, the hips staying over the root", async () => {
    const b = await boundOf(2), walk = clip("CMU_CURATED/Bear"), att = attach(new Animator(b.core).layer("base", { clip: walk }), b);
    expect((walk.keys[0] as { root?: unknown }).root).toBeDefined();
    let travelled = 0, far = 0;
    for (let i = 0; i < 60; i++) {
      att.update(1 / 60);
      travelled += Math.hypot(att.moved.forward, att.moved.right);
      far = Math.max(far, Math.hypot(b.humanoid.hips!.position.x, b.humanoid.hips!.position.z));
    }
    expect(travelled).toBeGreaterThan(100);
    expect([att.root.forward, att.root.right]).toEqual([att.animator.root.forward, att.animator.root.right]);
    expect(far).toBeLessThan(0.3);
  });
  it("hands the game its move along the way the character faces (`travel`): a model facing +X walks along +X, its standing foot still", async () => {
    // G4's held-out rig faces +X (its armature turned a quarter about Y): moved along +Z by `moved`, it crabbed sideways
    const { clip: walk0, rest } = libraryClips().find((c) => c.clip.id === "QUATERNIUS_3D2DGE/Walk_Loop")!, walk = playable(walk0, rest);
    const run = async (turn: (scene: Group) => void, move: (scene: Group, att: Attached) => void) => {
      const scene = (await loadGlb(character(variant(2)).glb)).scene as Group;
      turn(scene);
      const b = bind(scene), att = attach(new Animator(b.core).layer("base", { clip: walk }), b), feet = [b.humanoid.leftFoot!, b.humanoid.rightFoot!];
      const speeds: number[] = [];
      let last: Vector3 | null = null;
      for (let i = 0; i < 150; i++) {
        att.update(1 / 60);
        move(scene, att);
        scene.updateMatrixWorld(true);
        // the lower foot's ankle, and how fast it moves along the ground (m/s)
        const low = feet.map((f) => f.getWorldPosition(new Vector3())).reduce((a, c) => (c.y < a.y ? c : a));
        if (last && i > 30) speeds.push(Math.hypot(low.x - last.x, low.z - last.z) * 60);
        last = low;
      }
      return { b, att, at: scene.position.clone(), still: speeds.sort((x, y) => x - y)[Math.floor(speeds.length / 10)]! };
    };
    const quarter = (scene: Group) => {
      const g = new Group();
      g.add(...scene.children);
      g.rotation.y = Math.PI / 2;
      scene.add(g);
    };
    const facingZ = await run(() => {}, (s, att) => s.position.add(att.travel));
    // a model facing +Z: travel is `moved` along +Z and −X, as a glTF character's
    expect(facingZ.at.z).toBeGreaterThan(1);
    expect(Math.abs(facingZ.at.x)).toBeLessThan(0.05);
    const facingX = await run(quarter, (s, att) => s.position.add(att.travel)), crabbed = await run(quarter, (s, att) => {
      s.position.z += att.moved.forward / 1000;
      s.position.x -= att.moved.right / 1000;
    });
    expect(facingX.b.core.frame.forward[0]).toBeCloseTo(1, 6);
    expect(facingX.at.x).toBeCloseTo(facingZ.at.z, 6);
    expect(Math.abs(facingX.at.z)).toBeLessThan(0.05);
    // the standing foot: still at times along its facing (the slowest tenth of the lower ankle), sliding when crabbed
    expect(facingX.still).toBeLessThan(0.05);
    expect(crabbed.still).toBeGreaterThan(0.5);
    // the root turned by the game: travel turns with it
    const turned = await run((s) => (s.rotation.y = Math.PI / 2), (s, att) => s.position.add(att.travel));
    expect(turned.at.x).toBeCloseTo(facingZ.at.z, 6);
    console.log(`travel: facing +Z ${facingZ.at.z.toFixed(2)} m along +Z, the lower ankle's slowest tenth ${facingZ.still.toFixed(3)} m/s; facing +X ${facingX.at.x.toFixed(2)} m along +X, ${facingX.still.toFixed(3)} m/s (crabbed by moved along +Z: ${crabbed.still.toFixed(2)} m/s)`);
  });
  it("refuses an Animator made for another skeleton", async () => {
    const a = await boundOf(2), b = await boundOf(3);
    expect(() => attach(new Animator(b.core), a)).toThrow(/poses another skeleton/);
  });
});

describe("the hot path", () => {
  it("writes a frame without allocating, measured; a whole update's cost is stated", () => {
    const out = JSON.parse(execFileSync(process.execPath, ["--expose-gc", join(import.meta.dirname, "alloc.ts")], { encoding: "utf8" })) as { writeBytes: number; updateBytes: number; updateMs: number };
    console.log(`hot path: the write ${out.writeBytes.toFixed(2)} bytes a frame; a whole update (core's step and pose, then the write) ${(out.updateBytes / 1024).toFixed(1)} KB and ${out.updateMs.toFixed(3)} ms a frame`);
    expect(Math.abs(out.writeBytes)).toBeLessThan(1);
  }, 60_000);
});

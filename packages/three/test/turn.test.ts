// attach turns the pose as far as the root has turned beyond it (WP-F.14): a game moves the character by `travel` alone,
// as the manual says, and it faces where it heads. A clip that turns played to its end, then a walk: the walk faces where
// the turn ended and walks that way, forward. Before, the pose faced its own clip's way alone, so the walk faced where
// the first clip started and walked backwards; and the gallery, turning the character by the root's heading too, showed
// a clip's own turn twice.
import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { Animator, playable } from "@m3a/core";
import { libraryClips } from "../../../tools/qa/qa.ts";
import { attach, bind, type ThreeBound } from "../src/index.ts";
import { character, loadGlb, variant } from "../test-characters/index.ts";

const all = libraryClips(), entry = (id: string) => all.find((c) => c.clip.id === id)!;
const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** Which way the character faces in its parent's space (degrees, + toward its right), from its hips' bones. */
function facing(b: ThreeBound): number {
  const v = (x: readonly number[]) => new Vector3(x[0], x[1], x[2]).normalize(), f = v(b.core.frame.forward), r = v(b.core.frame.right);
  b.root.updateMatrixWorld(true);
  const L = b.humanoid.leftUpperLeg!.getWorldPosition(new Vector3()), R = b.humanoid.rightUpperLeg!.getWorldPosition(new Vector3());
  return (Math.atan2(R.dot(r) - L.dot(r), R.dot(f) - L.dot(f)) * 180) / Math.PI - 90;
}
/** Where the character stands (its root) along its rest's forward and right. */
function at(b: ThreeBound): [number, number] {
  const v = (x: readonly number[]) => new Vector3(x[0], x[1], x[2]).normalize();
  return [b.root.position.dot(v(b.core.frame.forward)), b.root.position.dot(v(b.core.frame.right))];
}

describe("attach: the character faces where the root heads", () => {
  it("a clip that turns half round, then a walk: the walk faces the turn's end and walks forward", async () => {
    for (const seed of [1, 7]) {
      const b = bind((await loadGlb(character(variant(seed)).glb)).scene), turn = entry("CMU_CURATED/Pick_Up_Basket"), walk = entry("QUATERNIUS_3D2DGE/Walk_Loop");
      const a = new Animator(b.core).layer("base", { clip: playable(turn.clip, turn.rest) }), p = attach(a, b), start = facing(b);
      const play = (s: number) => {
        for (let i = 0; i < Math.round(s * 60); i++) {
          p.update(1 / 60);
          b.root.position.add(p.travel);
        }
      };
      play(turn.clip.dur);
      // the turning clip's end: the root turned some 195° to its right, and the character with it, once
      expect(Math.abs(wrap(facing(b) - start - a.root.yaw)), `gen-${seed} at the turn's end`).toBeLessThan(15);
      a.layer("base", { clip: playable(walk.clip, walk.rest), time: 0 });
      const from = at(b);
      play(1);
      const to = at(b), way = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
      // the walk faces where the root heads (the turn's end, its own way added), and travels the way it faces
      expect(Math.abs(wrap(facing(b) - start - a.root.yaw)), `gen-${seed} walking`).toBeLessThan(15);
      expect(Math.abs(wrap(way - (facing(b) - start))), `gen-${seed} walks forward`).toBeLessThan(30);
      expect(Math.hypot(to[0] - from[0], to[1] - from[1]), `gen-${seed} walks`).toBeGreaterThan(0.5);
    }
  }, 60_000);
});

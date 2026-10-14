// B4's known-good solution (WP-6.6): the CC0 library's crouched sneaking walk, repaired by the sensors' fix and made
// playable on its own rest (its contacts and its library's spine), played by core's Animator on the bound avatar (a VRM
// humanoid's names are recognized), the avatar moved by the root motion its planted feet imply.
import { Animator, playable } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { fix } from "@m3a/sensors";
import { attach, bind } from "@m3a/three";
import type { Object3D } from "three";

/** The sneaker the game drives. */
export interface Sneaker {
  update(dt: number): void;
}

/** A sneaker for this avatar. */
export async function createSneaker(character: Object3D): Promise<Sneaker> {
  const { clip, rest } = openLibrary().clip("MESH2MOTION/Crouch_Walk"), bound = bind(character);
  const player = attach(new Animator(bound.core).layer("sneak", { clip: playable(fix(clip, rest).clip, rest) }), bound);
  return {
    update(dt) {
      player.update(dt);
      character.position.z += player.moved.forward / 1000;
      character.position.x -= player.moved.right / 1000;
    },
  };
}

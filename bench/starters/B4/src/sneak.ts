// B4: the avatar's sneak. Implement createSneaker (see BRIEF.md): a crouched sneaking walk loop from the CC0 library,
// travelling as its feet push it, its standing feet still.
import type { Object3D } from "three";

/** The sneaker the game drives: each frame, `update` with the time passed. */
export interface Sneaker {
  /** Advances by dt seconds, moving and posing the avatar. */
  update(dt: number): void;
}

/** A sneaker for this avatar (its scene, as src/character.ts loads it). */
export async function createSneaker(character: Object3D): Promise<Sneaker> {
  void character;
  throw new Error("createSneaker: not written yet (BRIEF.md)");
}

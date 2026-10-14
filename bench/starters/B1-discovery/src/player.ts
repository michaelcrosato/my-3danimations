// The player character: implement createPlayer (BRIEF.md).
import type { Object3D } from "three";

/** What the player is doing. */
export type Motion = "idle" | "walk" | "run";
/** The player the game drives: each frame, `update` with the time passed and the speed it asks for. */
export interface Player {
  /** What it plays now. */
  readonly motion: Motion;
  /** Advances by dt seconds at the asked ground speed (m/s), moving and posing the character. */
  update(dt: number, input: { speed: number }): void;
}

/** A player for this character (its scene, as src/character.ts loads it). */
export async function createPlayer(character: Object3D): Promise<Player> {
  void character;
  throw new Error("createPlayer: not written yet (BRIEF.md)");
}

// B3: the character's hit reactions. Implement createReactor (see BRIEF.md): idle or walk by the speed asked; a light
// hit flinches the upper body only; a heavy hit knocks it down for a second before it gets up.
import type { Object3D } from "three";

/** A hit landing on the character. */
export type Hit = "light" | "heavy";
/** The reactor the game drives: each frame, `update` with the time passed, the speed asked and any hit. */
export interface Reactor {
  /** Advances by dt seconds, moving and posing the character: `speed` in its hip heights a second, `hit` on the frame
   *  one lands. */
  update(dt: number, input: { speed: number; hit?: Hit }): void;
}

/** A reactor for this character (its scene, as src/character.ts loads it). */
export async function createReactor(character: Object3D): Promise<Reactor> {
  void character;
  throw new Error("createReactor: not written yet (BRIEF.md)");
}

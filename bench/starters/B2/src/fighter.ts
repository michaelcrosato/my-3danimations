// B2: the character's attack. Implement createFighter (see BRIEF.md): idle; a punch when attack is pressed; the game's
// damage on the frame it lands.
import type { Object3D } from "three";

/** What the game gives the fighter: where damage goes. */
export interface Game {
  /** Applies damage to whatever the punch hits: call it once per punch, on the frame the punch lands. */
  damage(amount: number): void;
}
/** The fighter the game drives: each frame, `update` with the time passed and whether attack was pressed. */
export interface Fighter {
  /** Advances by dt seconds, posing the character; `attack` is true on the frame the button is pressed. */
  update(dt: number, input: { attack: boolean }): void;
}

/** A fighter for this character (its scene, as src/character.ts loads it), dealing damage to `game`. */
export async function createFighter(character: Object3D, game: Game): Promise<Fighter> {
  void character;
  void game;
  throw new Error("createFighter: not written yet (BRIEF.md)");
}

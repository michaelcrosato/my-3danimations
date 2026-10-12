// B2's known-good solution (WP-6.6): idle from the CC0 library; on a press, the library's jab over it on a layer, a
// `hit` event put in the jab at its measured strike (its facts), and damage dealt when the step fires it; the jab
// faded in over a tenth of a second (snapped in, the hands would jump faster than they punch) and out as it ends.
import { Animator, measureFacts, playable } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { attach, bind } from "@m3a/three";
import type { Object3D } from "three";

/** What the game gives the fighter: where damage goes. */
export interface Game {
  damage(amount: number): void;
}
/** The fighter the game drives. */
export interface Fighter {
  update(dt: number, input: { attack: boolean }): void;
}

/** A fighter for this character. */
export async function createFighter(character: Object3D, game: Game): Promise<Fighter> {
  const library = openLibrary(), idle = library.clip("QUATERNIUS_3D2DGE/Idle_Loop"), jab = library.clip("QUATERNIUS_3D2DGE/Punch_Jab");
  const strike = (jab.clip.facts as { strike?: number[] } | undefined)?.strike?.[0] ?? (measureFacts(jab.clip, jab.rest).strike as number[])[0]!;
  const punch = playable({ ...jab.clip, events: [{ t: strike, name: "hit" }] }, jab.rest);
  const bound = bind(character), animator = new Animator(bound.core).layer("base", { clip: playable(idle.clip, idle.rest) }), player = attach(animator, bound);
  let punching = false;
  return {
    update(dt, { attack }) {
      if (attack && !punching) {
        animator.layer("punch", { clip: punch, time: 0, weight: 0 });
        punching = true;
      }
      const L = animator.layers.find((x) => x.name === "punch");
      if (L && L.held !== "end" && L.weight < 1) animator.layer("punch", { weight: Math.min(1, L.weight + dt / 0.1) });
      for (const e of player.update(dt).events) if (e.name === "hit") game.damage(10);
      // as the jab ends, back to idling over a fifth of a second
      if (L && L.held === "end") {
        const w = Math.max(0, L.weight - dt / 0.2);
        if (w > 0) animator.layer("punch", { weight: w });
        else {
          animator.remove("punch");
          punching = false;
        }
      }
    },
  };
}

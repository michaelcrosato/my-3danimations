// B1's known-good solution (WP-4.7): idle, walk and run from the CC0 library, repaired by the sensors' fix, their
// contacts measured, played by core's Animator on the bound character; walk and run at the rate the asked speed needs;
// the character moved by the root motion its planted feet imply, so they don't slide; moves cross-fade over 0.25 s.
import { Animator, contact, measureFacts, type Clip } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { fix } from "@m3a/sensors";
import { attach, bind } from "@m3a/three";
import type { Object3D } from "three";

/** What the player is doing. */
export type Motion = "idle" | "walk" | "run";
/** The player the game drives. */
export interface Player {
  readonly motion: Motion;
  update(dt: number, input: { speed: number }): void;
}

const CLIPS: Record<Motion, string> = { idle: "QUATERNIUS_3D2DGE/Idle_Loop", walk: "QUATERNIUS_3D2DGE/Walk_Loop", run: "QUATERNIUS_3D2DGE/Jog_Fwd_Loop" };
const FADE = 0.25, RUN_FROM = 2.2;

/** A player for this character. */
export async function createPlayer(character: Object3D): Promise<Player> {
  const library = openLibrary(), bound = bind(character), moves = {} as Record<Motion, { clip: Clip; speed: number }>;
  for (const m of ["idle", "walk", "run"] as const) {
    const { clip, rest } = library.clip(CLIPS[m]), repaired = fix(clip, rest).clip;
    const ready = { ...repaired, contacts: measureFacts(repaired, rest).contacts };
    // its own speed on this body (mm/s): the path its planted feet imply here
    moves[m] = { clip: ready, speed: contact.contactRoot(ready, bound.core.rest, ready.contacts).speed };
  }
  const animator = new Animator(bound.core).layer("base", { clip: moves.idle.clip }), player = attach(animator, bound);
  let motion: Motion = "idle", fading: { to: Motion; t: number } | null = null;
  const rate = (m: Motion, speed: number) => (m === "idle" ? 1 : Math.min(2, Math.max(0.5, (speed * 1000) / moves[m].speed)));
  return {
    get motion() {
      return fading?.to ?? motion;
    },
    update(dt, { speed }) {
      const want: Motion = speed < 0.3 ? "idle" : speed < RUN_FROM ? "walk" : "run";
      if (want !== (fading?.to ?? motion)) {
        if (fading) [motion, fading] = [fading.to, null];
        const base = animator.layers[0]!, from = moves[motion].clip, to = moves[want].clip;
        animator.layer("fade", { clip: to, weight: 0, time: from.loop && to.loop ? (base.time / from.dur) * to.dur : 0 });
        fading = { to: want, t: 0 };
      }
      animator.layer("base", { speed: rate(motion, speed) });
      if (fading) animator.layer("fade", { speed: rate(fading.to, speed) });
      player.update(dt);
      // travel along the facing by the root's move (mm)
      character.position.z += player.moved.forward / 1000;
      character.position.x -= player.moved.right / 1000;
      if (fading) {
        fading.t += dt;
        const u = Math.min(1, fading.t / FADE);
        animator.layer("fade", { weight: u * u * (3 - 2 * u) });
        if (u >= 1) {
          const top = animator.layers[1]!;
          animator.layer("base", { clip: moves[fading.to].clip, time: top.time, speed: top.speed }).remove("fade");
          [motion, fading] = [fading.to, null];
        }
      }
    },
  };
}

// B3's known-good solution (WP-6.6): idle and walk from the CC0 library, the walk at the rate the asked speed needs
// and the character moved by the root motion its planted feet imply; a light hit, the library's head hit on a layer
// masked to the upper body, faded in and out; a heavy hit, the knockback taking the base layer, held lying 1 s, then
// the library's get-up cut in (both lie), then the walk again.
import { Animator, contact, playable, type AnimClip } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { attach, bind } from "@m3a/three";
import type { Object3D } from "three";

/** A hit landing on the character. */
export type Hit = "light" | "heavy";
/** The reactor the game drives. */
export interface Reactor {
  update(dt: number, input: { speed: number; hit?: Hit }): void;
}

/** A reactor for this character. */
export async function createReactor(character: Object3D): Promise<Reactor> {
  const library = openLibrary(), get = (id: string): AnimClip => {
    const { clip, rest } = library.clip(`QUATERNIUS_3D2DGE/${id}`);
    return playable(clip, rest);
  };
  const idle = get("Idle_Loop"), walk = get("Walk_Loop"), flinch = get("Hit_Head"), knock = get("Hit_Knockback"), rise = get("LayToIdle");
  const bound = bind(character), H0 = bound.core.rest.H0, own = contact.contactRoot(walk as never, bound.core.rest, walk.contacts!).speed;
  const animator = new Animator(bound.core).layer("base", { clip: idle }), player = attach(animator, bound);
  // what the base plays: moving by speed, or down (knocked, lying, rising) for a while
  let down: { phase: "knock" | "lie" | "rise"; t: number } | null = null, fade = 0;
  const base = (clip: AnimClip, time?: number) => {
    animator.layer("next", { clip, weight: 0, ...(time !== undefined ? { time } : {}) });
    fade = 1e-9;
  };
  return {
    update(dt, { speed, hit }) {
      if (hit === "heavy" && !down) {
        base(knock, 0);
        down = { phase: "knock", t: 0 };
        animator.remove("flinch");
      } else if (hit === "light" && !down) animator.layer("flinch", { clip: flinch, time: 0, weight: 0, mask: "upper" });
      if (down) {
        down.t += dt;
        const L = animator.layers.find((x) => x.name === (fade ? "next" : "base"))!;
        if (down.phase === "knock" && L.held === "end") down = { phase: "lie", t: 0 };
        // lying to lying: a cut (a blend between two lying poses swings the limbs through the floor)
        else if (down.phase === "lie" && down.t >= 1) {
          animator.layer("base", { clip: rise, time: 0, speed: 1 });
          down = { phase: "rise", t: 0 };
        }
        else if (down.phase === "rise" && L.held === "end") down = null;
      } else {
        const want = speed * H0 > 0.3 * H0 ? walk : idle, cur = animator.layers.find((x) => x.name === (fade ? "next" : "base"))!;
        if (cur.clip !== want.id) base(want);
        animator.layer(fade ? "next" : "base", { speed: want === walk ? Math.min(2, Math.max(0.5, (speed * H0) / own)) : 1 });
      }
      // the flinch: in over a tenth of a second, out as it ends
      const F = animator.layers.find((x) => x.name === "flinch");
      if (F) animator.layer("flinch", { weight: F.held === "end" ? Math.max(0, F.weight - dt / 0.2) : Math.min(1, F.weight + dt / 0.1) });
      if (F && F.held === "end" && F.weight <= 0) animator.remove("flinch");
      // the base's cross-fade, a quarter of a second
      if (fade) {
        fade = Math.min(1, fade + dt / 0.25);
        animator.layer("next", { weight: fade * fade * (3 - 2 * fade) });
        if (fade >= 1) {
          const N = animator.layers.find((x) => x.name === "next")!;
          animator.layer("base", { clip: N.clip === walk.id ? walk : N.clip === idle.id ? idle : N.clip === knock.id ? knock : rise, time: N.time, speed: N.speed }).remove("next");
          fade = 0;
        }
      }
      player.update(dt);
      character.position.z += player.moved.forward / 1000;
      character.position.x -= player.moved.right / 1000;
    },
  };
}

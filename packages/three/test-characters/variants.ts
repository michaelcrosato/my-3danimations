// The test set (WP-4.2): 20 generated characters, seeds 0 to 19, chosen so that every build, rest pose and naming
// shows, each naming with and without twist bones, and the optional bones are left out in turn. Any other seed gives
// another character the same way, with its own lengths (a held-out one, for a gate or a benchmark variant: PLAN.md §7).
import type { Build, CharacterSpec, Naming, RestPose } from "./characters.ts";

const BUILDS: readonly Build[] = ["chibi", "heroic", "bulky", "child", "tall"];
const RESTS: readonly RestPose[] = ["T", "A", "relaxed"];
const NAMINGS: readonly Naming[] = ["vrm", "mixamo", "ue5", "rigify"];
const DROPS: readonly (readonly string[])[] = [[], ["upperChest"], ["toes"], ["shoulders"], ["neck"], ["chest", "upperChest"]];

/** The test set's seeds. */
export const TEST_SEEDS: readonly number[] = Array.from({ length: 20 }, (_, i) => i);

/** The character a seed gives: its build, rest pose, naming, twist bones and left-out bones (its lengths vary by seed). */
export function variant(seed: number): CharacterSpec {
  const s = Math.abs(Math.trunc(seed));
  return { id: `gen-${seed}`, seed, build: BUILDS[s % 5]!, rest: RESTS[s % 3]!, naming: NAMINGS[s % 4]!, twist: Math.floor(s / 4) % 2 === 1, drop: [...DROPS[s % 6]!] };
}

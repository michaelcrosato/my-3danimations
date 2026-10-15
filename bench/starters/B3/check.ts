// `npm run check`: drives the reactor as the grader will (walking from 1 s, a light hit at 3 s, a heavy one at 6 s, 13 s
// in all) and prints every half second how high the hips are and where the character is. It doesn't grade. The hips
// are the bone bind() finds, as the grader's, whatever the rig calls it.
import { bind } from "@m3a/three";
import { loadCharacter } from "./src/character.ts";
import { createReactor } from "./src/reactor.ts";

const character = await loadCharacter(), hips = bind(character).humanoid.hips!, reactor = await createReactor(character);
for (let frame = 0; frame < 780; frame++) {
  reactor.update(1 / 60, { speed: frame >= 60 ? 1.2 : 0, ...(frame === 180 ? { hit: "light" as const } : frame === 360 ? { hit: "heavy" as const } : {}) });
  character.updateMatrixWorld(true);
  if (frame % 30 === 0) console.log(`${(frame / 60).toFixed(1)} s  hips ${hips.matrixWorld.elements[13]!.toFixed(2)} m up  at x ${character.position.x.toFixed(2)} z ${character.position.z.toFixed(2)}`);
}

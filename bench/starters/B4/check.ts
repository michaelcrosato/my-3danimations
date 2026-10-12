// `npm run check`: drives the sneaker as the grader will (6 s) and prints each second how low the hips are against
// standing and how far the avatar has travelled. It doesn't grade (measure the feet as the manual's "Check" shows).
import { bind } from "@m3a/three";
import { loadCharacter } from "./src/character.ts";
import { createSneaker } from "./src/sneak.ts";

const character = await loadCharacter(), H0 = bind(await loadCharacter()).core.rest.H0, sneaker = await createSneaker(character);
const hipsOf = () => {
  let y = Number.NaN;
  character.traverse((o) => void (Number.isNaN(y) && /hips|pelvis/i.test(o.name) && (y = o.matrixWorld.elements[13]! * 1000)));
  return y;
};
for (let frame = 0; frame < 360; frame++) {
  sneaker.update(1 / 60);
  character.updateMatrixWorld(true);
  if (frame % 60 === 59) console.log(`${((frame + 1) / 60).toFixed(0)} s  hips ${Math.round((100 * hipsOf()) / H0)}% of standing  at z ${character.position.z.toFixed(2)} m`);
}
console.log(`(hips ${Math.round(H0)} mm up standing)`);

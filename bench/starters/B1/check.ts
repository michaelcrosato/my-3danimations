// `npm run check`: drives the player as the grader will (the same speeds) and prints what it plays each half second,
// where the character is and whether any bone went non-finite. It doesn't grade the feet or the sheet.
import { loadCharacter } from "./src/character.ts";
import { createPlayer } from "./src/player.ts";

const SCRIPT: [number, number][] = [[0, 2], [1.2, 3], [3.5, 3], [1.2, 2], [0, 2]];
const character = await loadCharacter(), player = await createPlayer(character);
let t = 0, bad = 0;
for (const [speed, secs] of SCRIPT) {
  for (let i = 0; i < Math.round(secs * 60); i++, t += 1 / 60) {
    player.update(1 / 60, { speed });
    character.updateMatrixWorld(true);
    character.traverse((o) => { if (!o.matrixWorld.elements.every(Number.isFinite)) bad++; });
    if (i % 30 === 0) console.log(`${t.toFixed(1)} s  asked ${speed} m/s  plays ${player.motion}  at x ${character.position.x.toFixed(2)} z ${character.position.z.toFixed(2)}`);
  }
}
console.log(bad ? `NON-FINITE transforms: ${bad}` : "every transform finite");

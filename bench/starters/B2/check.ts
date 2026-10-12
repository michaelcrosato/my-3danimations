// `npm run check`: drives the fighter as the grader will (attack pressed on frames 60 and 180 of 300, 60 a second) and
// prints when damage came, and for each punch its strike and the frames damage may come on (found by strike.ts, as
// the grader finds them, from the hands' places forward of the hips). It doesn't grade.
import { bind } from "@m3a/three";
import { createFighter } from "./src/fighter.ts";
import { loadCharacter } from "./src/character.ts";
import { strikeOf } from "./strike.ts";

const character = await loadCharacter(), damage: number[] = [], bound = bind(character), ahead: number[][] = [[], []];
const [hips, left, right] = [bound.humanoid.hips!, bound.humanoid.leftHand!, bound.humanoid.rightHand!];
let frame = 0;
const fighter = await createFighter(character, { damage: () => void damage.push(frame) });
for (frame = 0; frame < 300; frame++) {
  fighter.update(1 / 60, { attack: frame === 60 || frame === 180 });
  character.updateMatrixWorld(true);
  // forward is +Z, the way the character faces; in mm
  const z = (b: typeof hips) => b.matrixWorld.elements[14]! * 1000;
  ahead[0]!.push(z(left) - z(hips));
  ahead[1]!.push(z(right) - z(hips));
}
for (const press of [60, 180]) {
  const s = strikeOf(ahead, press, bound.core.rest.H0);
  console.log(s.speed ? `press on frame ${press}: the ${s.hand ? "right" : "left"} hand strikes on frame ${s.at} at ${(s.speed / 1000).toFixed(2)} m/s and is farthest out on ${s.far}: damage from frame ${s.from} to ${s.to}` : `press on frame ${press}: no punch (no hand's forward speed peaks faster than one hip height a second)`);
}
console.log(`damage on frames ${damage.join(", ") || "none"}`);

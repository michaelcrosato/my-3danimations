// `npm run check`: drives the fighter as the grader will (attack pressed on frames 60 and 180 of 300, 60 a second) and
// prints when damage came and on which frame each punch's hand moved forward fastest (by the character's bones). It
// doesn't grade.
import { createFighter } from "./src/fighter.ts";
import { loadCharacter } from "./src/character.ts";

const character = await loadCharacter(), damage: number[] = [], hands: { t: number; p: number[] }[] = [];
let frame = 0;
const fighter = await createFighter(character, { damage: () => void damage.push(frame) });
const wristish = (name: string) => /hand|wrist/i.test(name) && !/thumb|index|middle|ring|pinky|finger/i.test(name);
for (frame = 0; frame < 300; frame++) {
  fighter.update(1 / 60, { attack: frame === 60 || frame === 180 });
  character.updateMatrixWorld(true);
  const p: number[] = [];
  character.traverse((o) => void (wristish(o.name) && p.push(...o.matrixWorld.elements.slice(12, 15))));
  hands.push({ t: frame, p });
}
// the frame each punch's hands move forward (+Z, the way the character faces) fastest, the body standing still
for (const press of [60, 180]) {
  let best = -1, at = press;
  for (let i = press + 1; i < Math.min(299, press + 90); i++) {
    const v = Math.max(...hands[i + 1]!.p.filter((_, k) => k % 3 === 2).map((z, k) => z - hands[i - 1]!.p[k * 3 + 2]!));
    if (v > best) [best, at] = [v, i];
  }
  console.log(`press on frame ${press}: a hand moves forward fastest about frame ${at}`);
}
console.log(`damage on frames ${damage.join(", ") || "none"}`);

// `npm run check`: drives the fighter as the grader will (attack pressed on frames 60 and 180 of 300, 60 a second) and
// prints when damage came and on which frame each punch struck (by the character's bones, as the grader reads them). It
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
// each punch's strike, as the grader finds it: the hand that reaches farthest forward (+Z, the way the character
// faces; the body standing still) after the press, and the last time its forward speed peaks (at half its fastest or
// more) before it is farthest out, so a fade into a fighting stance before the punch, which can carry the hand forward
// faster, isn't taken for it
for (const press of [60, 180]) {
  const end = Math.min(299, press + 90), z = (i: number, h: number) => hands[i]!.p[h * 3 + 2]!, v = (i: number, h: number) => z(i + 1, h) - z(i - 1, h);
  let hand = 0, far = press;
  for (let h = 0; h < hands[0]!.p.length / 3; h++) for (let i = press; i < end; i++) if (z(i, h) > z(far, hand)) [hand, far] = [h, i];
  let fastest = press + 1;
  for (let i = press + 1; i <= far; i++) if (v(i, hand) > v(fastest, hand)) fastest = i;
  let at = fastest;
  for (let i = far - 1; i > press + 1; i--) {
    if (v(i, hand) >= v(i - 1, hand) && v(i, hand) >= v(i + 1, hand) && v(i, hand) >= 0.5 * v(fastest, hand)) {
      at = i;
      break;
    }
  }
  console.log(`press on frame ${press}: the punch strikes about frame ${at} (its hand farthest out on frame ${far})`);
}
console.log(`damage on frames ${damage.join(", ") || "none"}`);

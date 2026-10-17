// The stand-in for the manual's complete example (WP-7.4), until WP-7.3 marks the manual's own (```ts example): a
// fighter walks up, jabs with a `hit` event at the jab's measured strike, and a second character flinches when the
// hit lands, both headless on @m3a/core's binding of a small skeleton, with the library's CC0 clips. It checks what
// it claims (one hit, the flinch played, every pose finite, the jab with its event valid through the tools' API) and
// prints the two Animators' hashes, so a run on the installed packages and one on m3a.js can be compared bit for bit.
// `npm run pack -- --check --example tools/bundle/standin.ts` runs it.
import { Animator, bind, measureFacts, playable, serialize, type SkeletonIn } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { tools } from "@m3a/tools";

// a small humanoid (Unreal's bone names, metres, +y up, facing +z): each bone's head is its parent's plus the offset
const bones: SkeletonIn["bones"] = [], at = new Map<string, number[]>();
const bone = (name: string, parent: string | null, d: number[]) => {
  const p = parent ? at.get(parent)! : [0, 0, 0], head = [p[0]! + d[0]!, p[1]! + d[1]!, p[2]! + d[2]!];
  at.set(name, head);
  bones.push({ name, parent, head: head as [number, number, number] });
};
bone("root", null, [0, 0, 0]);
bone("pelvis", "root", [0, 0.95, 0]);
[["spine_01", 0.1], ["spine_02", 0.12], ["spine_03", 0.12], ["neck_01", 0.16], ["Head", 0.1], ["head_end", 0.18]].forEach(([n, y], i, a) => bone(n as string, i ? (a[i - 1]![0] as string) : "pelvis", [0, y as number, 0]));
for (const [s, x] of [["l", 1], ["r", -1]] as const) {
  bone(`clavicle_${s}`, "spine_03", [0.03 * x, 0.12, 0]);
  bone(`upperarm_${s}`, `clavicle_${s}`, [0.15 * x, 0, 0]);
  bone(`lowerarm_${s}`, `upperarm_${s}`, [0.28 * x, 0, 0]);
  bone(`hand_${s}`, `lowerarm_${s}`, [0.25 * x, 0, 0]);
  bone(`middle_01_${s}`, `hand_${s}`, [0.09 * x, 0, 0]);
  bone(`thigh_${s}`, "pelvis", [0.1 * x, -0.02, 0]);
  bone(`calf_${s}`, `thigh_${s}`, [0, -0.44, 0]);
  bone(`foot_${s}`, `calf_${s}`, [0, -0.43, 0]);
  bone(`ball_${s}`, `foot_${s}`, [0, -0.06, 0.13]);
}
const skeleton: SkeletonIn = { bones, up: [0, 1, 0] };

// the clips: a walk, a jab with a hit event at its strike, a flinch
const library = openLibrary();
const ready = (id: string) => {
  const { clip, rest } = library.clip(id);
  return playable(clip, rest);
};
const jab = library.clip("QUATERNIUS_3D2DGE/Punch_Jab"), strike = measureFacts(jab.clip, jab.rest).strike![0]!; // an attack has one
const punch = playable({ ...jab.clip, events: [{ t: strike, name: "hit" }] }, jab.rest);
const fighter = new Animator(bind(skeleton)).layer("base", { clip: ready("QUATERNIUS_3D2DGE/Walk_Loop") });
const target = new Animator(bind(skeleton)).layer("base", { clip: ready("QUATERNIUS_3D2DGE/Idle_Loop") });

// one second of walking, then the jab over the walk's upper body; the target flinches on the hit
let hits = 0;
for (let i = 0; i < 180; i++) {
  if (i === 60) fighter.layer("jab", { clip: punch, time: 0, mask: "upper" });
  for (const e of fighter.step(1 / 60).events) {
    if (e.name !== "hit") continue;
    hits++;
    target.layer("flinch", { clip: ready("QUATERNIUS_3D2DGE/Hit_Chest"), time: 0, mask: "upper" });
  }
  target.step(1 / 60);
  if (![...fighter.pose().points, ...target.pose().points].every(Number.isFinite)) throw new Error(`a pose isn't finite at step ${i}`);
}
const flinch = target.layers.find((l) => l.name === "flinch");
if (hits !== 1 || !flinch || flinch.time <= 0) throw new Error(`expected one hit and the flinch playing; got ${hits} hit(s), flinch ${flinch ? `at ${flinch.time} s` : "missing"}`);

// the clip with its event through the tools' API: valid
const checked = await tools.call("validate", { text: serialize({ ...jab.clip, events: [{ t: strike, name: "hit" }] }) });
if (checked.status !== "ok") throw new Error(`validate: ${checked.verdict}`);
console.log(`hit at ${strike} s; fighter ${fighter.hash()}; target ${target.hash()}; ${checked.verdict}`);

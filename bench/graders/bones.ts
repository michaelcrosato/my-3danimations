// What the graders read of a character (PLAN.md §7): its joints from its bones each frame, in the sensors' axes and
// millimetres, by the body points they map to (the grader binds its own copy of the character for the mapping). A
// character is graded by what its bones do, not by what its code says it does.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Bound } from "@m3a/core";
import { bind } from "@m3a/three";
import { loadGlb } from "@m3a/three/test-characters";

type Node = { getObjectByName(n: string): { matrixWorld: { elements: number[] } } | undefined };
/** A point: forward, right, up mm. */
export type V3 = [number, number, number];

/** The grader's own bound copy of a workspace's character: its body (rest, H0) and its bones by the points they map. */
export async function bodyOf(workspace: string): Promise<{ core: Bound; bones: [point: string, bone: string][] }> {
  const ref = bind((await loadGlb(new Uint8Array(readFileSync(join(workspace, "character.glb"))), { textures: false })).scene), core = ref.core;
  return { core, bones: Object.entries(core.jointPoint).map(([h, point]) => [point, core.recognition.bones[h]!] as [string, string]).filter(([, bone]) => bone) };
}
/** The named joints of a character's scene as it stands (call updateMatrixWorld first), mm, forward (+Z), right (−X), up. */
export function jointsOf(scene: Node, bones: readonly [string, string][]): Record<string, V3> {
  const out: Record<string, V3> = {};
  for (const [point, bone] of bones) {
    const e = scene.getObjectByName(bone)?.matrixWorld.elements;
    out[point] = e ? [e[14]! * 1000, -e[12]! * 1000, e[13]! * 1000] : [Number.NaN, Number.NaN, Number.NaN];
  }
  return out;
}
/** b − a. */
export const sub = (a: V3, b: V3): V3 => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
/** |v|. */
export const len = (v: V3): number => Math.hypot(v[0], v[1], v[2]);

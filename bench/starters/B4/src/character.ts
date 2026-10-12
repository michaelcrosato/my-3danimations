// The starter's character (B4): character.glb loaded with three.js (as the grader loads it: meshopt-compressed meshes
// read, textures left out), in Node or a browser. Given; don't change it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Object3D } from "three";
import { loadGlb } from "@m3a/three/test-characters";

/** The character's scene, loaded from character.glb beside package.json (or the path given). */
export async function loadCharacter(path = join(import.meta.dirname, "../character.glb")): Promise<Object3D> {
  return (await loadGlb(new Uint8Array(readFileSync(path)), { textures: false })).scene;
}

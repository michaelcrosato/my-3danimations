// The starter's character (B2): character.glb loaded with three.js, in Node or a browser. Given; don't change it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** The character's scene, loaded from character.glb beside package.json (or the path given). */
export async function loadCharacter(path = join(import.meta.dirname, "../character.glb")): Promise<Object3D> {
  const bytes = readFileSync(path), gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "");
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

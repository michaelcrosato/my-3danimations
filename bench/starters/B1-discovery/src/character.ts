// The game's character: character.glb loaded with three.js (meshopt-compressed meshes read, textures left out: Node has
// no image decoder), in Node or a browser. Given; don't change it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/** The character's scene, loaded from character.glb beside package.json (or the path given). */
export async function loadCharacter(path = join(import.meta.dirname, "../character.glb")): Promise<Object3D> {
  const bytes = readFileSync(path), loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  // the materials' texture slots dropped before anything loads, so no image is decoded
  loader.register((parser) => {
    for (const m of (parser.json.materials ?? []) as Record<string, unknown>[]) {
      for (const part of [m, (m.pbrMetallicRoughness ?? {}) as Record<string, unknown>]) for (const k of Object.keys(part)) if (k.endsWith("Texture")) delete part[k];
      delete m.extensions;
    }
    return { name: "textures_left_out" };
  });
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "");
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

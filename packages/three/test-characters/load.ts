// Reading a character in three.js, in Node or a browser: a GLB through GLTFLoader (meshopt-compressed ones too), its
// skinned meshes and clips, and its skeleton as recognize and bind read it (names, parents, rest heads in metres).
// In Node, where there is no image decoder, `textures: false` drops a GLB's images before loading.
import type { AnimationClip, Bone, Object3D, SkinnedMesh } from "three";
import { Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { SkeletonIn } from "@m3a/core";

/** A loaded character: its scene, its skinned meshes and its clips. */
export interface Loaded {
  scene: Object3D;
  skinned: SkinnedMesh[];
  animations: AnimationClip[];
}

/** A GLB with its images, textures and samplers dropped, and the materials' texture slots with them. */
export function withoutTextures(bytes: Uint8Array): Uint8Array {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), jl = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jl))) as Record<string, unknown> & { materials?: Record<string, unknown>[] };
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const m of json.materials ?? []) {
    for (const k of Object.keys(m)) if (/Texture$/.test(k)) delete m[k];
    const pbr = m.pbrMetallicRoughness as Record<string, unknown> | undefined;
    for (const k of Object.keys(pbr ?? {})) if (/Texture$/.test(k)) delete pbr![k];
    delete m.extensions;
  }
  const text = new TextEncoder().encode(JSON.stringify(json)), pad = Math.ceil(text.byteLength / 4) * 4, rest = bytes.subarray(20 + jl);
  const out = new Uint8Array(20 + pad + rest.byteLength), o = new DataView(out.buffer);
  out.set(bytes.subarray(0, 12));
  o.setUint32(8, out.byteLength, true);
  o.setUint32(12, pad, true);
  o.setUint32(16, 0x4e4f534a, true);
  out.set(text, 20);
  out.fill(0x20, 20 + text.byteLength, 20 + pad);
  out.set(rest, 20 + pad);
  return out;
}

/** Loads a GLB (`textures: false` drops its images first). */
export async function loadGlb(bytes: Uint8Array, opts: { textures?: boolean } = {}): Promise<Loaded> {
  const b = opts.textures === false ? withoutTextures(bytes) : bytes;
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "");
  gltf.scene.updateMatrixWorld(true);
  const skinned: SkinnedMesh[] = [];
  gltf.scene.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) skinned.push(o as SkinnedMesh);
  });
  return { scene: gltf.scene, skinned, animations: gltf.animations };
}

/** A skinned mesh's skeleton as recognize and bind read it: bone names, parents (bones only) and world rest heads. */
export function skeletonIn(mesh: SkinnedMesh): SkeletonIn {
  const v = new Vector3();
  return { bones: mesh.skeleton.bones.map((b: Bone) => ({ name: b.name, parent: (b.parent as Bone | null)?.isBone ? b.parent!.name : null, head: b.getWorldPosition(v).toArray() as [number, number, number] })) };
}

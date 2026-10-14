// A VRM animation read as clips (PLAN.md WP-5.2): its nodes named by the humanoid bones they play
// (`VRMC_vrm_animation`), so the VRM bone map places the body points, then read as any glTF rig is (`gltf/posed.ts`),
// a loop when its extras say so.
import { parseGlb } from "../gltf/container.ts";
import { readGltfPosed, type PosedLibrary } from "../gltf/posed.ts";
import type { Pick } from "../takes.ts";
import { humanBonesOf } from "./vrma.ts";

/** A .vrma's animations as clips (metres, the VRM bone map), with `_rest`. */
export function readVrma(bytes: Uint8Array, opts: { fps?: number; picks?: Pick[]; file?: string } = {}): PosedLibrary {
  const doc = parseGlb(bytes, opts.file), bone = new Map(Object.entries(humanBonesOf(doc.json, opts.file)).map(([k, i]) => [i, k]));
  return readGltfPosed(doc, { ...(opts.fps ? { fps: opts.fps } : {}), ...(opts.picks ? { picks: opts.picks } : {}), units: 1, name: (i) => bone.get(i) ?? `_${doc.json.nodes?.[i]?.name ?? `node${i}`}` });
}

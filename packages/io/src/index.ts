// @m3a/io: readers and writers for glTF/GLB, VRMA, BVH and ASF/AMC (PLAN.md WP-5.2). Every input is untrusted: sizes
// capped, a file's work budgeted, buffers bounds-checked, shapes checked, nothing evaluated, and a refusal (`IoError`)
// names its cause and offset; the readers exported here let nothing else out. Readers turn a library into captured
// body points, which `importSet` fits into clips as a catalog says.
// The main entry stays runnable in a browser; Node built-ins go behind a `/node` entry (PLAN.md §5.1).
import * as acclaim from "./acclaim/read.ts";
import { guard } from "./bytes.ts";
import * as bvh from "./bvh/read.ts";
import * as container from "./gltf/container.ts";
import * as posed from "./gltf/posed.ts";
import * as gltf from "./gltf/read.ts";
import * as skel from "./gltf/skeleton.ts";
import * as imp from "./import.ts";
import * as vrmaRead from "./vrma/read.ts";
import * as vrma from "./vrma/vrma.ts";

/** Where a reader's file name sits in its arguments: the k-th, a document's buffer, or an options object's `file`. */
const nth = (k: number) => (a: unknown[]) => a[k];
const docFile = (a: unknown[]) => (a[0] as { bin?: { file?: string } | null } | undefined)?.bin?.file;
const optFile = (k: number) => (a: unknown[]) => (a[k] as { file?: string } | undefined)?.file;

/** The version every `@m3a` package and the spec share. */
export { VERSION } from "@m3a/core";

/** This package's name. */
export const PACKAGE = "@m3a/io";

/** A reader's refusal (`code`: E_FORMAT, E_LIMIT, E_BOUNDS, E_RIG, E_MISSING; `offset`, `file`), and the size limits. */
export { IoError, LIMITS, type IoCode } from "./bytes.ts";
/** glTF containers' types; `packGlb` packs a document as .glb. */
export { packGlb, type GltfDoc, type GltfJson, type GltfNode } from "./gltf/container.ts";
/** A binary glTF (.glb) read into its document and buffer. */
export const parseGlb = guard(container.parseGlb, nth(1));
/** A .gltf read, its buffer embedded as a base64 data: URI. */
export const parseGltf = guard(container.parseGltf, nth(1));
/** A .gltf packed as .glb, its buffer moved into the BIN chunk. */
export const gltfToGlb = guard(container.gltfToGlb, nth(1));
/** The glTF rigs read bit for bit, and what a library read gives. */
export { RIGS, type GltfLibrary, type Capture, type Look } from "./gltf/read.ts";
/** A glTF library on Rigify's or Unreal's rig read as body points, bit for bit as the origin's importer (tier 1b). */
export const readGltf = guard(gltf.readGltf, docFile);
/** What a glTF library holds, without reading its clips: its rig, clips and bones. */
export const describeGltf = guard(gltf.describeGltf, docFile);
/** What a glTF library on any rig gives. */
export { type PosedLibrary } from "./gltf/posed.ts";
/** A glTF library on any rig a bone map knows (MotionBuilder/Mixamo, Unreal, Rigify, VRM, ...), read as clips. */
export const readGltfPosed = guard(posed.readGltfPosed, docFile);
/** One glTF animation as joints posed frame by frame (the BVH reader's form). */
export const posedOf = guard(posed.posedOf, docFile);
/** A glTF character's skeleton as core binds it: its skin's joints (or every node), heads, parents, rest orientations. */
export type { GltfSkeleton } from "./gltf/skeleton.ts";
/** A glTF character's skeleton (its biggest skin's joints, else every node) for core's bind, read from nodes alone. */
export const skeletonOfGltf = guard(skel.skeletonOfGltf, docFile);
/** Where a glTF's skinned mesh ends under each joint (meshEnds' result), and why the mesh went unread. */
export type { MeshEnds } from "./gltf/skeleton.ts";
/** Where each joint's part of a glTF's skinned mesh ends, on the sole (D49's end bone for a foot with no child), or why
 *  the mesh went unread. */
export const meshEnds = guard(skel.meshEnds, docFile);
/** CMU's Acclaim skeleton and takes: their types. */
export { type Asf, type AsfBone, type CmuPick, type CmuLibrary } from "./acclaim/read.ts";
/** An .asf skeleton. */
export const readAsf = guard(acclaim.readAsf, nth(1));
/** An .amc take, one `{ bone: values }` a frame. */
export const readAmc = guard(acclaim.readAmc, nth(1));
/** A CMU subject's picked stretches as clips, bit for bit as the origin's (tier 1b). */
export const readCmu = guard(acclaim.readCmu, nth(4));
/** BioVision hierarchy files: forward kinematics and the body points, and their types. */
export { bvhPose, bvhPoints, bvhFrames, type Bvh, type RiggedBvh, type BvhLibrary } from "./bvh/read.ts";
/** A .bvh file's text, parsed. */
export const parseBvh = guard(bvh.parseBvh, nth(1));
/** A parsed .bvh placed on the bone map it matches: its units, facing and rest. */
export const rigBvh = guard(bvh.rigBvh, optFile(1));
/** Takes in BVH files cut into clips. */
export const readBvh = guard(bvh.readBvh);
/** Takes cut into clips (loops at their best cycle, closed), and the rest stood on the takes' floor. */
export { cutPicks, restCapture, type Pick, type Take, type Facing, type Find, type Way } from "./takes.ts";
/** VRM animations: a clip played on a bound skeleton written as .vrma, and its types. */
export { vrmaOf, encodeVrma, writeVrma, type Vrma, type VrmaNode, type VrmaTrack, type VrmaExtras } from "./vrma/vrma.ts";
/** A .vrma read back exactly. */
export const decodeVrma = guard(vrma.decodeVrma, nth(1));
/** A .vrma's animations read as clips on the VRM bone map. */
export const readVrma = guard(vrmaRead.readVrma, optFile(1));
/** Catalog-driven import's types. */
export { type Catalog, type SourceInfo, type LibraryIn, type ImportedClip, type Imported, type TakeRow, type SetFile } from "./import.ts";
/** Libraries fitted into a set as a catalog says, with a fit report per clip. */
export const importSet = guard(imp.importSet);
/** A catalog's picks as capture readers take them. */
export const picksOf = guard(imp.picksOf);
/** A smaller set from bigger ones: the clips a game adopts, with their libraries' records. */
export const subset = guard(imp.subset);

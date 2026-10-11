// The conformance runner for TypeScript: reads the vectors in spec/vectors/ by tier, verifies them against their
// manifest, packs tier 1b's glTF as the .glb a reader takes, and compares numbers bit for bit or within a tolerance.
// Tests under spec/conformance/ and the packages use it; WP-10.2 turns it into a kit for other languages.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Where the vectors live. */
export const VECTORS = join(import.meta.dirname, "../../vectors");

/** Tolerances per tier (spec/conformance/tiers.md). */
export const TOLERANCE = { tier1a: 0, tier1b: 0, tier2mm: 0.001, tier3deg: 9, tier3curledDeg: 14 } as const;

/** A format-1 clip as the vectors hold it. */
export interface VClip {
  clip?: string;
  dur: number;
  loop?: boolean;
  tags?: string[];
  desc?: string;
  keys: ({ t: number } & Record<string, number[] | number>)[];
}

/** One clip of a tier-1a vector: the capture, the importer's extras, and the oracle's results. */
export interface Tier1aClip {
  capture: { name: string; n: number; dur: number; loop: boolean; fps: number; take?: string; move: number[] | null; data: number[][] };
  extra?: Record<string, unknown>;
  reduce?: number[];
  fit?: { max: number; mean: number; clip: VClip };
  text?: string;
}

/** A tier-1a vector file. */
export interface Tier1a {
  points: string[];
  tol: number;
  restClip: string;
  rest: Record<string, unknown>;
  clips: Record<string, Tier1aClip>;
  log: string[];
  glbSha256?: string;
  picks?: unknown[];
}

/** One clip of a tier-2 vector: decodes in whole micrometres at key and in-between times, plus mirror and text checks. */
export interface Tier2Clip {
  restSrc: string;
  dur: number;
  loop: boolean;
  textSha256: string;
  parseTextSame: boolean;
  mirrorSha256: string;
  mirrorTwiceSame: boolean;
  keys: { t: number; at: number[] }[];
  between: { t: number; at: number[] }[];
}

/** A tier-2 vector file (one set). */
export interface Tier2 {
  points: string[];
  bodies: Record<string, Record<string, unknown>>;
  clips: Record<string, Tier2Clip>;
}

/** Tier 3's bodies of other proportions. */
export interface Tier3 {
  bodies: Record<string, { from: string; proportions?: Record<string, number>; rest: Record<string, unknown> }>;
}

const read = <T>(rel: string): T => JSON.parse(readFileSync(join(VECTORS, rel), "utf8")) as T;

/** Tier 1a: `rig` or `cmu-09_02`. */
export const loadTier1a = (name: "rig" | "cmu-09_02"): Tier1a => read<Tier1a>(`tier1a/${name}.json`);
/** Tier 2 for one set: QUATERNIUS, MESH2MOTION or CMU. */
export const loadTier2 = (set: string): Tier2 => read<Tier2>(`tier2/${set}.json`);
/** The sets tier 2 covers. */
export const tier2Sets = (): string[] => readdirSync(join(VECTORS, "tier2")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
/** Tier 3's bodies. */
export const loadTier3 = (): Tier3 => read<Tier3>("tier3/bodies.json");
/** A tier-1b text input (the CMU skeleton or take), as latin1 text. */
export const tier1bText = (rel: string): string => readFileSync(join(VECTORS, "tier1b", rel), "latin1");

/** Tier 1b's rig as the binary glTF a reader takes: the .gltf's JSON (minus the buffer's uri) and its decoded buffer. */
export function tier1bRigGlb(): Uint8Array {
  const gltf = read<{ buffers: { byteLength: number; uri: string }[] } & Record<string, unknown>>("tier1b/rig.gltf");
  const bin = Buffer.from(gltf.buffers[0]!.uri.split(",")[1]!, "base64");
  const json = { ...gltf, buffers: [{ byteLength: gltf.buffers[0]!.byteLength }] };
  return packGlb(json, bin);
}

/** Pack glTF JSON and one buffer as .glb: JSON padded with spaces, the buffer with zeros (glTF 2.0, §4.4). */
export function packGlb(json: unknown, bin: Uint8Array): Uint8Array {
  let js = Buffer.from(JSON.stringify(json));
  if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - (js.length % 4), 0x20)]);
  const pad = bin.length % 4 ? 4 - (bin.length % 4) : 0;
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length + pad, 8);
  head.writeUInt32LE(js.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(bin.length + pad, 0);
  binHead.writeUInt32LE(0x004e4942, 4);
  return new Uint8Array(Buffer.concat([head, js, binHead, Buffer.from(bin), Buffer.alloc(pad)]));
}

/** SHA-256 as hex. */
export const sha256 = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");

/** Every file the manifest lists whose size or SHA-256 differs, or that is missing. */
export function verifyManifest(): string[] {
  const m = read<{ files: Record<string, { bytes: number; sha256: string }> }>("manifest.json");
  const problems: string[] = [];
  for (const [p, want] of Object.entries(m.files)) {
    const file = join(VECTORS, p);
    if (!existsSync(file)) {
      problems.push(`${p} is missing`);
      continue;
    }
    const data = readFileSync(file);
    if (data.length !== want.bytes || sha256(data) !== want.sha256) problems.push(`${p} does not match the manifest`);
  }
  return problems;
}

/** The first difference between two numeric arrays beyond `tol` (0 = bit for bit, -0 and 0 distinct), or null. */
export function firstDiff(ours: ArrayLike<number>, want: ArrayLike<number>, tol = 0): { index: number; ours: number; want: number } | null {
  if (ours.length !== want.length) return { index: -1, ours: ours.length, want: want.length };
  for (let i = 0; i < want.length; i++) {
    const a = ours[i]!;
    const b = want[i]!;
    if (tol === 0 ? !Object.is(a, b) : !(Math.abs(a - b) <= tol)) return { index: i, ours: a, want: b };
  }
  return null;
}

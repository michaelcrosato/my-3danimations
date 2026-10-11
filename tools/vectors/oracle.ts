// The oracles: my-3d2dge's JavaScript originals at the pinned commit, run unchanged from the pins cache
// (.cache/src/my-3d2dge, fetched by `npm run pins -- fetch`). The codec (src/mocap/readable.js) and the set files run
// in `vm` contexts as the origin's own tools load them; the CMU reader is imported as the module it is. The glTF
// reader, `readLibrary` in tools/anim-import.mjs, is a script with no exports: its text up to the run section is
// written next to the cache with an export appended, its relative imports pointed at the cache, and imported with the
// command line it expects. Nothing in the function bodies changes.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

/** Where the pins cache keeps my-3d2dge (see tools/pins.json). */
export function originDir(root: string): string {
  return join(root, ".cache/src/my-3d2dge");
}

/** A captured clip, as the importer hands it to `fit`: n frames of 36 body points (f, r, z mm) and root motion. */
export interface Capture {
  name: string;
  n: number;
  dur: number;
  loop: boolean;
  fps: number;
  data: Float32Array;
  move: Float32Array | null;
  take?: string;
}

/** A format-1 key pose: `t` plus named arrays of numbers. */
export type Key = { t: number } & Record<string, number[] | number>;

/** A format-1 clip as the codec reads and writes it. */
export interface Clip1 {
  clip?: string;
  src?: string;
  dur: number;
  loop?: boolean;
  keys: Key[];
  [field: string]: unknown;
}

/** The origin's codec object, MocapReadable (only the members the vectors use are typed). */
export interface MR {
  POINTS: string[];
  P: number;
  LEGEND: string;
  measure(clips: Record<string, Capture>, tpose?: string): Record<string, unknown>;
  fit(rest: unknown, cap: Capture, tol: number, extra?: Record<string, unknown>): { clip: Clip1; max: number; mean: number };
  reduce(cap: Capture, tol: number): number[];
  encode(rest: unknown, cap: Capture, kf: number[], extra?: Record<string, unknown>): Clip1;
  pose(rest: unknown, clip: Clip1, t: number, out?: Float32Array): Float32Array;
  keyAt(clip: Clip1, t: number): Record<string, number[]>;
  text(clip: Clip1): string;
  parse(text: string | Clip1): Clip1;
  mirror(clip: Clip1): Clip1;
}

/** A format-1 set as my-3d2dge's set files define it. */
export interface Set1 {
  set: string;
  sources: Record<string, { rest: Record<string, unknown> } & Record<string, unknown>>;
  fit: Record<string, number[]>;
  clips: Record<string, Clip1>;
  [field: string]: unknown;
}

/** Load the origin's codec in a fresh vm context, as tools/mocap-lib.mjs does. */
export function loadCodec(root: string): MR {
  const file = join(originDir(root), "src/mocap/readable.js");
  const sandbox: Record<string, unknown> = {};
  vm.runInNewContext(readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.MocapReadable as MR;
}

/** Load one of the origin's set files (it assigns window.MOCAP[name]). */
export function loadSet(root: string, name: string): Set1 {
  const file = join(originDir(root), "src/mocap/sets", `${name}.js`);
  const sandbox: { window: { MOCAP?: Record<string, Set1> } } = { window: {} };
  vm.runInNewContext(readFileSync(file, "utf8"), sandbox, { filename: file });
  const sets = Object.values(sandbox.window.MOCAP ?? {});
  if (sets.length !== 1) throw new Error(`${file} should define one set, found ${sets.length}`);
  return sets[0]!;
}

/** Run `fn` with console.log and console.warn captured; returns its result and the lines. */
export async function quietly<T>(fn: () => Promise<T> | T): Promise<{ value: T; log: string[] }> {
  const log: string[] = [];
  const { log: l, warn: w } = console;
  console.log = (...a: unknown[]) => void log.push(a.join(" "));
  console.warn = (...a: unknown[]) => void log.push(a.join(" "));
  try {
    return { value: await fn(), log };
  } finally {
    console.log = l;
    console.warn = w;
  }
}

/** The origin's glTF reader: readLibrary(file) -> { rig, clips, body }, loaded with `--sources <id>` on its command line. */
export async function loadGlbReader(root: string, workDir: string, glbPath: string, sourceId: string): Promise<(file: string) => { rig: string; clips: Record<string, Capture>; body: unknown }> {
  const tools = join(originDir(root), "tools");
  const src = readFileSync(join(tools, "anim-import.mjs"), "utf8");
  const cut = src.indexOf("/* ---- read every library, fit every clip ---- */");
  if (cut < 0) throw new Error("anim-import.mjs: the run section moved; update tools/vectors/oracle.ts");
  let body = src.slice(0, cut);
  for (const dep of ["mocap-lib.mjs", "asf-amc.mjs", "cmu.mjs"]) body = body.replace(`'./${dep}'`, `'${pathToFileURL(join(tools, dep)).href}'`);
  body += "\nexport { readLibrary };\n";
  mkdirSync(workDir, { recursive: true });
  const lib = join(workDir, "anim-import-lib.mjs");
  writeFileSync(lib, body);
  const argv = process.argv;
  process.argv = [argv[0]!, join(tools, "anim-import.mjs"), glbPath, "--sources", sourceId];
  try {
    const mod = (await import(`${pathToFileURL(lib).href}?v=${Date.now()}`)) as { readLibrary: (file: string) => { rig: string; clips: Record<string, Capture>; body: unknown } };
    return mod.readLibrary;
  } finally {
    process.argv = argv;
  }
}

/** The origin's CMU reader: readCmu(asfFile, picks, fps). */
export async function loadCmuReader(root: string): Promise<(asf: string, picks: unknown[], fps: number) => { rig: string; clips: Record<string, Capture>; body: unknown }> {
  const mod = (await import(pathToFileURL(join(originDir(root), "tools/asf-amc.mjs")).href)) as { readCmu: (asf: string, picks: unknown[], fps: number) => { rig: string; clips: Record<string, Capture>; body: unknown } };
  return mod.readCmu;
}

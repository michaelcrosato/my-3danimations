// Run by play.test.ts as `node --expose-gc packages/three/test/alloc.ts`: how many bytes a frame of the adapter's write
// allocates (the heap left after 120,000 frames less that after 20,000, over the 100,000), and what a whole update
// (core's step and pose, then the write) costs a frame, as JSON.
import { Animator } from "@m3a/core";
import { libraryClips } from "../../../tools/qa/qa.ts";
import { attach, bind } from "../src/index.ts";
import { writer } from "../src/play/index.ts";
import { character, loadGlb, variant } from "../test-characters/index.ts";

const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) throw new Error("run with node --expose-gc");
const walk = libraryClips().find((c) => c.clip.id === "QUATERNIUS_3D2DGE/Walk_Loop")!.clip;
const b = bind((await loadGlb(character(variant(2)).glb)).scene), a = new Animator(b.core).layer("base", { clip: walk });
const att = attach(a, b), w = writer(b), poses = Array.from({ length: 8 }, () => (att.update(1 / 60), structuredClone(att.pose)));
const heap = () => (gc(), process.memoryUsage().heapUsed);
/** The heap the write leaves after n frames (from a collected heap, not collected after). */
const left = (n: number) => {
  const h = heap();
  for (let i = 0; i < n; i++) w.write(poses[i % poses.length]!);
  return process.memoryUsage().heapUsed - h;
};
// warm up, then the write alone (the adapter's hot path) over 20,000 and 120,000 frames: what a frame allocates is
// the difference over the 100,000 between (what both leave alike is the engine's one-off, not a frame's)
left(5000);
const short = left(20_000), long = left(120_000), write = (long - short) / 100_000;
// a whole update (core's step and pose, then the write), for the record
const h0 = heap();
const t0 = performance.now();
for (let i = 0; i < 2000; i++) att.update(1 / 60);
const ms = (performance.now() - t0) / 2000, update = (process.memoryUsage().heapUsed - h0) / 2000;
console.log(JSON.stringify({ writeBytes: write, short, long, updateBytes: update, updateMs: ms }));

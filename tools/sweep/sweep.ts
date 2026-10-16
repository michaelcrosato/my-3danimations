// The sweep (PLAN.md WP-4.5): every migrated clip played on each given skeleton (bound by WP-4.3, played by core's
// Animator in Node with its feet planted, solved onto the bones), the sensors (WP-3.3) run on what it plays, and a
// clip-by-skeleton result with every failure and its reason. A clip passes on a skeleton when the skeleton adds no fail
// finding (D80): its data is sound (no non-number, events in order), the sensors find no metric past its fail level that
// was under it on the clip's own body, read the same way (the clip's own defects are the clip's, not the skeleton's: 29%
// of the library fails as qa reads it, 10% as the sweep reads it, by parts every 1/60 s), and the bones reach every
// mapped joint's point within 5 mm. A metric the skeleton takes past its warn level only is listed with the row. That
// judge is @m3a/tools' (packages/tools/src/tools/judge.ts, retarget.apply's too); the sweep binds the skeletons.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Clip, Rest } from "@m3a/core";
import { onBody, type OnBody } from "../../packages/tools/src/tools/judge.ts";
import { bind, type ThreeBound } from "../../packages/three/src/index.ts";
import { character, loadGlb, variant } from "../../packages/three/test-characters/index.ts";
import { MANIFEST, rigBytes, type Manifest } from "../fixtures/fixtures.ts";

/** The feet's stretches the clip's own slide is read over (the judge's, which moved to @m3a/tools in WP-7.2b). */
export { likeFor } from "../../packages/tools/src/tools/judge.ts";

/** One clip on one skeleton: whether it passes, why not, and the warns the skeleton added (the judge's row). */
export type SweepRow = OnBody;

/** A skeleton by id: `gen-<seed>` for a generated test character, else a real rig fetched by `npm run fixtures`. */
export async function rigOf(id: string, manifest?: string): Promise<ThreeBound> {
  const gen = /^gen-(-?\d+)$/.exec(id);
  if (gen) return bind((await loadGlb(character(variant(Number(gen[1]))).glb)).scene);
  const m = JSON.parse(readFileSync(manifest ?? MANIFEST, "utf8")) as Manifest, bytes = rigBytes(id, m);
  if (!bytes) throw new Error(`sweep: no rig "${id}" in the cache: npm run fixtures -- fetch${manifest ? ` --manifest ${manifest}` : ""} (rigs: ${m.rigs.map((r) => r.id).join(", ")}, or gen-<seed>)`);
  return bind((await loadGlb(bytes, { textures: false })).scene);
}

/** Plays one clip (on its own rest R) on one skeleton and judges what the skeleton added (the judge's onBody, D80). */
export function sweepOne(clip: Clip, R: Rest, b: ThreeBound, rig: string): SweepRow {
  return onBody(clip, R, b.core, rig);
}

/** A gate's latest held-out run: its directory's name, its rig manifest and the rigs that manifest lists. */
export function heldout(gate: string, base = join(import.meta.dirname, "../../bench/results/heldout")): { run: string; manifest: string; rigs: string[] } {
  const dir = join(base, gate), runs = existsSync(dir) ? readdirSync(dir).filter((d) => /^run-\d+$/.test(d) && existsSync(join(dir, d, "rig.json"))) : [];
  const run = runs.sort((a, b) => Number(a.slice(4)) - Number(b.slice(4))).pop();
  if (!run) throw new Error(`sweep: no held-out run for ${gate} yet (bench/results/heldout/${gate}/run-<n>/rig.json; PLAN.md §9.3)`);
  const manifest = join(dir, run, "rig.json"), m = JSON.parse(readFileSync(manifest, "utf8")) as { rigs: { id: string }[] };
  return { run, manifest, rigs: m.rigs.map((r) => r.id) };
}

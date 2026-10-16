// A run's filmstrip (PLAN.md WP-6.5; spec/SIM.md §2): frames spread over the run, each labelled with its time and the
// states playing, drawn at one scale with the camera following the character, side by side (the sensors' mannequin).
// `strip` draws any poses so (the film tool's clips too).
import { raster, type Image } from "@m3a/sensors";
import type { SimResult } from "./simulate.ts";

/**
 * Poses (36 body points each) where their roots put them, as one image of frames `size` px wide side by side, each
 * labelled: one scale for every frame (the tightest), each centred where the character is, in the three-quarter view.
 */
export function strip(frames: readonly ArrayLike<number>[], roots: readonly (raster.Root | undefined)[], labels: readonly string[], size = 160): Image {
  const w = size, h = Math.round(size * 1.25), view = "three-quarter" as const, top = (raster.GLYPH.height + 4) * raster.labelScale(w);
  const fits = frames.map((X, i) => raster.fit(view, w, h, [raster.capsules(X, roots[i]).flatMap((c) => [...c.a, ...c.b])], { top }));
  const scale = Math.min(...fits.map((f) => f.scale));
  return raster.join(frames.map((X, k) => raster.render(X, { width: w, height: h, root: roots[k], view, label: labels[k], camera: raster.camera(view, w, h, scale, fits[k]!.center) })), { gap: 2 });
}

/**
 * `count` frames of a run, from its first step to its last (a run simulated with poses), as one image, each `size` px
 * wide; what each frame shows is the states playing then, from the trace.
 */
export function filmstrip(run: Pick<SimResult, "frames" | "root" | "trace">, count = 8, size = 160): Image {
  const n = run.frames.length;
  if (!n || count < 1) throw new Error("filmstrip: the run has no frames: simulate it with poses");
  const at = [...new Set(Array.from({ length: Math.min(count, n) }, (_, i) => (count === 1 ? n - 1 : Math.round((i * (n - 1)) / (count - 1)))))];
  const label = (step: number) => {
    // the latest state each layer entered by this step; a layer over the base shown only when it isn't at its start
    const now = new Map<string, string>(), starts = new Map<string, string>();
    for (const s of run.trace.states) {
      if (s.from === null) starts.set(s.layer, s.state);
      if (s.step <= step) now.set(s.layer, s.state);
    }
    const shown = [...now].filter(([layer, state], i) => i === 0 || state !== starts.get(layer)).map(([, state]) => state);
    return `${((step + 1) / run.trace.rate).toFixed(2)} S ${shown.join("+")}`.toUpperCase();
  };
  return strip(at.map((i) => run.frames[i]!), at.map((i) => run.root[i]), at.map(label), size);
}

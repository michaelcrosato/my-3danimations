// Side-by-side and difference images (PLAN.md WP-3.2; carried from my-3d2dge's tools/filmstrip.mjs --compare): two
// images of the same size (two clips' sheets at one camera, or two builds' renders) as three rows: A, B, and A dimmed
// with every differing pixel in magenta and the changed region boxed in red. A diff of identical inputs is empty.
import type { Rest } from "@m3a/core";
import { image, join, rect, type Image, type Rgb } from "../raster/image.ts";
import { sheet, tokens, type Sheet, type SheetClip, type SheetOptions } from "./sheet.ts";

/** Where two images differ: the count of differing pixels, their bounding box (null when none), and the image. */
export interface Diff {
  /** Pixels that differ in any channel. */
  changed: number;
  /** The smallest box holding every differing pixel, or null when the images are the same. */
  box: { x: number; y: number; w: number; h: number } | null;
  /** A, B and the marked row, stacked (or the marked row alone, with `marked`). */
  image: Image;
  tokens: number;
}

const MAGENTA: Rgb = [236, 0, 236];
const BOX: Rgb = [214, 40, 40];

/** Compares two images of one size pixel for pixel; `marked` returns only the third row (A dimmed, changes marked). */
export function diff(a: Image, b: Image, opts: { marked?: boolean; tolerance?: number } = {}): Diff {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`diff needs two images of one size, not ${a.width} × ${a.height} and ${b.width} × ${b.height}: draw both with one camera (raster.fit over both)`);
  const tol = opts.tolerance ?? 0, W = a.width, H = a.height, m = image(W, H), A = a.data, B = b.data, M = m.data;
  let changed = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const differs = Math.abs(A[i]! - B[i]!) > tol || Math.abs(A[i + 1]! - B[i + 1]!) > tol || Math.abs(A[i + 2]! - B[i + 2]!) > tol || Math.abs(A[i + 3]! - B[i + 3]!) > tol;
      if (differs) {
        changed++;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
        M[i] = MAGENTA[0];
        M[i + 1] = MAGENTA[1];
        M[i + 2] = MAGENTA[2];
      } else {
        // A dimmed toward white, so the magenta stands out
        M[i] = 255 - (255 - A[i]!) * 0.35;
        M[i + 1] = 255 - (255 - A[i + 1]!) * 0.35;
        M[i + 2] = 255 - (255 - A[i + 2]!) * 0.35;
      }
      M[i + 3] = 255;
    }
  }
  const box = changed ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null;
  if (box) {
    const p = 3;
    rect(m, box.x - p, box.y - p, box.w + 2 * p, 2, BOX);
    rect(m, box.x - p, box.y + box.h + p - 2, box.w + 2 * p, 2, BOX);
    rect(m, box.x - p, box.y - p, 2, box.h + 2 * p, BOX);
    rect(m, box.x + box.w + p - 2, box.y - p, 2, box.h + 2 * p, BOX);
  }
  const out = opts.marked ? m : join([a, b, m], { down: true, gap: 4 });
  return { changed, box, image: out, tokens: tokens(out) };
}

/** Two clips' sheets at the same times, on one camera framing both and under one title, and their diff. */
export function compareClips(a: SheetClip, b: SheetClip, R: Rest, opts: SheetOptions & { marked?: boolean } = {}): Diff & { a: Sheet; b: Sheet } {
  // one camera, one title and the same times for both, so only the motion can differ
  const title = opts.title ?? `${a.id ?? "A"} / ${b.id ?? "B"}`;
  const sa = sheet(a, R, { ...opts, title, with: [b] }), sb = sheet(b, R, { ...opts, title, with: [a] });
  return { ...diff(sa.image, sb.image, { marked: opts.marked ?? false }), a: sa, b: sb };
}

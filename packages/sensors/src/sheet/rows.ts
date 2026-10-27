// Rows of body points as one sheet (WP-F.18, the engine sheet): each row one body's 36 points at the same moments (a
// clip's own pose; an engine's, read back from its bones), drawn as the sheets' mannequin on one camera and one scale,
// so where a row parts from the one above shows at a glance; under each cell a line of the numbers a host compares them
// by. Sized to a token budget as a sheet is.
import { blit, image, type Image } from "../raster/image.ts";
import { GLYPH, text, textWidth } from "../raster/font.ts";
import { camera, fit, type View, type ViewName } from "../raster/view.ts";
import { capsules, drawCapsules, drawFloor, labelScale } from "../raster/mannequin.ts";
import { tokens } from "./sheet.ts";

/** One row: its label, its points at each moment (format frame, mm), and a line of text under each cell. */
export interface PointRow {
  label: string;
  frames: readonly ArrayLike<number>[];
  notes?: readonly string[];
}

/** How to draw the rows: a named view or an orbit (three-quarter), the image's width (1,000) and token budget (1,800),
 *  and its title. */
export interface PointRowsOptions {
  view?: ViewName | View;
  width?: number;
  budget?: number;
  title?: string;
}

/** The rows drawn: the image, its size and approximate tokens. */
export interface PointRows {
  image: Image;
  width: number;
  height: number;
  tokens: number;
}

const INK: [number, number, number] = [40, 40, 40];

/** Draws `rows` at `times` (one column a moment), every cell on one camera fitted to every pose. Throws when a row's
 *  frames don't match the times. */
export function pointRows(rows: readonly PointRow[], times: readonly number[], opts: PointRowsOptions = {}): PointRows {
  for (const r of rows) if (r.frames.length !== times.length) throw new Error(`pointRows: row ${r.label} has ${r.frames.length} frames for ${times.length} times; give one a moment`);
  const cols = Math.max(1, times.length), view = opts.view ?? "three-quarter", maxW = opts.width ?? 1000, budget = opts.budget ?? 1800;
  let cw = Math.floor(maxW / cols), ch = 0, H = 0, ls = 1, note = 0;
  const layout = () => {
    ls = labelScale(cols * cw);
    ch = Math.round(cw * 1.25);
    note = rows.some((r) => r.notes) ? GLYPH.height * ls + 6 : 0;
    H = (GLYPH.height + 6) * ls + rows.length * (ch + note);
  };
  for (layout(); cw > 24 && tokens({ width: cols * cw, height: H }) > budget; cw--) layout();
  const W = cols * cw, top = (GLYPH.height + 6) * ls, img = image(W, H), cellLabel = (GLYPH.height + 3) * labelScale(cw);
  const parts = rows.map((r) => r.frames.map((X) => capsules(X)));
  const cam0 = fit(view, cw, ch, parts.flat().map((p) => p.flatMap((c) => [...c.a, ...c.b])), { top: cellLabel, pad: 80 });
  rows.forEach((r, j) => {
    times.forEach((t, i) => {
      const cell = image(cw, ch), cam = camera(view, cw, ch, cam0.scale, cam0.center);
      drawFloor(cell, cam, [0, 0]);
      drawCapsules(cell, cam, parts[j]![i]!);
      text(cell, 3, 3, `${r.label} ${t.toFixed(2)} S`, INK, labelScale(cw));
      blit(img, cell, i * cw, top + j * (ch + note));
      const n = r.notes?.[i];
      if (n) {
        const s = labelScale(cw), fitted = n.length && textWidth(n, s) > cw - 4 ? n.slice(0, Math.max(1, Math.floor((cw - 4) / (GLYPH.advance * s)))) : n;
        text(img, i * cw + 2, top + j * (ch + note) + ch + 3, fitted, INK, s);
      }
    });
  });
  text(img, 4, 3 * ls, opts.title ?? `${rows.map((r) => r.label).join(" / ")}  ${times.length} FRAMES  ${typeof view === "string" ? view : `${view.yaw}°/${view.pitch}°`}`, INK, ls);
  return { image: img, width: W, height: H, tokens: tokens(img) };
}

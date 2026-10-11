// Contact sheets and filmstrips (PLAN.md WP-3.2; carried from my-3d2dge's tools/anim-sheet.mjs, rows of eight frames):
// a clip's frames at their times, in one view and at one scale, so they compare at a glance. Overlays: a marker under
// each planted foot, the feet's trails, the intervals a check flagged (in red), and a timeline of contacts and flags.
// Each sheet states its size and its approximate cost in tokens, and is sized to stay within a budget.
import { clip as clipNs, format, measureFacts, type Clip, type Rest } from "@m3a/core";
import { blit, image, line, rect, type Image, type Rgb } from "../raster/image.ts";
import { GLYPH, text, textWidth } from "../raster/font.ts";
import { camera, fit, project, type Camera, type View, type ViewName } from "../raster/view.ts";
import { capsules, COLORS, drawCapsules, drawFloor, labelScale } from "../raster/mannequin.ts";

/** A clip as a sheet reads it: its timing, keys, and (when it has them) its id and contacts. */
export type SheetClip = Pick<Clip, "dur" | "loop" | "keys"> & Partial<Pick<Clip, "id" | "contacts" | "events">>;

/** An interval a check flagged: drawn in red on the cells it covers and on the timeline. */
export interface Flag {
  t0: number;
  t1: number;
  label?: string;
}

/** How to draw a sheet. */
export interface SheetOptions {
  /** A named view or an azimuth and elevation (three-quarter). */
  view?: ViewName | View;
  /** How many frames (16, or one every `every` seconds). */
  frames?: number;
  /** A frame every this many seconds, instead of `frames`. */
  every?: number;
  /** Frames per row (8). */
  columns?: number;
  /** The widest the sheet may be, in pixels (1,000). */
  width?: number;
  /** The most tokens the image may cost (1,400: a 1,000 × 1,000 image is about 1,333). */
  budget?: number;
  /** Mark planted feet (true). */
  contacts?: boolean;
  /** Draw the feet's trails (true). */
  trails?: boolean;
  /** Intervals to flag in red. */
  flags?: readonly Flag[];
  /** The title (the clip's id, its duration and the view). */
  title?: string;
  /** Other clips to frame with, at the same times: sheets drawn with each other's clips here share one camera. */
  with?: readonly SheetClip[];
}

/** A drawn sheet: the image, its size and cost, the times drawn, and where each cell is. */
export interface Sheet {
  image: Image;
  width: number;
  height: number;
  /** Approximate tokens the image costs a model (width × height / 750). */
  tokens: number;
  times: number[];
  cells: { x: number; y: number; w: number; h: number; t: number }[];
  /** The camera every cell is drawn with (cell pixels: add a cell's x and y for the sheet's). */
  camera: Camera;
}

/** Approximate tokens an image costs a model to read: about width × height / 750 (1,333 for 1,000 × 1,000). */
export const tokens = (img: { width: number; height: number }): number => Math.ceil((img.width * img.height) / 750);

const RED: Rgb = [214, 40, 40];
const INK: Rgb = [60, 60, 60];
const DARK = { L: [30, 80, 150], R: [160, 100, 20] } as const;
type V = [number, number, number];
const pt = (X: ArrayLike<number>, n: string): V => [X[format.IDX[n]! * 3]!, X[format.IDX[n]! * 3 + 1]!, X[format.IDX[n]! * 3 + 2]!];
/** A foot's lowest sole point: the heel (below the ankle), the ball or the toe. */
function sole(X: ArrayLike<number>, s: string, R: Rest): V {
  const heel = pt(X, "ankle" + s);
  return [[heel[0], heel[1], heel[2] - R.ankleZ] as V, pt(X, "ball" + s), pt(X, "toe" + s)].reduce((m, v) => (v[2] < m[2] ? v : m));
}

/** The times a sheet draws: a loop's cycle without its repeated end, a one-shot from start to end inclusive. */
export function sheetTimes(clip: SheetClip, opts: Pick<SheetOptions, "frames" | "every"> = {}): number[] {
  const dur = clip.dur;
  if (opts.every && opts.every > 0) {
    const out: number[] = [];
    for (let i = 0; i * opts.every <= dur + 1e-9 && out.length < 256; i++) out.push(Math.min(dur, i * opts.every));
    return out;
  }
  const n = Math.max(1, Math.round(opts.frames ?? 16));
  if (n === 1 || !(dur > 0)) return [0];
  return Array.from({ length: n }, (_, i) => (clip.loop ? (i * dur) / n : (i * dur) / (n - 1)));
}

/**
 * A contact sheet: the clip's frames on rest R, one scale for all, each labelled with its time, in rows of `columns`;
 * planted feet marked, the feet's trails, flagged intervals in red, and a timeline. Sized to `width` and `budget`.
 */
export function sheet(clip: SheetClip, R: Rest, opts: SheetOptions = {}): Sheet {
  const times = sheetTimes(clip, opts), n = times.length, cols = Math.max(1, Math.min(opts.columns ?? 8, n)), rows = Math.ceil(n / cols);
  const maxW = opts.width ?? 1000, budget = opts.budget ?? 1400, view = opts.view ?? "three-quarter";
  // the cells' size: as wide as the width allows, then smaller until the whole image is within the budget
  let cw = Math.floor(maxW / cols), ch = 0, H = 0;
  const layout = () => {
    ch = Math.round(cw * 1.25);
    const ls = labelScale(cols * cw);
    H = (GLYPH.height + 6) * ls + rows * ch + timelineHeight(ls);
  };
  for (layout(); cw > 24 && tokens({ width: cols * cw, height: H }) > budget; cw--) layout();
  const W = cols * cw, ls = labelScale(W), top = (GLYPH.height + 6) * ls;
  const img = image(W, H);
  const contacts = opts.contacts === false ? undefined : (clip.contacts ?? measureFacts(clip as Clip, R).contacts);
  const playing = { ...clip, contacts };
  const at = (c: SheetClip, t: number) => clipNs.sample(c, c.loop && t >= c.dur ? c.dur * (1 - 1e-12) : t, R);
  const poses = times.map((t) => at(clip, t));
  const parts = poses.map((X) => capsules(X));
  // one scale and centre for every cell, from all the frames and trails (and those of the clips to frame with)
  const trail = opts.trails === false ? [] : trails(clip, R);
  const framed = [clip, ...(opts.with ?? [])].flatMap((c) => [...times.map((t) => capsules(at(c, t)).flatMap((p) => [...p.a, ...p.b])), ...(opts.trails === false ? [] : trails(c, R).map((p) => p.flat()))]);
  const cellLabel = (GLYPH.height + 3) * labelScale(cw);
  const cam0 = fit(view, cw, ch, framed, { top: cellLabel, pad: 80 });
  const flags = opts.flags ?? [];
  const cells: Sheet["cells"] = [];
  times.forEach((t, i) => {
    const x = (i % cols) * cw, y = top + Math.floor(i / cols) * ch, cell = image(cw, ch), cam = camera(view, cw, ch, cam0.scale, cam0.center);
    drawFloor(cell, cam, [0, 0]);
    for (const [s, path] of trail.entries()) for (let j = 1; j < path.length; j++) {
      const a = project(cam, path[j - 1]!), b = project(cam, path[j]!);
      line(cell, a[0], a[1], b[0], b[1], s === 0 ? [168, 196, 232] : [236, 206, 150]);
    }
    drawCapsules(cell, cam, parts[i]!);
    // a planted foot's marker on the floor under its sole, drawn over the body so the foot can't hide it
    if (contacts) {
      const on = clipNs.contactsAt(playing, t);
      for (const s of ["L", "R"] as const) if (on[`foot${s}`]) marker(cell, project(cam, [...sole(poses[i]!, s, R).slice(0, 2), 0] as V), Math.max(3, Math.round(cw / 28)), DARK[s]);
    }
    const flagged = flags.some((f) => t >= f.t0 - 1e-9 && t <= f.t1 + 1e-9);
    text(cell, 3, 3, `${t.toFixed(2)} S`, flagged ? RED : INK, labelScale(cw));
    if (flagged) frame(cell, RED, Math.max(2, Math.round(cw / 60)));
    else frame(cell, [220, 218, 212], 1);
    blit(img, cell, x, y);
    cells.push({ x, y, w: cw, h: ch, t });
  });
  const title = opts.title ?? `${clip.id ?? "clip"}  ${clip.dur.toFixed(2)} S${clip.loop ? " LOOP" : ""}  ${n} FRAMES  ${typeof view === "string" ? view : `${view.yaw}°/${view.pitch}°`}`;
  text(img, 4, 3 * ls, fitText(title, W - 8, ls), INK, ls);
  timeline(img, top + rows * ch, ls, clip, contacts, flags, times);
  return { image: img, width: W, height: H, tokens: tokens(img), times, cells, camera: camera(view, cw, ch, cam0.scale, cam0.center) };
}

/** A filmstrip: one row of frames (`frames` of them, 8 by default), as a sheet. */
export function filmstrip(clip: SheetClip, R: Rest, opts: SheetOptions = {}): Sheet {
  const frames = opts.frames ?? 8;
  return sheet(clip, R, { ...opts, frames, columns: frames });
}

/** Each foot's lowest sole point over the clip, on the floor (z = 0), every 1/30 s: the trails. */
function trails(clip: SheetClip, R: Rest): V[][] {
  const n = Math.max(2, Math.ceil(clip.dur * 30));
  const out: V[][] = [[], []];
  for (let i = 0; i <= n; i++) {
    const t = (clip.dur * i) / n, X = clipNs.sample(clip, clip.loop && i === n ? clip.dur * (1 - 1e-12) : t, R);
    ["L", "R"].forEach((s, k) => {
      const p = sole(X, s, R);
      out[k]!.push([p[0], p[1], 0]);
    });
  }
  return out;
}
/** A diamond marker centred on (x, y). */
function marker(img: Image, at: readonly number[], r: number, c: Rgb): void {
  const cx = Math.round(at[0]!), cy = Math.round(at[1]!);
  for (let dy = -r; dy <= r; dy++) {
    const w = r - Math.abs(dy);
    rect(img, cx - w, cy + dy, 2 * w + 1, 1, Math.abs(dy) === r || w === 0 ? [20, 20, 20] : c);
  }
}
/** A frame round an image's edge, `w` pixels wide. */
function frame(img: Image, c: Rgb, w: number): void {
  rect(img, 0, 0, img.width, w, c);
  rect(img, 0, img.height - w, img.width, w, c);
  rect(img, 0, 0, w, img.height, c);
  rect(img, img.width - w, 0, w, img.height, c);
}
/** `s` cut to fit `px` pixels at font scale `k`. */
function fitText(s: string, px: number, k: number): string {
  let out = s;
  while (out.length > 1 && textWidth(out, k) > px) out = out.slice(0, -1);
  return out;
}

/** The timeline's height at font scale k: two contact lanes, a flag lane and the time labels. */
const timelineHeight = (k: number): number => (3 * 6 + GLYPH.height + 8) * k;
/** The timeline: the clip's span, the frames drawn as ticks, each foot's contacts on its lane, and flags in red. */
function timeline(img: Image, y0: number, k: number, clip: SheetClip, contacts: SheetClip["contacts"], flags: readonly Flag[], times: number[]): void {
  const x0 = 6 * k, x1 = img.width - 6 * k, X = (t: number) => x0 + ((x1 - x0) * Math.min(Math.max(t, 0), clip.dur)) / (clip.dur || 1), lane = 5 * k;
  const lanes: [string, Rgb, [number, number][]][] = [
    ["L", COLORS.left, contacts?.footL ?? []],
    ["R", COLORS.body, contacts?.footR ?? []],
    ["!", RED, flags.map((f) => [f.t0, f.t1] as [number, number])],
  ];
  lanes.forEach(([, c, iv], i) => {
    const y = y0 + 4 * k + i * 6 * k;
    rect(img, x0, y, x1 - x0, lane, [228, 226, 220]);
    for (const [a, b] of iv) {
      // a loop's contact can run past the end: it wraps to the start
      for (const [p, q] of clip.loop && b > clip.dur ? [[a, clip.dur], [0, b - clip.dur]] : [[a, b]]) rect(img, X(p!), y, Math.max(1, X(q!) - X(p!)), lane, c);
    }
  });
  for (const t of times) line(img, X(t), y0 + 2 * k, X(t), y0 + 3 * k + 3 * 6 * k, [150, 150, 150]);
  const ly = y0 + 4 * k + 3 * 6 * k + 1;
  text(img, x0, ly, "0", INK, k);
  const end = `${clip.dur.toFixed(2)} S`;
  text(img, x1 - textWidth(end, k), ly, end, INK, k);
}


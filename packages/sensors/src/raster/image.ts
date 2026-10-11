// An RGBA8 image and the few drawing primitives the raster needs (PLAN.md WP-3.1): fill, a pixel, a filled rectangle, a
// line, side-by-side composition, and the non-blank check. Plain arrays only, so it runs in a browser and in Node, and
// the same calls give the same bytes in every run and every engine.

/** An RGBA image: width × height pixels, 4 bytes each, rows top to bottom. */
export interface Image {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** A colour: [r, g, b] or [r, g, b, a], 0 to 255. */
export type Rgb = readonly [number, number, number] | readonly [number, number, number, number];

/** The background every view starts from: a light warm grey. */
export const BACKGROUND: Rgb = [244, 243, 239];

/** A new image filled with `bg` (the background colour). */
export function image(width: number, height: number, bg: Rgb = BACKGROUND): Image {
  if (!(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width * height <= 64e6)) throw new RangeError(`an image is 1 to 64 million whole pixels, not ${width} × ${height}`);
  const img: Image = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  fill(img, bg);
  return img;
}

/** Fills the whole image with colour c. */
export function fill(img: Image, c: Rgb): void {
  const d = new Uint32Array(img.data.buffer, img.data.byteOffset, img.width * img.height);
  // the bytes in memory order r, g, b, a, as one little- or big-endian word
  const probe = new Uint8ClampedArray(4);
  probe.set([c[0], c[1], c[2], c[3] ?? 255]);
  d.fill(new Uint32Array(probe.buffer)[0]!);
}

/** Paints pixel (x, y) with colour c (alpha-blended when c has an alpha below 255); off the image does nothing. */
export function pixel(img: Image, x: number, y: number, c: Rgb): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4, a = c[3] ?? 255, d = img.data;
  if (a >= 255) {
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  } else if (a > 0) {
    d[i] = d[i]! + ((c[0] - d[i]!) * a) / 255;
    d[i + 1] = d[i + 1]! + ((c[1] - d[i + 1]!) * a) / 255;
    d[i + 2] = d[i + 2]! + ((c[2] - d[i + 2]!) * a) / 255;
  }
}

/** A filled rectangle, clipped to the image. */
export function rect(img: Image, x: number, y: number, w: number, h: number, c: Rgb): void {
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y)), x1 = Math.min(img.width, Math.round(x + w)), y1 = Math.min(img.height, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) pixel(img, xx, yy, c);
}

/** A line from (x0, y0) to (x1, y1), `width` pixels wide (whole pixels, no smoothing, so pixels never vary). */
export function line(img: Image, x0: number, y0: number, x1: number, y1: number, c: Rgb, width = 1): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))), h = (width - 1) / 2;
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n - h), y = Math.round(y0 + ((y1 - y0) * i) / n - h);
    if (width <= 1) pixel(img, x, y, c);
    else rect(img, x, y, Math.max(1, Math.round(width)), Math.max(1, Math.round(width)), c);
  }
}

/** Copies `src` into `dst` with its top-left corner at (x, y), clipped. */
export function blit(dst: Image, src: Image, x: number, y: number): void {
  for (let sy = 0; sy < src.height; sy++) {
    const dy = y + sy;
    if (dy < 0 || dy >= dst.height) continue;
    const x0 = Math.max(0, -x), x1 = Math.min(src.width, dst.width - x);
    if (x1 <= x0) continue;
    dst.data.set(src.data.subarray((sy * src.width + x0) * 4, (sy * src.width + x1) * 4), (dy * dst.width + x + x0) * 4);
  }
}

/** Images side by side (or stacked, `down`), `gap` pixels apart, on the background. */
export function join(images: readonly Image[], opts: { down?: boolean; gap?: number; bg?: Rgb } = {}): Image {
  const gap = opts.gap ?? 0;
  const w = opts.down ? Math.max(...images.map((i) => i.width)) : images.reduce((s, i) => s + i.width, 0) + gap * (images.length - 1);
  const h = opts.down ? images.reduce((s, i) => s + i.height, 0) + gap * (images.length - 1) : Math.max(...images.map((i) => i.height));
  const out = image(w, h, opts.bg);
  let at = 0;
  for (const i of images) {
    if (opts.down) blit(out, i, 0, at);
    else blit(out, i, at, 0);
    at += (opts.down ? i.height : i.width) + gap;
  }
  return out;
}

/** The share of pixels that differ from the background (0 for a blank image). */
export function coverage(img: Image, bg: Rgb = BACKGROUND): number {
  const d = img.data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] !== bg[0] || d[i + 1] !== bg[1] || d[i + 2] !== bg[2]) n++;
  return n / (img.width * img.height);
}

/** Throws when an image is blank (under a thousandth of its pixels drawn): a view that missed its subject. */
export function assertNotBlank(img: Image, what = "the image", bg: Rgb = BACKGROUND): void {
  const c = coverage(img, bg);
  if (c < 0.001) throw new Error(`${what} is blank (${(c * 100).toFixed(3)}% of pixels drawn): check the view's centre and scale, or that the pose has points`);
}

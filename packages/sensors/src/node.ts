// @m3a/sensors/node: the sensors' Node entry (PLAN.md §5.1), the only module that imports Node built-ins: PNG files
// through node:zlib.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { encodePng, type Image } from "./raster/index.ts";

/** An image as PNG bytes, compressed with node:zlib at level 9 (the same bytes for the same image, every run). */
export function png(img: Image): Uint8Array {
  return encodePng(img, (raw) => deflateSync(raw, { level: 9 }));
}

/** Writes an image as a PNG file; returns its size in bytes. */
export function writePng(path: string, img: Image): number {
  const bytes = png(img);
  writeFileSync(path, bytes);
  return bytes.length;
}

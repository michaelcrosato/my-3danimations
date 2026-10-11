// PNG encoding (PLAN.md WP-3.1; carried from riftlight's scripts/png.ts): RGBA8, filter 0 on every row, one IDAT. The
// compressor is passed in, so this module runs anywhere; the Node entry (`@m3a/sensors/node`) passes node:zlib's.
import type { Image } from "./image.ts";

/** A zlib compressor (RFC 1950): raw bytes in, a zlib stream out. */
export type Deflate = (raw: Uint8Array) => Uint8Array;

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
/** The CRC-32 a PNG chunk carries. */
export function crc32(buf: Uint8Array): number {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** An image as PNG bytes. The same image and compressor give the same bytes every time. */
export function encodePng(img: Image, deflate: Deflate): Uint8Array {
  const ihdr = new Uint8Array(13), v = new DataView(ihdr.buffer);
  v.setUint32(0, img.width);
  v.setUint32(4, img.height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const row = img.width * 4, raw = new Uint8Array((row + 1) * img.height);
  for (let y = 0; y < img.height; y++) raw.set(img.data.subarray(y * row, (y + 1) * row), y * (row + 1) + 1);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflate(raw)), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

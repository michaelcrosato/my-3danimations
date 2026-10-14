// A zip archive read entry by entry (PLAN.md WP-5.6; carried from my-3d2dge tools/cmu.mjs `cmuAll`): node has no
// unzip. The central directory is found from the end record, then each entry is read from its local header, stored or
// deflated, and kept only if its CRC-32 matches. Reading goes through `read(pos, n)`, so the archive can be a file on
// disk or a file on the web read by ranged requests (100STYLE's: one take costs its own bytes). ZIP64 isn't read: the
// corpora's archives are under 4 GB with under 65,535 entries.
import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { crc32, inflateRawSync } from "node:zlib";

/** Bytes at an offset of an archive: `n` of them from `pos`. */
export type ReadAt = (pos: number, n: number) => Buffer;
/** One entry of an archive's central directory. */
export interface ZipEntry {
  /** Its path in the archive. */
  name: string;
  /** 0 stored, 8 deflated. */
  method: number;
  /** Bytes in the archive, and unpacked. */
  csize: number;
  size: number;
  crc: number;
  /** Where its local header starts. */
  local: number;
}

/** A refused archive: what's wrong and where. */
export class ZipError extends Error {}

const u16 = (b: Buffer, at: number) => b.readUInt16LE(at), u32 = (b: Buffer, at: number) => b.readUInt32LE(at);

/** Every entry of an archive of `size` bytes, from its central directory. */
export function zipEntries(read: ReadAt, size: number): ZipEntry[] {
  const tailLen = Math.min(size, 65_557), tail = read(size - tailLen, tailLen), eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > tail.length) throw new ZipError("not a zip archive: no end-of-central-directory record in its last 64 KB");
  const n = u16(tail, eocd + 10), dirLen = u32(tail, eocd + 12), dirAt = u32(tail, eocd + 16);
  if (n === 0xffff || dirAt === 0xffffffff) throw new ZipError("a ZIP64 archive, which isn't read");
  if (dirAt + dirLen > size) throw new ZipError(`its central directory (${dirLen} bytes at ${dirAt}) runs past the end (${size} bytes)`);
  const dir = read(dirAt, dirLen), out: ZipEntry[] = [];
  let p = 0;
  for (let i = 0; i < n; i++) {
    if (p + 46 > dir.length || u32(dir, p) !== 0x02014b50) throw new ZipError(`central directory entry ${i} (at ${dirAt + p}) isn't one`);
    const nl = u16(dir, p + 28), xl = u16(dir, p + 30), cl = u16(dir, p + 32);
    out.push({ name: dir.toString("latin1", p + 46, p + 46 + nl), method: u16(dir, p + 10), crc: u32(dir, p + 16), csize: u32(dir, p + 20), size: u32(dir, p + 24), local: u32(dir, p + 42) });
    p += 46 + nl + xl + cl;
  }
  return out;
}

/** An entry's bytes, unpacked, its CRC-32 checked. */
export function zipRead(read: ReadAt, e: ZipEntry): Buffer {
  const lh = read(e.local, 30);
  if (u32(lh, 0) !== 0x04034b50) throw new ZipError(`${e.name}: no local header at ${e.local}`);
  const data = read(e.local + 30 + u16(lh, 26) + u16(lh, 28), e.csize);
  if (e.method !== 0 && e.method !== 8) throw new ZipError(`${e.name}: compression method ${e.method} isn't read (stored or deflated only)`);
  const out = e.method === 8 ? inflateRawSync(data) : data;
  if (out.length !== e.size || crc32(out) !== e.crc) throw new ZipError(`${e.name}: unpacked to ${out.length} bytes with CRC-32 ${crc32(out).toString(16)}; the archive says ${e.size} bytes, ${e.crc.toString(16)}`);
  return out;
}

/** An archive on disk, read by offset; `close` when done. */
export function zipFile(file: string): { read: ReadAt; size: number; close(): void } {
  const fd = openSync(file, "r");
  const read: ReadAt = (pos, n) => {
    const b = Buffer.alloc(n);
    let got = 0;
    while (got < n) {
      const k = readSync(fd, b, got, n - got, pos + got);
      if (k === 0) throw new ZipError(`${file}: ${n} bytes at ${pos} run past its end`);
      got += k;
    }
    return b;
  };
  return { read, size: fstatSync(fd).size, close: () => closeSync(fd) };
}

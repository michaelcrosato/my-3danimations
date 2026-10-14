// Downloads for the corpora (PLAN.md WP-5.6): through curl, which honours the environment's proxy and reads file://
// URLs too (the tests serve a corpus from a folder), and SHA-256 sums of files too large to hold in memory.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync, readSync } from "node:fs";

/** Downloads a URL to a file (an HTTP error fails it; three retries). */
export function download(url: string, to: string): void {
  execFileSync("curl", ["-fsSL", "--retry", "3", "--max-time", "3600", "-o", to, url], { stdio: ["ignore", "ignore", "pipe"] });
}

/** A file's SHA-256, read 16 MB at a time (an archive can be gigabytes). */
export function fileSha256(file: string): string {
  const h = createHash("sha256"), fd = openSync(file, "r"), b = Buffer.alloc(16 << 20);
  try {
    for (let k: number; (k = readSync(fd, b, 0, b.length, null)) > 0; ) h.update(b.subarray(0, k));
  } finally {
    closeSync(fd);
  }
  return h.digest("hex");
}

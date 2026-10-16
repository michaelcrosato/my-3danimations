// A preload for the race between two m3a processes editing one clip (tools-change.test.ts), loaded with --import. With
// M3A_RACE=pause the process stops right after it renames an edit's history into place (before the clip's own write),
// says "paused" on stderr and waits there until a file m3a-race-go appears in its working directory; with M3A_RACE=wait
// it says "waiting" on stderr the first time it finds a lock file taken. node:fs is patched and the builtin ESM exports
// synced, so the m3a modules' own imports see the patch.
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { sep } from "node:path";

const how = process.env.M3A_RACE;
if (how === "pause") {
  const rename = fs.renameSync;
  fs.renameSync = (from: fs.PathLike, to: fs.PathLike) => {
    rename(from, to);
    if (!String(to).includes(`${sep}.m3a${sep}history${sep}`)) return;
    process.stderr.write("paused\n");
    const cell = new Int32Array(new SharedArrayBuffer(4));
    while (!fs.existsSync("m3a-race-go")) Atomics.wait(cell, 0, 0, 5);
  };
}
if (how === "wait") {
  const write = fs.writeFileSync;
  let said = false;
  fs.writeFileSync = ((file: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView, opts?: fs.WriteFileOptions) => {
    try {
      write(file, data, opts);
    } catch (err) {
      if (!said && (err as NodeJS.ErrnoException).code === "EEXIST" && String(file).endsWith(".lock")) {
        said = true;
        process.stderr.write("waiting\n");
      }
      throw err;
    }
  }) as typeof fs.writeFileSync;
}
syncBuiltinESMExports();

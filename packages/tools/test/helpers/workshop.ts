// A workshop clip as m3a's edit tools leave one, for tests that make it by hand: the clip's file, and a history that is
// that file's (its head the file's revision, no undo or redo) naming the library clip it came from and, unless given,
// the rest that clip's set's manifest lists for the clip's restSrc.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Rest } from "@m3a/core";
import { historyFile, revisionOf, workshopFile, type History } from "../../src/tools/workshop.ts";
import { ROOT } from "./cwd.ts";

/** The rest a library set's manifest lists under `key`. */
export const manifestRest = (set: string, key: string): Rest => (JSON.parse(readFileSync(join(ROOT, "library/sets", set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources[key]!.rest;

/** Writes workshop clip `name` in `cwd`: `text` as its file, and its history from library clip `from` on `rest`. */
export function workshopClip(cwd: string, name: string, text: string, from: string, rest?: Rest): void {
  const h: History = { from, rest: rest ?? manifestRest(from.split("/")[0]!, (JSON.parse(text) as { restSrc: string }).restSrc), recipe: null, text, head: revisionOf(text), undo: [], redo: [] };
  for (const [f, t] of [[workshopFile(name), text], [historyFile(name), JSON.stringify(h)]]) {
    mkdirSync(join(cwd, f, ".."), { recursive: true });
    writeFileSync(join(cwd, f), t);
  }
}

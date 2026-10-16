// The set writer (spec/MOTION.md §9; moved from tools/migrate by WP-7.2b, D93): a set's files as the library reads
// them, from its manifest and its clips. Each clip is written by core's `serialize` as `<Name>.json`, the manifest as
// `_set.json` (one field a line, each source and each legend line on its own) with its content id (§9.2) filled in, and
// `catalog.tsv`, a row a clip within the row budget. Runs anywhere: the SHA-256 is core's unless one is given (Node's
// is faster), and the token count that cuts a row's description is given too (the repository's tooling counts cl100k
// tokens; without one, a token is counted every two bytes, more than cl100k counts).
import { recipe, serialize, type Clip } from "@m3a/core";
import { contentId } from "../load/library.ts";

/** A text's token count, as a catalog row's budget counts it. */
export type Tokens = (text: string) => number;

/** A catalog row's token budget (DOCTRINE.md principle 1). */
export const ROW_BUDGET = 40;

/** A token count that errs high: a token every two bytes of UTF-8 (cl100k gives the library's rows one every 1.96
 *  characters at most, and a token is at least a byte). */
const rough: Tokens = (t) => Math.ceil(new TextEncoder().encode(t).length / 2);

/** A set manifest as text: one field per line, each source on a line of its own, the legend one line per line. */
export function setText(m: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(m)) {
    if (k === "sources") {
      const s = Object.entries(v as Record<string, unknown>).map(([id, src]) => `  ${JSON.stringify(id)}: ${JSON.stringify(src)}`);
      lines.push(`"sources": {\n${s.join(",\n")}\n}`);
    } else if (k === "legend") {
      const l = v as { version: string; text: string[] };
      lines.push(`"legend": {"version": ${JSON.stringify(l.version)}, "text": [\n${l.text.map((t) => `  ${JSON.stringify(t)}`).join(",\n")}\n]}`);
    } else lines.push(`${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  }
  return `{\n${lines.join(",\n")}\n}\n`;
}

/** A description cut to fit `room` tokens: its first sentence, then the last clause that fits, then whole words and "…". */
export function shorten(what: string, room: number, tokens: Tokens = rough): string {
  const fits = (t: string) => tokens(t) <= room;
  if (fits(what)) return what;
  const first = what.split(/(?<=\.) /)[0]!.replace(/\.$/, "");
  if (fits(first)) return first;
  const cuts = [...first.matchAll(/[,:;]/g)].map((m) => m.index!).reverse();
  for (const i of cuts) if (fits(first.slice(0, i))) return first.slice(0, i);
  const words = first.split(" ");
  while (words.length > 1 && !fits(words.join(" ") + "…")) words.pop();
  return words.join(" ") + "…";
}

/** One catalog row: id, seconds, loop or once, speed, tags, what the body does, source (spec/MOTION.md §9.3), within
 *  ROW_BUDGET tokens by `tokens`. */
export function catalogRow(c: Clip, tokens: Tokens = rough): string {
  const speed = c.facts && typeof c.facts.speed === "number" ? String(c.facts.speed) : "";
  const cols = [c.id, String(c.dur), c.loop ? "loop" : "once", speed, c.tags.join(" "), "", c.provenance.src];
  const room = ROW_BUDGET - tokens(cols.join("\t"));
  cols[5] = shorten(c.desc || c.name.replace(/_/g, " "), room, tokens);
  return cols.join("\t");
}

/**
 * A set's files, by name: each clip as `<Name>.json` (its id's part after the "/"), `catalog.tsv` and `_set.json`, the
 * manifest with `content.sha256` set from the clip files (spec/MOTION.md §9.2), in its own order otherwise. `sha256`
 * hashes a text's UTF-8 bytes (core's by default); `tokens` counts a catalog row's.
 */
export function setFiles(manifest: Record<string, unknown> & { content: Record<string, unknown> }, clips: readonly Clip[], opts: { sha256?: (text: string) => string; tokens?: Tokens } = {}): Map<string, string> {
  const sha = opts.sha256 ?? recipe.sha256, files = new Map<string, string>(), hashes: Record<string, string> = {};
  for (const c of clips) {
    const name = `${c.id.slice(c.id.indexOf("/") + 1)}.json`, text = serialize(c);
    files.set(name, text);
    hashes[name] = sha(text);
  }
  files.set("catalog.tsv", `${clips.map((c) => catalogRow(c, opts.tokens)).join("\n")}\n`);
  files.set("_set.json", setText({ ...manifest, content: { ...manifest.content, sha256: contentId(hashes, sha) } }));
  return files;
}

// A clip written into a checkout's library (PLAN.md §5.9, WP-9.1a): through @m3a/library's writer (core's serialize,
// then setFiles: the clip file, catalog.tsv's row and _set.json's content id), the set's entry in sets.lock.json
// written (that set's alone), and every file it changed kept, so a closed pull request's files are restored as they
// were. A tier's intake set is made on its first clip: its manifest (the tier, the source whose rest the clip decodes
// on, the legend the other sets carry) and an empty warnings baseline. And a scratch checkout: the library copied under
// the OS's temp directory, which a dry run writes into instead of the repository.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import { parseClip, type Clip } from "@m3a/core";
import { setFiles, type LibraryLock } from "@m3a/library";
import { INTAKE_SETS } from "../../packages/tools/src/tools/library-submit.ts";
import { ROOT } from "../run/cli.ts";
import { sha256 } from "./host.ts";

/** What the adopt bot's writer is, in an intake set's manifest. */
export const ADOPT_PRODUCER = { tool: "m3a-adopt", version: "1" } as const;

/** A clip written: its set and id, the files changed (relative to the checkout), and `restore`, which puts each back as
 *  it was (a file it made removed, a set it made gone). */
export interface Written {
  set: string;
  id: string;
  files: string[];
  restore(): void;
}

/** The tier an intake set holds, by its name; undefined for any other set. */
export const intakeTier = (set: string): "cc0" | "cc-by" | "cmu" | undefined => (Object.entries(INTAKE_SETS) as ["cc0" | "cc-by" | "cmu", string][]).find(([, s]) => s === set)?.[0];

/** A new intake set's manifest for `tier`, holding the source `key` (copied from the set that has it) and the
 *  legend. */
function intakeManifest(set: string, tier: "cc0" | "cc-by" | "cmu", key: string, source: unknown, legend: unknown): Record<string, unknown> & { content: Record<string, unknown> } {
  const credit = tier === "cc0" ? {} : { credit: `Clips adopted from the m3a intake queue, each derived from ${tier === "cc-by" ? "CC BY 4.0" : "CMU's"} clips: credit each as its own credit line says.` };
  return { set, title: `The intake's adopted clips (${tier})`, format: "2.0", tier, content: { edition: "the clips the owner adopted from the intake queue (PLAN.md §5.9)", importer: "m3a-adopt 1", sha256: "" }, ...credit, producer: ADOPT_PRODUCER, sources: { [key]: source }, legend };
}

/** The set of the checkout's library that defines source `key` (its rest), first by name, with its manifest. */
function sourceSet(sets: string, key: string): { sources: Record<string, unknown>; legend: unknown } {
  for (const s of readdirSync(sets).sort()) {
    const f = join(sets, s, "_set.json");
    if (!existsSync(f)) continue;
    const m = JSON.parse(readFileSync(f, "utf8")) as { sources: Record<string, unknown>; legend: unknown };
    if (m.sources[key]) return m;
  }
  throw new Error(`no set in the library defines the rest "${key}": a clip is made on a library rest (each set's _set.json lists its sources)`);
}

/** Writes `clip` (its id SET/Name) into its set of the checkout at `root` through the library's writer, the set made
 *  first when it is a tier's intake set, then the lock; returns what it changed and how to restore it. */
export function writeClip(root: string, clip: Clip): Written {
  const sets = join(root, "library/sets"), [set, name] = clip.id.split("/") as [string, string], dir = join(sets, set), lockPath = join(root, "library/sets.lock.json");
  const before = new Map<string, string | null>(), made = !existsSync(dir), keep = (p: string) => before.has(p) || before.set(p, existsSync(p) ? readFileSync(p, "utf8") : null);
  let manifest: Record<string, unknown> & { content: Record<string, unknown>; sources: Record<string, unknown> }, clips: Clip[];
  if (made) {
    const tier = intakeTier(set);
    if (!tier) throw new Error(`no set ${set} in the library: an adopted clip joins its tier's intake set (${Object.values(INTAKE_SETS).join(", ")}) or the set of the clip it improves`);
    const from = sourceSet(sets, clip.restSrc);
    manifest = intakeManifest(set, tier, clip.restSrc, from.sources[clip.restSrc], from.legend) as typeof manifest;
    clips = [clip];
  } else {
    manifest = JSON.parse(readFileSync(join(dir, "_set.json"), "utf8")) as typeof manifest;
    if (!manifest.sources[clip.restSrc]) manifest.sources = { ...manifest.sources, [clip.restSrc]: sourceSet(sets, clip.restSrc).sources[clip.restSrc] };
    const names = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
    clips = [...new Set([...names, `${name}.json`])].sort().map((f) => (f === `${name}.json` ? clip : parseClip(readFileSync(join(dir, f), "utf8"))));
  }
  mkdirSync(dir, { recursive: true });
  const out = setFiles(manifest, clips, { sha256, tokens: (t) => encode(t).length });
  if (made) out.set("_baseline.json", `${JSON.stringify({ about: "Validator warnings accepted per clip, each with its reason: an adopted clip carries none (the intake's lint gate).", clips: {} }, null, 1)}\n`);
  for (const [f, text] of out) {
    const p = join(dir, f);
    if (existsSync(p) && readFileSync(p, "utf8") === text) continue;
    keep(p);
    writeFileSync(p, text);
  }
  // the set's own entry in the lock, every other set's left as it is (a file changed outside the writer stays named)
  keep(lockPath);
  const lock = JSON.parse(readFileSync(lockPath, "utf8")) as LibraryLock, files = Object.fromEntries([...out].filter(([f]) => f.endsWith(".json") && !f.startsWith("_")).map(([f, t]) => [f, sha256(t)]).sort(([a], [b]) => (a < b ? -1 : 1)));
  lock.sets = Object.fromEntries(Object.entries({ ...lock.sets, [set]: { content: (JSON.parse(out.get("_set.json")!) as { content: { sha256: string } }).content.sha256, files } }).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 1)}\n`);
  return {
    set, id: clip.id, files: [...before.keys()].map((p) => p.slice(root.length + 1)).sort(),
    restore() {
      for (const [p, t] of before) if (t === null) rmSync(p, { force: true });
      else writeFileSync(p, t);
      if (made) rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** A scratch checkout: the repository's library (its sets, lock, licenses and baselines; never library/local/) copied
 *  into a fresh directory under the OS's temp directory; returns its root. */
export function scratchCheckout(root: string = ROOT): string {
  const to = mkdtempSync(join(tmpdir(), "m3a-adopt-"));
  cpSync(join(root, "library"), join(to, "library"), { recursive: true, filter: (src) => !src.startsWith(join(root, "library/local")) });
  return to;
}

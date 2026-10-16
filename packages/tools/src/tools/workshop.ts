// The workshop (PLAN.md WP-7.2a §3, carried from shardfall's revisioned edits): an edited clip lives in
// workshop/<Name>.json (id WORKSHOP/<Name>), its history in .m3a/history/<Name>.json: the library clip it came from and
// that clip's rest, the revision it last wrote, the recipe since the copy, undo and redo stacks of whole file texts (at
// most 32 each), and the last request it applied. A revision is the first 12 hex digits of the file's SHA-256, or
// "absent". A file whose revision isn't its history's head was changed outside m3a: undo refuses, the next edit starts
// a new history. Writes go history first, then the clip (a failed clip write puts the history back), after the target's
// revision is read again; the history's `last` closes the crash window between the write and the registry's record.
import { recipe, type Rest } from "@m3a/core";
import { ToolError, type ToolContext, type ToolOutput } from "../registry/registry.ts";
import { quote } from "../registry/schema.ts";
import { historyFile, WORKSHOP, WORKSHOP_NAME, workshopFile } from "./clips.ts";

/** The most entries each of a clip's undo and redo stacks keeps (shardfall's HISTORY_LIMIT). */
export const HISTORY_LIMIT = 32;

/** One state of a workshop clip: its revision, its file's text (null when there was no file), and its origin, rest and
 *  recipe as its history held them. */
export interface Entry extends Pick<History, "from" | "rest" | "recipe"> {
  revision: string;
  text: string | null;
}

/** The request a history's last write applied: its id, its arguments (canonical JSON), the revision it was applied at
 *  and what it replied, so a retry whose record was lost replies it again instead of applying twice. */
export interface LastRequest {
  request_id: string;
  args: string;
  before: string;
  out: ToolOutput;
}

/** A workshop clip's history: the library clip it came from and its rest (clips.ts reads both), the revision it last
 *  wrote, the recipe since the copy (null once a fix or a clip from outside the library breaks the chain), the stacks. */
export interface History {
  from: string;
  rest: Rest;
  head: string;
  recipe: recipe.Recipe | null;
  undo: Entry[];
  redo: Entry[];
  last?: LastRequest;
}

/** A workshop clip as it stands: its id, name and file, the file's text and revision, and its history (null when
 *  none, or `stale`: the head of a history the file has changed under outside m3a). */
export interface Target {
  id: string;
  name: string;
  path: string;
  text: string | null;
  revision: string;
  history: History | null;
  stale: string | null;
}

/** A file's revision: the first 12 hex digits of its text's SHA-256, or "absent" when there is no file. */
export const revisionOf = (text: string | null): string => (text === null ? "absent" : recipe.sha256(text).slice(0, 12));

/** The workshop clip's name an edit writes: save_as's, else the clip's own (SET/Name, WORKSHOP/Name, Name.json); usage
 *  E_ARGS when neither is a WORKSHOP/<Name> (clip JSON needs save_as; the library is never written). */
export function targetName(clip: string, saveAs?: string): string {
  const id = saveAs ?? (/^\s*\{/.test(clip) ? "" : `${WORKSHOP}/${clip.trim().replace(/\.json$/i, "").split("/").pop()}`);
  const name = id.startsWith(`${WORKSHOP}/`) ? id.slice(WORKSHOP.length + 1) : "";
  if (!WORKSHOP_NAME.test(name)) throw new ToolError("E_ARGS", `${saveAs === undefined ? "the clip names no workshop copy" : `save_as is ${quote(saveAs)}`}: give save_as "WORKSHOP/<Name>" (a letter, then letters, digits or _); the library changes only through its writer`, true);
  return name;
}

/** Reads workshop clip `name`: its file, revision and history (an unreadable history counts as none). */
export async function readTarget(ctx: ToolContext, name: string): Promise<Target> {
  const path = workshopFile(name), text = await ctx.tryRead(path), revision = revisionOf(text);
  let h: History | null;
  try {
    h = JSON.parse((await ctx.tryRead(historyFile(name))) ?? "null") as History | null;
  } catch {
    h = null;
  }
  const stale = h && h.head !== revision ? h.head : null;
  return { id: `${WORKSHOP}/${name}`, name, path, text, revision, history: stale ? null : h, stale };
}

const argsOf = (a: Record<string, unknown>) => recipe.canonical({ ...a, request_id: undefined });

/** The request the target's last write applied, when `a` retries it (the same request_id and arguments) and the file
 *  is still what that write left. */
export function replay(t: Target, a: Record<string, unknown>): LastRequest | undefined {
  const last = t.history?.last;
  return last && last.request_id === a.request_id && last.args === argsOf(a) ? last : undefined;
}

/** The edit tools' revision hook: the target's revision, or, for a retry of the request that wrote it, the revision
 *  that request was applied at (so its if_revision still holds and run() replies the first result). */
export async function targetRevision(a: { clip: string; save_as?: string }, ctx: ToolContext): Promise<string> {
  const t = await readTarget(ctx, targetName(a.clip, a.save_as));
  return replay(t, a as Record<string, unknown>)?.before ?? t.revision;
}

/** Refuses (E_EXISTS) to write a copy over a workshop clip that is there, unless the call names its revision. */
export function mayCopy(t: Target, inPlace: boolean, a: Record<string, unknown>): void {
  if (!inPlace && t.text !== null && a.if_revision === undefined) throw new ToolError("E_EXISTS", `${t.id} exists at revision ${t.revision}; change it in place (clip "${t.id}"), give another save_as, or replace it with if_revision "${t.revision}"`);
}

/** The history after an edit writes `text` over `t`: the state before pushed onto undo (the oldest past the limit
 *  dropped), redo cleared; a stale history starts again from the state before. */
export function applied(t: Target, text: string, base: Pick<History, "from" | "rest" | "recipe">): History {
  const h = t.history, now: Entry = { from: h?.from ?? base.from, rest: h?.rest ?? base.rest, recipe: h?.recipe ?? null, revision: t.revision, text: t.text };
  return { ...base, head: revisionOf(text), undo: [...(h?.undo ?? []), now].slice(-HISTORY_LIMIT), redo: [] };
}

/** Undo (or redo): the entry popped from that stack is the text to write back, byte for byte (null removes the file),
 *  and the state now is pushed onto the other. E_HISTORY when the stack is empty or the file changed outside m3a. */
export function back(t: Target, way: "undo" | "redo"): { text: string | null; history: History } {
  const h = t.history, e = h?.[way].at(-1), other = way === "undo" ? "redo" : "undo";
  if (t.stale) throw new ToolError("E_HISTORY", `${t.id} changed outside m3a (revision ${t.revision}, history at ${t.stale}); the next edit starts its history again`);
  if (!h || !e) throw new ToolError("E_HISTORY", `nothing to ${way} for ${t.id}`);
  const now: Entry = { from: h.from, rest: h.rest, recipe: h.recipe, revision: t.revision, text: t.text }, { revision, text, ...state } = e;
  return { text, history: { ...h, ...state, head: revision, [way]: h[way].slice(0, -1), [other]: [...h[other], now].slice(-HISTORY_LIMIT) } };
}

/**
 * Writes `text` (null removes the file) and its history for target `t`, read before the edit was worked out: the
 * revision read again (moved: E_CONFLICT, nothing written), the history (with `last` when the call has a request_id),
 * then the clip, the history put back if that fails. Returns `out`.
 */
export async function commit(ctx: ToolContext, t: Target, text: string | null, h: History, a: Record<string, unknown>, out: ToolOutput): Promise<ToolOutput> {
  const now = revisionOf(await ctx.tryRead(t.path)), file = historyFile(t.name), was = await ctx.tryRead(file);
  if (now !== t.revision) throw new ToolError("E_CONFLICT", `${t.id} moved to revision ${now} during the edit; nothing was changed`);
  const last = typeof a.request_id === "string" ? { request_id: a.request_id, args: argsOf(a), before: t.revision, out } : undefined;
  ctx.write(file, `${JSON.stringify({ ...h, last })}\n`);
  try {
    if (text === null) ctx.remove(t.path);
    else ctx.write(t.path, text);
  } catch (err) {
    if (was === null) ctx.remove(file);
    else ctx.write(file, was);
    throw err;
  }
  return out;
}

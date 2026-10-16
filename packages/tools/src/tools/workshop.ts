// The workshop (PLAN.md WP-7.2a §3, carried from shardfall's revisioned edits): an edited clip lives in
// workshop/<Name>.json (id WORKSHOP/<Name>), its history in .m3a/history/<Name>.json: the library clip it came from and
// that clip's rest, the revision and text it last wrote, the recipe since the copy, undo and redo stacks of whole file
// texts (32 entries in all), and the requests its last writes applied. A revision is the first 12 hex digits of the file's
// SHA-256, or "absent". Writes go history first, then the clip (a failed clip write puts the history back), under the
// clip's lock (.m3a/locks/<Name>.lock, held across m3a processes) once the target's revision and history are read
// again, so of two edits from one state the second is refused (E_CONFLICT) and none is lost. A file a step from the
// history's head is a write cut short between the two: the history steps back to it (a cut-short apply's result is
// dropped, never offered to redo). Any other file the history doesn't know was changed outside m3a: undo refuses, the
// next edit starts a new history. The history keeps the requests of its last 8 writes, which closes the crash window
// between a write and the registry's record for each of them.
import { recipe, type Rest } from "@m3a/core";
import { ToolError, type ToolContext, type ToolOutput } from "../registry/registry.ts";
import { quote } from "../registry/schema.ts";

/** The workshop's set name: WORKSHOP/<Name> is the edited clip in workshop/<Name>.json. */
export const WORKSHOP = "WORKSHOP";
/** A workshop clip's name: a letter, then letters, digits or "_", at most 100 in all (a file name any file system takes,
 *  with its history's beside it). */
export const WORKSHOP_NAME = /^[A-Za-z][A-Za-z0-9_]{0,99}$/;
/** WORKSHOP_NAME in words, for a refusal. */
export const NAME_RULE = 'a letter, then letters, digits or "_", at most 100 in all';
/** The file a workshop clip lives in. */
export const workshopFile = (name: string): string => `workshop/${name}.json`;
/** The file a workshop clip's history lives in. */
export const historyFile = (name: string): string => `.m3a/history/${name}.json`;

/** The workshop clip a clip argument names: <Name> for WORKSHOP/<Name> or its file's path (workshop/<Name>.json, with
 *  or without ./), null for any other; E_NO_CLIP (usage) for a WORKSHOP/ id whose name breaks the rule. */
export function workshopName(given: string): string | null {
  const id = given.trim().replace(/^(?:\.\/)?workshop\/([A-Za-z][A-Za-z0-9_]*)\.json$/, `${WORKSHOP}/$1`);
  if (!id.startsWith(`${WORKSHOP}/`)) return null;
  const name = id.slice(WORKSHOP.length + 1);
  if (!WORKSHOP_NAME.test(name)) throw new ToolError("E_NO_CLIP", `${quote(id)} is no workshop id: WORKSHOP/<Name>, the name ${NAME_RULE}`, true);
  return name;
}

/** The most entries a clip's undo and redo stacks keep between them (shardfall's HISTORY_LIMIT): an apply drops the
 *  oldest past it, and undo and redo only move entries from one stack to the other. */
export const HISTORY_LIMIT = 32;

/** One state of a workshop clip: its revision, its file's text (null when there was no file), and its origin, rest and
 *  recipe as its history held them. */
export interface Entry {
  from: string;
  rest: Rest;
  recipe: recipe.Recipe | null;
  revision: string;
  text: string | null;
}

/** A request a history's write applied: its tool and id, its arguments (canonical JSON), the revision it was applied at
 *  and what it replied, so a retry whose record was lost replies it again instead of applying twice. */
export interface LastRequest {
  tool: string;
  request_id: string;
  args: string;
  before: string;
  out: ToolOutput;
}

/** A workshop clip's history: the state it last wrote (clips.ts reads its `from` and `rest`; `head` is its revision;
 *  `recipe` is null once a fix or a clip from outside the library breaks the chain), the stacks, the request its last
 *  write applied (`last`) and those of the writes before it (`earlier`, oldest first, REQUESTS_KEPT in all), and what
 *  wrote it (an apply, an undo or a redo). */
export interface History extends Omit<Entry, "revision"> {
  head: string;
  undo: Entry[];
  redo: Entry[];
  last?: LastRequest;
  earlier?: LastRequest[];
  wrote?: "apply" | "undo" | "redo";
}

/** How many requests a history keeps for their retries (its last write's and those before it): a retry whose record
 *  the store lost is replied, not applied again, while it is among them. */
export const REQUESTS_KEPT = 8;

/** A workshop clip as it stands: its id, name and file, the file's text and revision, its history (null when none,
 *  or `stale`: why the history was set aside, the file changed outside m3a or the history unreadable) and that
 *  history's text as read (null when there is no file). */
export interface Target {
  id: string;
  name: string;
  path: string;
  text: string | null;
  revision: string;
  history: History | null;
  stale: string | null;
  raw: string | null;
}

/** A file's revision: the first 12 hex digits of its text's SHA-256, or "absent" when there is no file. */
export const revisionOf = (text: string | null): string => (text === null ? "absent" : recipe.sha256(text).slice(0, 12));

/** The workshop clip's name an edit writes: save_as's, else the clip's own (SET/Name, WORKSHOP/Name, Name.json); usage
 *  E_ARGS when neither is a WORKSHOP/<Name> (clip JSON needs save_as; the library is never written). */
export function targetName(clip: string, saveAs?: string): string {
  const id = saveAs ?? (/^\s*\{/.test(clip) ? "" : `${WORKSHOP}/${clip.trim().replace(/\.json$/i, "").split("/").pop()}`);
  const name = id.startsWith(`${WORKSHOP}/`) ? id.slice(WORKSHOP.length + 1) : "";
  const what = saveAs !== undefined ? `save_as is ${quote(saveAs)}` : id.startsWith(`${WORKSHOP}/`) ? `${quote(id)} is no workshop name` : "the clip names no workshop copy";
  if (!WORKSHOP_NAME.test(name)) throw new ToolError("E_ARGS", `${what}: give save_as "WORKSHOP/<Name>" (${NAME_RULE}); the library changes only through its writer`, true);
  return name;
}

const isText = (v: unknown) => v === null || typeof v === "string";
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v), v3 = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every(num);
const each = (v: unknown, n: number, f: (x: unknown) => boolean) => Array.isArray(v) && (n < 0 || v.length === n) && v.every(f);
const sides = (v: unknown) => typeof v === "object" && v !== null && v3((v as Record<string, unknown>).L) && v3((v as Record<string, unknown>).R);
/** Whether `r` has core's Rest's shape, every number finite: a history's rest broken by hand is set aside, not measured. */
function isRest(r: unknown): r is Rest {
  const o = (r ?? {}) as Record<string, unknown>, nums = ["H0", "hipZ", "ankleZ", "up", "fore", "knuck", "fist", "thigh", "shin", "ab", "bt", "abPitch", "btPitch", "neckW"];
  return typeof r === "object" && nums.every((k) => num(o[k])) && ["Pr", "Cr", "Hr"].every((k) => each(o[k], 3, v3)) && ["hip", "clav", "cv"].every((k) => sides(o[k])) && ["neckSeg", "topH", "faceH"].every((k) => v3(o[k])) && each(o.spine, 4, v3) && each(o.spineW, -1, num);
}
const entry = (e: Partial<Entry> | null) => Boolean(e) && typeof e!.from === "string" && isRest(e!.rest) && typeof e!.recipe === "object" && isText(e!.text);
/** `raw` as a history, or undefined when it isn't one (not JSON, or not its shape). */
function parsed(raw: string): History | undefined {
  try {
    const h = JSON.parse(raw) as History, request = (l: LastRequest) => typeof l?.tool === "string" && typeof l.request_id === "string" && typeof l.args === "string" && typeof l.before === "string" && typeof l.out?.verdict === "string" && typeof l.out.next === "string";
    const stacks = [h.undo, h.redo].every((s) => Array.isArray(s) && s.every((e) => entry(e) && typeof e.revision === "string"));
    const requests = (h.last === undefined || request(h.last)) && (h.earlier === undefined || (Array.isArray(h.earlier) && h.earlier.every(request)));
    return entry(h) && typeof h.head === "string" && stacks && requests ? h : undefined;
  } catch {
    return undefined;
  }
}

/** The history one undo (or redo) on: the entry on top of that stack is the state now, the state before pushed onto
 *  the other stack. */
function step(h: History, way: "undo" | "redo"): History {
  const { revision, ...e } = h[way].at(-1)!, other = way === "undo" ? "redo" : "undo";
  const now: Entry = { from: h.from, rest: h.rest, recipe: h.recipe, revision: h.head, text: h.text };
  return { ...h, ...e, head: revision, wrote: way, [way]: h[way].slice(0, -1), [other]: [...h[other], now] } as History;
}

/** Reads workshop clip `name`: its file, revision and history (set aside as `stale` when unreadable, or when the file
 *  changed outside m3a; stepped back, its request forgotten, when a write was cut short after the history). */
export async function readTarget(ctx: ToolContext, name: string): Promise<Target> {
  const path = workshopFile(name), text = await ctx.tryRead(path), revision = revisionOf(text), raw = await ctx.tryRead(historyFile(name));
  let h = raw === null ? null : parsed(raw), stale = h === undefined ? `has an unreadable history (${historyFile(name)})` : null;
  if (h && h.head !== revision) {
    const way = h.undo.at(-1)?.revision === revision ? "undo" : h.redo.at(-1)?.revision === revision ? "redo" : null;
    const s = way && step(h, way);
    if (s) h = { ...s, redo: h.wrote === "apply" ? [] : s.redo, last: undefined };
    else [stale, h] = [`changed outside m3a (revision ${revision}, history at ${h.head})`, null];
  }
  return { id: `${WORKSHOP}/${name}`, name, path, text, revision, history: h ?? null, stale, raw };
}

const argsOf = (a: Record<string, unknown>) => recipe.canonical({ ...a, request_id: undefined });

/**
 * The request one of the target's last writes applied (its history keeps REQUESTS_KEPT), when `tool` retries it with
 * `a` (the same request_id and arguments). The same request_id with other arguments is usage E_REQUEST_ID, as the
 * registry says it.
 */
export function replay(t: Target, tool: string, a: Record<string, unknown>): LastRequest | undefined {
  const h = t.history, args = argsOf(a), last = [...(h?.earlier ?? []), ...(h?.last ? [h.last] : [])].reverse().find((l) => l.tool === tool && l.request_id === a.request_id);
  if (!last) return undefined;
  if (last.args === args) return last;
  const [was, now] = [last.args, args].map((x) => JSON.parse(x) as Record<string, unknown>);
  const differ = Object.keys({ ...was, ...now }).filter((k) => recipe.canonical(was![k]) !== recipe.canonical(now![k]));
  const fix = "a retry repeats them exactly, a new edit takes a new request_id";
  throw new ToolError("E_REQUEST_ID", `request_id ${quote(a.request_id)} was first used with other arguments (they differ in ${differ.join(", ")}); ${fix}`, true);
}

/** Edit tool `tool`'s revision hook: the target's revision, or, for a retry of the request that wrote it, the revision
 *  that request was applied at (so its if_revision still holds and run() replies the first result). */
export const targetRevision =
  (tool: string) =>
  async (a: { clip: string; save_as?: string }, ctx: ToolContext): Promise<string> => {
    const t = await readTarget(ctx, targetName(a.clip, a.save_as));
    return replay(t, tool, a as Record<string, unknown>)?.before ?? t.revision;
  };

/** Refuses (E_EXISTS) to write a copy over a workshop clip that is there, unless the call names its revision. */
export function mayCopy(t: Target, inPlace: boolean, a: Record<string, unknown>): void {
  if (inPlace || t.text === null || a.if_revision !== undefined) return;
  throw new ToolError("E_EXISTS", `${t.id} exists at revision ${t.revision}; change it in place (clip "${t.id}"), give another save_as, or replace it with if_revision "${t.revision}"`);
}

/** The history after an edit writes `text` (from `base`) over `t`: the state before (its origin and rest the history's,
 *  else `own`'s, else base's) pushed onto undo, the oldest past the limit dropped, redo cleared. */
export function applied(t: Target, text: string, base: Pick<History, "from" | "rest" | "recipe">, own?: Pick<Entry, "from" | "rest">): History {
  const h = t.history, o = h ?? own ?? base, now: Entry = { from: o.from, rest: o.rest, recipe: h?.recipe ?? null, revision: t.revision, text: t.text };
  return { ...base, head: revisionOf(text), text, undo: [...(h?.undo ?? []), now].slice(-HISTORY_LIMIT), redo: [], wrote: "apply" };
}

/** Undo (or redo): the history with the entry on top of that stack as the state now, its text the bytes to write back
 *  (null removes the file). E_HISTORY when the stack is empty or the history was set aside. */
export function back(t: Target, way: "undo" | "redo"): History {
  if (t.stale) throw new ToolError("E_HISTORY", `${t.id} ${t.stale}; the next edit starts its history again`);
  if (!t.history?.[way].length) throw new ToolError("E_HISTORY", `nothing to ${way} for ${t.id}`);
  return step(t.history, way);
}

/** The lock file an edit of workshop clip `name` holds while it writes. */
export const lockOf = (name: string): string => `.m3a/locks/${name}.lock`;

/**
 * Writes history `h` and its text (null removes the file) for target `t`, read before `tool` worked out the edit, under
 * the clip's lock: the revision and the history read again (either moved since, or the revision not the call's
 * if_revision: E_CONFLICT with the revision now, nothing written), the history (with `last` when the call has a
 * request_id, the requests before it kept in `earlier`), then the clip, the history put back if that fails. Returns
 * `out`.
 */
export async function commit(ctx: ToolContext, tool: string, t: Target, h: History, a: Record<string, unknown>, out: ToolOutput): Promise<ToolOutput> {
  const release = await ctx.lock(lockOf(t.name));
  try {
    const now = revisionOf(await ctx.tryRead(t.path)), file = historyFile(t.name), was = await ctx.tryRead(file);
    if (now !== t.revision || was !== t.raw || (typeof a.if_revision === "string" && a.if_revision !== now)) {
      const how = now === t.revision && was !== t.raw ? `'s history moved during the edit (another edit, at revision ${now})` : ` moved to revision ${now} during the edit`;
      throw new ToolError("E_CONFLICT", `${t.id}${how}; nothing was changed`, false, { revision: now, next: `read it again, then retry with --if_revision ${now}` });
    }
    const last = typeof a.request_id === "string" ? { tool, request_id: a.request_id, args: argsOf(a), before: t.revision, out } : undefined;
    const earlier = [...(t.history?.earlier ?? []), ...(t.history?.last ? [t.history.last] : [])].slice(1 - REQUESTS_KEPT);
    ctx.write(file, `${JSON.stringify({ ...h, last, earlier })}\n`);
    try {
      if (h.text === null) ctx.remove(t.path);
      else ctx.write(t.path, h.text);
    } catch (err) {
      if (was === null) ctx.remove(file);
      else ctx.write(file, was);
      throw err;
    }
    return out;
  } finally {
    release();
  }
}

// Deprecation without deletion (PLAN.md WP-9.3): a clip is deprecated by an alias in the lock (`sets.lock.json`'s
// `aliases`, which the loader follows with a warning naming the successor), its file kept, so its id still resolves and
// its lineage stands; an id, once given, is never given to another clip. `checkIds` reads one lock against the next: an
// id that is gone (neither a clip nor an alias), a deprecated clip whose file was deleted, a deprecated id whose file
// came back as another clip, a deprecation taken back or pointed at another successor (an alias, once given, stands as
// it was: every consumer resolves the old id the same way), an alias to an id nothing holds, an alias chain that loops.
import type { LibraryLock } from "../load/index.ts";

/** Something wrong with a lock's ids, or with how they changed from one lock to the next. */
export interface IdProblem {
  code: "dropped" | "deleted" | "reused" | "undeprecated" | "retargeted" | "dangling" | "cycle";
  id: string;
  message: string;
}

/** Every clip id a lock's files give (`SET/Slug`), with its file's SHA-256. */
export function clipIds(lock: LibraryLock): Map<string, string> {
  const out = new Map<string, string>();
  for (const [set, s] of Object.entries(lock.sets)) for (const [file, sha] of Object.entries(s.files)) out.set(`${set}/${file.replace(/\.json$/, "")}`, sha);
  return out;
}

/** The id a deprecated id resolves to through the lock's aliases (itself when it isn't deprecated), and the ids walked;
 *  throws on a chain that loops. */
export function successorOf(lock: LibraryLock, id: string): { id: string; chain: string[] } {
  const chain: string[] = [];
  let at = id;
  while (lock.aliases?.[at] !== undefined) {
    if (chain.includes(at)) throw new Error(`lineage: the aliases loop: ${[...chain, at].join(" → ")}; an alias names a clip that stands`);
    chain.push(at);
    at = lock.aliases[at]!;
  }
  return { id: at, chain };
}

/**
 * The lock with clip `id` deprecated in favour of `successor`: an alias added, nothing removed (the clip's file stays,
 * so its lineage stands, and its id is never given to another clip). Refuses an id the lock has no clip for, one
 * deprecated already, a successor that isn't a clip standing, and the clip itself.
 */
export function deprecate(lock: LibraryLock, id: string, successor: string): LibraryLock {
  const clips = clipIds(lock), aliases = lock.aliases ?? {};
  if (aliases[id] !== undefined) throw new Error(`lineage: ${id} is deprecated already, for ${aliases[id]}; an id is deprecated once`);
  if (!clips.has(id)) throw new Error(`lineage: the lock has no clip ${id}; deprecate a clip the library holds (npm run library -- lock first if it was just written)`);
  if (id === successor) throw new Error(`lineage: ${id} can't succeed itself; name the clip that replaces it`);
  if (!clips.has(successor) || aliases[successor] !== undefined) throw new Error(`lineage: the successor ${successor} isn't a clip that stands${aliases[successor] !== undefined ? ` (it is deprecated for ${aliases[successor]})` : ""}; name one the lock holds`);
  return { ...lock, aliases: Object.fromEntries(Object.entries({ ...aliases, [id]: successor }).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) };
}

/** A lock's ids, and how they changed from `previous` (when given): every problem, sorted by id. */
export function checkIds(next: LibraryLock, previous?: LibraryLock): IdProblem[] {
  const now = clipIds(next), aliases = next.aliases ?? {}, out: IdProblem[] = [];
  for (const [id, to] of Object.entries(aliases)) {
    try {
      const end = successorOf(next, id).id;
      if (!now.has(end)) out.push({ code: "dangling", id, message: `${id} is deprecated for ${to}, and the lock holds no clip ${end}: name a successor that stands` });
    } catch (err) {
      out.push({ code: "cycle", id, message: (err as Error).message });
    }
  }
  if (previous) {
    const was = clipIds(previous), wasAliases = previous.aliases ?? {};
    for (const id of new Set([...was.keys(), ...Object.keys(wasAliases)])) {
      const deprecated = aliases[id] !== undefined;
      if (!now.has(id) && !deprecated) out.push({ code: "dropped", id, message: `${id} is gone: neither a clip nor deprecated; an id stays resolvable, so keep its file and deprecate it for its successor (deprecate(lock, "${id}", successor))` });
      else if (!now.has(id) && was.has(id)) out.push({ code: "deleted", id, message: `${id} is deprecated and its file was deleted: deprecation keeps the clip, so its lineage stands; restore its file` });
      else if (now.has(id) && wasAliases[id] !== undefined && now.get(id) !== was.get(id)) out.push({ code: "reused", id, message: `${id} was deprecated for ${wasAliases[id]}, and its file now holds ${was.has(id) ? "another" : "a"} clip: an id is never given again; name the new clip anew` });
      // an alias stands as it was given: taken back, the old id resolves to its own file again; pointed elsewhere, to
      // another clip (a successor deprecated in its turn leads on through its own alias)
      if (wasAliases[id] !== undefined && deprecated && aliases[id] !== wasAliases[id]) out.push({ code: "retargeted", id, message: `${id} was deprecated for ${wasAliases[id]}, and its alias now names ${aliases[id]}: an alias never changes, so the old id resolves as it did; put back ${wasAliases[id]} (deprecate ${wasAliases[id]} for its own successor to lead on)` });
      else if (wasAliases[id] !== undefined && !deprecated && now.has(id)) out.push({ code: "undeprecated", id, message: `${id} was deprecated for ${wasAliases[id]}, and its alias is gone: a deprecation is never taken back, so the old id resolves as it did; put back its alias to ${wasAliases[id]}` });
    }
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.code < b.code ? -1 : 1));
}

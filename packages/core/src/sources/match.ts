// How a built-in source reads an intent (PLAN.md WP-9.2): the intent's words (lower case, a plural or an -ing taken
// off, a few words that carry nothing left out) against each candidate's name, tags and line about it, and the seed
// picking among the equal best, so a game asking twice with two seeds can get two different matches and the same seed
// always gets the same one.

/** Words that carry no meaning for a match. */
const STOP = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "is", "it", "its", "of", "on", "or", "that", "the", "this", "to", "with"]);

/** A word with a plural's s (or es) or an -ing taken off ("walks" and "walking" read "walk", "running" "run",
 *  "punches" "punch"). */
function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) {
    const s = w.slice(0, -3);
    return s.length > 2 && s[s.length - 1] === s[s.length - 2] ? s.slice(0, -1) : s;
  }
  if (/(ch|sh|x|z|ss)es$/.test(w)) return w.slice(0, -2);
  return w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
}

/** A text's words as a match reads them: lower-case runs of letters and digits, stemmed, without STOP's. */
export function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP.has(w)).map(stem);
}

/** Something a source can make: its name, its tags and a line about it, and what the source makes it from. */
export interface Candidate<T> {
  name: string;
  tags: readonly string[];
  about: string;
  value: T;
}

/**
 * The candidate that best matches `intent`: each of its words scores 3 in a candidate's name, 2 in its tags and 1 in
 * its line about it; among the equal best, the seed picks (`seed % count`, in the order given). Undefined when no word
 * scores. `tied` lists the equal best's names.
 */
export function pick<T>(intent: string, seed: number, candidates: readonly Candidate<T>[]): { chosen: Candidate<T>; tied: string[] } | undefined {
  const want = words(intent);
  const scored = candidates.map((c) => {
    const name = new Set(words(c.name)), tags = new Set(c.tags.flatMap(words)), about = new Set(words(c.about));
    return { c, score: want.reduce((s, w) => s + (name.has(w) ? 3 : 0) + (tags.has(w) ? 2 : 0) + (about.has(w) ? 1 : 0), 0) };
  });
  const best = Math.max(0, ...scored.map((s) => s.score));
  if (best === 0) return undefined;
  const tied = scored.filter((s) => s.score === best).map((s) => s.c);
  return { chosen: tied[seed % tied.length]!, tied: tied.map((c) => c.name) };
}

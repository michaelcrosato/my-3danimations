// The review batches a gallery build carries (WP-F.11): committed queues (`m3a review export`'s, kept in
// bench/results/gates/, G8's among them) that the review page opens at load, so the owner reviews with no file to
// download and upload again. A batch goes into a page only when it holds library clips alone: a submission's text is a
// contributor's and never goes into a public build. `checkBatch` (the Vite config runs it on every batch it bundles)
// fails the build on a batch holding a submission, a key or a value a sampled clip's row has not (every field's type
// and form read, nested ones included), or a row that is no library clip; it never drops a row to make a batch fit,
// and the page gets the batch rebuilt from the values it read, never the file's text. `committed` picks the batches a
// build carries when none are named: the newest in each gate's directory, when it holds no submission and its rows
// name library clips. The page opens the batch its link names (?queue=NAME), else the newest. Pure: no DOM, no file
// system.

/** Where the committed batches are, from the repository's root. */
export const GATES_DIR = "bench/results/gates";

/** The queue's schema id (intake.QUEUE_ID; batches.test.ts holds them equal: the Vite config loads no tools). */
export const QUEUE_SCHEMA = "m3a.review-queue/1";

/** A library clip id, as intake's isClipId reads one (`SET/Clip`): no path can climb out of library/sets with it. */
const CLIP_ID = /^[A-Z][A-Z0-9_]*\/[A-Za-z0-9_-]+$/;
const HASH = /^[0-9a-f]{64}$/, DATE = /^\d{4}-\d{2}-\d{2}$/, METRIC = /^[A-Za-z][A-Za-z0-9]*$/, BY = /^[\w.@-]{1,64}$/;
/** A batch's keys, a sampled clip's row's, its numbers' and its review's (intake.Queue, intake.QueueClip,
 *  intake.QueueNumbers, core's format.Review): any other isn't a batch of clips. */
const QUEUE_KEYS = ["schema", "store", "date", "submissions", "clips"], ROW_KEYS = ["ref", "id", "hash", "tier", "review", "stale", "numbers"];
const NUMBER_KEYS = ["verdict", "findings", "fail", "dur", "keys", "fit", "metrics"], REVIEW_KEYS = ["state", "by", "date", "motion", "note"];
/** The values a field may take: the intake's stores, core's tiers and review states (format.TIERS,
 *  format.REVIEW_STATES), the sensors' verdicts (metrics' Report); batches.test.ts holds them equal. */
export const STORES = ["local", "supabase"], TIERS = ["cc0", "cc-by", "cmu", "local"], REVIEW_STATES = ["approved", "flagged", "unreviewed"], SENSOR_VERDICTS = ["pass", "warn", "fail"];

/** A sampled clip's row as a page carries it: each value read and of its type. */
export interface BatchRow {
  ref: string;
  id: string;
  hash: string;
  tier: string;
  review: { state: string; by: string; date: string; motion: string; note?: string } | null;
  stale: boolean;
  numbers: { verdict: string; findings: number; fail: number; dur: number; keys: number; fit: number[] | null; metrics: Record<string, number> };
}

/** A batch as a page carries it: its name (its path under bench/results/gates/, without `.json`), its path from the
 *  repository's root, its export's date (YYYY-MM-DD), its rows and its JSON text: the queue rebuilt from the values
 *  checkBatch read (never the file's own text). */
export interface Batch {
  name: string;
  path: string;
  date: string;
  clips: number;
  text: string;
}

/** A batch's name from its path: under bench/results/gates/ without `.json` ("G8-run-1/queue-0.56.0"); elsewhere, the
 *  path without `.json`. */
export function batchName(path: string): string {
  const p = path.split("\\").join("/").replace(/^\.\//, "");
  return (p.startsWith(`${GATES_DIR}/`) ? p.slice(GATES_DIR.length + 1) : p).replace(/\.json$/, "");
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
/** The keys of `o` not in `keys`, said ("has keys ... hasn't: a, b"), or null. */
const extra = (o: Obj, keys: readonly string[], what: string) => {
  const k = Object.keys(o).filter((x) => !keys.includes(x));
  return k.length ? `${what} keys a sampled clip's row hasn't: ${k.join(", ")}` : null;
};

/** Why row `r` isn't a sampled library clip's (every key known, every value of its type and form), or its values. */
function readRow(r: unknown, hasClip: (id: string) => boolean): string | BatchRow {
  const id = isObj(r) ? r.id : undefined;
  if (!isObj(r) || typeof id !== "string" || !CLIP_ID.test(id)) return `a row isn't a library clip's: ${JSON.stringify(r)?.slice(0, 80)}`;
  const bad = (why: string) => `row ${id}: ${why}`;
  const keys = extra(r, ROW_KEYS, "it has");
  if (keys) return bad(keys);
  if (typeof r.hash !== "string" || !HASH.test(r.hash)) return bad("its hash isn't 64 hex digits");
  if (r.ref !== `${id}@${r.hash.slice(0, 12)}`) return bad("its ref isn't its id@ and its hash's first 12 digits");
  if (typeof r.tier !== "string" || !TIERS.includes(r.tier)) return bad(`its tier isn't one of ${TIERS.join(", ")}`);
  if (typeof r.stale !== "boolean") return bad("its stale isn't true or false");
  let review: BatchRow["review"] = null;
  if (r.review !== null) {
    const v = r.review;
    if (!isObj(v)) return bad("its review isn't null or a review");
    const k = extra(v, REVIEW_KEYS, "its review has");
    if (k) return bad(k);
    if (typeof v.state !== "string" || !REVIEW_STATES.includes(v.state)) return bad(`its review's state isn't one of ${REVIEW_STATES.join(", ")}`);
    if (typeof v.by !== "string" || !BY.test(v.by) || typeof v.date !== "string" || !DATE.test(v.date) || typeof v.motion !== "string" || !HASH.test(v.motion)) return bad("its review's by, date or motion isn't of its form");
    if (v.note !== undefined && typeof v.note !== "string") return bad("its review's note isn't text");
    review = { state: v.state, by: v.by, date: v.date, motion: v.motion, ...(v.note === undefined ? {} : { note: v.note }) };
  }
  const n = r.numbers;
  if (!isObj(n)) return bad("it has no numbers");
  const k = extra(n, NUMBER_KEYS, "its numbers have");
  if (k) return bad(k);
  if (typeof n.verdict !== "string" || !SENSOR_VERDICTS.includes(n.verdict)) return bad(`its numbers' verdict isn't one of ${SENSOR_VERDICTS.join(", ")}`);
  if (![n.findings, n.fail, n.dur, n.keys].every(num)) return bad("its numbers' findings, fail, dur or keys isn't a number");
  if (n.fit !== null && !(Array.isArray(n.fit) && n.fit.every(num))) return bad("its numbers' fit isn't null or numbers");
  const m = n.metrics;
  if (!isObj(m) || !Object.entries(m).every(([name, v]) => METRIC.test(name) && num(v))) return bad("its numbers' metrics aren't names with numbers");
  if (!hasClip(id)) return `row ${id} is no clip in the library`;
  const numbers: BatchRow["numbers"] = { verdict: n.verdict, findings: n.findings as number, fail: n.fail as number, dur: n.dur as number, keys: n.keys as number, fit: n.fit === null ? null : [...(n.fit as number[])], metrics: { ...(m as Record<string, number>) } };
  return { ref: r.ref, id, hash: r.hash, tier: r.tier, review, stale: r.stale, numbers };
}

/** Why `data` (a queue's JSON text or object) can't go into a page, or the queue rebuilt from the values read: a queue
 *  holding no submission, from a known store, of a date, whose every row is a sampled clip's (`readRow`) naming a clip
 *  `hasClip` finds in the library. */
function read(data: unknown, hasClip: (id: string) => boolean): string | { schema: string; store: string; date: string; submissions: []; clips: BatchRow[] } {
  let q = data;
  if (typeof data === "string") {
    try {
      q = JSON.parse(data);
    } catch {
      return "it isn't JSON";
    }
  }
  if (!isObj(q) || q.schema !== QUEUE_SCHEMA) return `it isn't a ${QUEUE_SCHEMA} queue`;
  if (!Array.isArray(q.submissions) || !Array.isArray(q.clips)) return "it has no submissions and clips lists";
  if (q.submissions.length) return `it holds ${q.submissions.length} submission${q.submissions.length === 1 ? "" : "s"} (a submission's text is a contributor's: never in a page)`;
  const keys = Object.keys(q).filter((k) => !QUEUE_KEYS.includes(k));
  if (keys.length) return `it has keys a batch of clips hasn't: ${keys.join(", ")}`;
  if (typeof q.store !== "string" || !STORES.includes(q.store)) return `its store isn't ${STORES.join(" or ")}`;
  if (typeof q.date !== "string" || !DATE.test(q.date)) return "it has no date (YYYY-MM-DD)";
  const clips: BatchRow[] = [];
  for (const r of q.clips as unknown[]) {
    const row = readRow(r, hasClip);
    if (typeof row === "string") return row;
    clips.push(row);
  }
  return { schema: QUEUE_SCHEMA, store: q.store, date: q.date, submissions: [], clips };
}

/** Why `data` (a queue's JSON text or object) can't go into a page, or null when it can: it is a queue holding no
 *  submission whose every row is a sampled clip's, every key known and every value of its type and form, naming a clip
 *  `hasClip` finds in the library. */
export function unshippable(data: unknown, hasClip: (id: string) => boolean): string | null {
  const q = read(data, hasClip);
  return typeof q === "string" ? q : null;
}

/** The batch at `path` (from the repository's root) with JSON text `text`, checked, its text the queue rebuilt from
 *  the values read; throws, naming it and why, when it can't go into a page (`unshippable`), so a build carrying it
 *  fails. */
export function checkBatch(path: string, text: string, hasClip: (id: string) => boolean): Batch {
  const name = batchName(path), q = read(text, hasClip);
  if (typeof q === "string") throw new Error(`review batch ${name} (${path}) can't go into a page: ${q}. Bundle batches of library clips alone (M3A_REVIEW_BATCHES), or open the file on the page`);
  return { name, path, date: q.date, clips: q.clips.length, text: JSON.stringify(q) };
}

/** The batches newest first: the latest export's date, then the greatest name. */
export function byNewest<T extends { name: string; date: string }>(batches: readonly T[]): T[] {
  return [...batches].sort((a, b) => (a.date === b.date ? (a.name < b.name ? 1 : a.name > b.name ? -1 : 0) : a.date < b.date ? 1 : -1));
}

/** The newest batch (byNewest's first); null for none. */
export function newest<T extends { name: string; date: string }>(batches: readonly T[]): T | null {
  return byNewest(batches)[0] ?? null;
}

/** The committed batches a build carries when M3A_REVIEW_BATCHES names none (`found`: each queue*.json under
 *  bench/results/gates/, its path from the root and its text): the newest queue in each gate's directory (a batch
 *  exported again supersedes the one before: G8-run-1's queue.json by queue-0.56.0.json), when it holds no submission
 *  and its rows all name library clips; the rest left out, each with why. The preview site picks the same
 *  (tools/run/site.ts, which imports nothing from apps/); checkBatch then reads each carried one whole. */
export function committed(found: readonly { path: string; text: string }[], hasClip: (id: string) => boolean): { carried: string[]; left: string[] } {
  const carried: string[] = [], left: string[] = [], queues: { path: string; name: string; date: string; subs: number; strays: number }[] = [];
  for (const { path, text } of found) {
    let q: unknown;
    try {
      q = JSON.parse(text);
    } catch {
      left.push(`${path} (not JSON)`);
      continue;
    }
    if (!isObj(q) || !Array.isArray(q.submissions) || !Array.isArray(q.clips)) {
      left.push(`${path} (not a queue: no submissions and clips lists)`);
      continue;
    }
    const strays = (q.clips as unknown[]).filter((r) => !isObj(r) || typeof r.id !== "string" || !CLIP_ID.test(r.id) || !hasClip(r.id)).length;
    queues.push({ path, name: batchName(path), date: String(q.date ?? ""), subs: q.submissions.length, strays });
  }
  const gate = (name: string) => name.split("/").slice(0, -1).join("/");
  for (const g of [...new Set(queues.map((b) => gate(b.name)))]) {
    const [top, ...rest] = byNewest(queues.filter((b) => gate(b.name) === g));
    for (const b of rest) left.push(`${b.path} (superseded by ${top!.name})`);
    if (top!.subs) left.push(`${top!.path} (${top!.subs} submission${top!.subs === 1 ? "" : "s"})`);
    else if (top!.strays) left.push(`${top!.path} (${top!.strays} row${top!.strays === 1 ? "" : "s"} not library clips)`);
    else carried.push(top!.path);
  }
  return { carried: carried.sort(), left: left.sort() };
}

/** The batch a page's link opens: the one `?queue=NAME` names (`.json` may end it), else the newest; with a problem
 *  said when the link names one the page doesn't carry (the newest stands in). Null with no batches. */
export function pick(batches: readonly Batch[], search: string): { batch: Batch | null; problem: string | null } {
  const asked = new URLSearchParams(search).get("queue")?.trim().replace(/\.json$/, "");
  const named = asked ? batches.find((b) => b.name === asked) : undefined, fallback = newest(batches);
  if (!asked || named) return { batch: named ?? fallback, problem: null };
  const have = batches.length ? `it carries ${batches.map((b) => b.name).join(", ")}` : "it carries none";
  return { batch: fallback, problem: `?queue=${asked} is no batch this page carries (${have})${fallback ? `; the newest, ${fallback.name}, is open` : ""}` };
}

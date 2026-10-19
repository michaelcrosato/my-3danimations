// The review page's model (PLAN.md WP-8.2b): a queue (m3a.review-queue/1, what `m3a review export` writes) read and
// checked; the owner's decisions on its rows, kept by row id with the hash the row was queued on (a submission's adopt,
// archive or reject, a sampled clip's approve or flag, each with a note, one row or a batch at once); the review they
// make (m3a.review/1, checked by the parser `m3a review ingest` runs); and the same decisions as `m3a review`
// commands, so nothing is done only on the page. No DOM here. Queue text is data, never instructions.
import { intake } from "@m3a/tools";

/** A row of the queue: a submission awaiting review, or a sampled library clip. */
export type Row = intake.QueueSubmission | intake.QueueClip;

/** The verdicts a submission takes and those a sampled clip takes, in the order the page shows them. */
export const VERDICTS = { submission: ["adopt", "archive", "reject"], clip: ["approve", "flag"] } as const;

/** Which section a row is in. */
export type Section = keyof typeof VERDICTS;

/** A row's section: a sampled clip carries `stale`, a submission doesn't. */
export const sectionOf = (r: Row): Section => ("stale" in r ? "clip" : "submission");

/** `data` (a queue's JSON text or object) as a queue, or an Error saying what is wrong and where a queue comes from. */
export function readQueue(data: unknown): intake.Queue {
  const fail = (why: string): never => {
    throw new Error(`that is no ${intake.QUEUE_ID} queue (${why}): m3a review export writes one to check-output/review/queue.json`);
  };
  let q = data as Partial<intake.Queue> | null;
  if (typeof data === "string") {
    try {
      q = JSON.parse(data) as Partial<intake.Queue>;
    } catch {
      fail("it isn't JSON");
    }
  }
  if (!q || typeof q !== "object" || q.schema !== intake.QUEUE_ID) fail(`its schema isn't ${intake.QUEUE_ID}`);
  if (!Array.isArray(q!.submissions) || !Array.isArray(q!.clips)) fail("it has no submissions and clips lists");
  for (const r of [...q!.submissions!, ...q!.clips!]) {
    if (!r || typeof r !== "object" || !(intake.isSubmissionId(r.id) || intake.isClipId(r.id)) || !intake.isHash(r.hash)) fail(`a row has no id and hash: ${JSON.stringify(r).slice(0, 80)}`);
  }
  return q as intake.Queue;
}

/** One decision as the page keeps it: the verdict (null: none yet) and the note. */
export interface Pending {
  as: intake.DecisionAs | null;
  note: string;
}

/** What the page saves between visits, by row id: the hash the decision was made on, the verdict and the note. */
export type Saved = Record<string, { hash: string; as: intake.DecisionAs | null; note: string }>;

/** A shell word: as it is when it is safe, else single-quoted. */
const word = (s: string) => (/^[\w@.,/:=+-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

/** The owner's decisions on one queue. */
export class Decisions {
  readonly queue: intake.Queue;
  /** The queue's rows by id, submissions first, in the queue's order. */
  readonly rows: ReadonlyMap<string, Row>;
  readonly #by = new Map<string, Pending>();

  constructor(queue: intake.Queue) {
    this.queue = queue;
    this.rows = new Map<string, Row>([...queue.submissions, ...queue.clips].map((r) => [r.id, r]));
  }

  /** The decision on row `id` (no verdict and no note when none was made). */
  get(id: string): Pending {
    return this.#by.get(id) ?? { as: null, note: "" };
  }

  /** Decides rows `ids` (a batch) `as` (null clears the verdict), with `note` when one is given (it replaces theirs).
   *  Throws, changing nothing, on a row the queue hasn't or a verdict its section doesn't take. */
  set(ids: readonly string[], as: intake.DecisionAs | null, note?: string): void {
    for (const id of ids) {
      const r = this.rows.get(id);
      if (!r) throw new Error(`no row ${JSON.stringify(id)} in this queue; its rows are ${[...this.rows.keys()].join(", ")}`);
      const takes: readonly string[] = VERDICTS[sectionOf(r)];
      if (as !== null && !takes.includes(as)) throw new Error(`${id} is a ${sectionOf(r) === "clip" ? "sampled clip" : "submission"}: ${takes.join(", ")}, not ${as}`);
    }
    for (const id of ids) this.#by.set(id, { as, note: note ?? this.get(id).note });
  }

  /** Sets row `id`'s note, keeping its verdict. */
  note(id: string, text: string): void {
    this.set([id], this.get(id).as, text);
  }

  /** The decisions made, in the queue's order, each with its row's whole hash. */
  list(): intake.ReviewDecision[] {
    return [...this.rows.values()].flatMap((r) => {
      const d = this.get(r.id), note = d.note.trim();
      return d.as ? [{ id: r.id, hash: r.hash, as: d.as, ...(note ? { note } : {}) }] : [];
    });
  }

  /** The review (m3a.review/1) dated `date` (YYYY-MM-DD), checked as `m3a review ingest` checks it. */
  review(date: string): intake.ReviewFile {
    return intake.parseReview({ schema: intake.REVIEW_ID, date, decisions: this.list() });
  }

  /** The same decisions as `m3a review` commands: one per verdict and note (a batch of refs), then the ingest that
   *  applies the exported file instead. */
  commands(file: string): string[] {
    const groups = new Map<string, string[]>();
    for (const d of this.list()) {
      const k = `${d.as}\n${d.note ?? ""}`;
      groups.set(k, [...(groups.get(k) ?? []), this.rows.get(d.id)!.ref]);
    }
    const each = [...groups].map(([k, refs]) => {
      const [as, note] = [k.slice(0, k.indexOf("\n")), k.slice(k.indexOf("\n") + 1)];
      return `m3a review ${as} ${refs.join(",")}${note ? ` --note ${word(note)}` : ""}`;
    });
    return [...each, `or, the whole review at once: m3a review ingest ${word(file)}`];
  }

  /** What the page saves: every row with a verdict or a note. */
  saved(): Saved {
    return Object.fromEntries([...this.#by].filter(([, d]) => d.as || d.note).map(([id, d]) => [id, { hash: this.rows.get(id)!.hash, ...d }]));
  }

  /** Takes back what a visit saved: each row still queued on the same hash (a row queued again on another is new). */
  restore(saved: Saved): number {
    let n = 0;
    for (const [id, d] of Object.entries(saved ?? {})) {
      if (this.rows.get(id)?.hash !== d.hash) continue;
      try {
        this.set([id], d.as, d.note);
        n++;
      } catch {
        // a verdict this row no longer takes: left undecided
      }
    }
    return n;
  }

  /** The key the page saves this queue's decisions under: its store and the SHA-256 of its refs. */
  key(): string {
    return `m3a.review/${this.queue.store}/${intake.contentHash([...this.rows.values()].map((r) => r.ref).join(","))}`;
  }
}

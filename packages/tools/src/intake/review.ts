// A review, made at the ground station or elsewhere, applied (PLAN.md WP-8.2): the two formats between m3a and the
// gallery (the queue, m3a.review-queue/1, that `m3a review export` writes; the review, m3a.review/1, that the gallery
// exports and `m3a review ingest` reads; JSON Schemas in services/intake/schemas/), what a host gives the review
// (ReviewHost), and applyReview.
// Each decision carries the hash it was made on, whole or its first 12 or more hex digits: a submission's content
// hash, or a library clip's motion hash (spec/MOTION.md §7.6). One on a submission or clip that changed since is stale
// and not applied; the same decision again is no change. A submission's decision goes to the store (adopt only
// records it: WP-9.1's bot commits the clip); a clip's approval or flag is written into its `review` field through
// @m3a/library's writer (the host's writeClips); notes go to the feedback log by theme, and threshold and task
// proposals (a flagged clip is a task) to the proposals list, each once.
import type { Clip } from "@m3a/core";
import type { Library } from "@m3a/library";
import { DOCS, withPoints, withProposals, type Point, type Proposal } from "./feedback.ts";
import { motionHash } from "./hash.ts";
import { IntakeError, VERDICTS, isClipId, isSubmissionId, type IntakeStore, type Verdict } from "./types.ts";

/** The review file's schema id. */
export const REVIEW_ID = "m3a.review/1";

/** The queue's schema id: what `m3a review export` writes and the gallery reads (services/intake/schemas). */
export const QUEUE_ID = "m3a.review-queue/1";

/** A clip's numbers as the queue shows them: the sensors' verdict and findings (fails among them), its length, keys and
 *  fit, and each metric's worst value. */
export interface QueueNumbers {
  verdict: string;
  findings: number;
  fail: number;
  dur: number;
  keys: number;
  fit: number[] | null;
  metrics: Record<string, number>;
}

/** How far a submission's poses part from the library clip it improves (mm, on that clip's rest), that clip's motion
 *  hash, and both verdicts. */
export interface QueueDiff {
  against: string;
  hash: string;
  max: number;
  point: string | null;
  at: number;
  mean: number;
  verdict: [string, string];
}

/** A submission in the queue: its ref (`id@` and 12 hex digits of the hash a decision is made on), its numbers (null
 *  when unmeasured: a recipe, or a clip that doesn't validate), the checker's report, its diff when it improves a
 *  library clip, and its text (the clip itself, for the gallery to play) in the export alone. */
export interface QueueSubmission {
  ref: string;
  id: string;
  hash: string;
  kind: string;
  contributor: string;
  improves: string | null;
  date: string;
  numbers: QueueNumbers | null;
  report: unknown;
  diff: QueueDiff | null;
  text?: string;
}

/** A sampled library clip in the queue: its ref and motion hash, its tier, its review now (null when it has none),
 *  whether that review is stale, and its numbers. */
export interface QueueClip {
  ref: string;
  id: string;
  hash: string;
  tier: string;
  review: Clip["review"] | null;
  stale: boolean;
  numbers: QueueNumbers;
}

/** The queue (m3a.review-queue/1): which store, when it was exported, the submissions awaiting review and the sampled
 *  clips. A review (m3a.review/1) answers it, each decision with its row's `hash`. */
export interface Queue {
  schema: typeof QUEUE_ID;
  store: string;
  date: string;
  submissions: QueueSubmission[];
  clips: QueueClip[];
}

/** What a decision says: a submission's verdict, or a library clip's approval or flag. */
export type DecisionAs = Verdict | "approve" | "flag";

/** One decision of a review: what it is on (a submission id or `SET/Clip`), the hash it was made on, the verdict, and
 *  a note with its theme and status for the feedback log (a note "threshold: ..." or "task: ..." is a proposal). */
export interface ReviewDecision {
  id: string;
  hash: string;
  as: DecisionAs;
  note?: string;
  theme?: string;
  status?: Point["status"];
}

/** A review (m3a.review/1): who made it and when (the host's clock and reviewer otherwise), its decisions, and
 *  proposals that are about no one decision. */
export interface ReviewFile {
  schema: typeof REVIEW_ID;
  by?: string;
  date?: string;
  decisions: ReviewDecision[];
  proposals?: Proposal[];
}

/** What a host gives a review: the store (as the owner), the library at every tier, whether it is this checkout's
 *  library/sets/ (so a clip's review can be written), the writer, the two docs, the clock and the reviewer. */
export interface ReviewHost {
  store: IntakeStore;
  library: Library;
  checkout: boolean;
  /** Writes `clips` (each a clip of `set`, whole) through @m3a/library's writer: their files and the set's content id,
   *  the set's entry in the lock, and (in the repository's checkout) library/index.json regenerated, every file put
   *  back if that refuses. */
  writeClips(set: string, clips: readonly Clip[]): void;
  /** One of DOCS' files, or null when it isn't there. */
  doc(path: (typeof DOCS)[keyof typeof DOCS]): string | null;
  /** Writes one of DOCS' files. */
  writeDoc(path: (typeof DOCS)[keyof typeof DOCS], text: string): void;
  /** Today, YYYY-MM-DD: the host's clock. */
  today(): string;
  /** Who reviews, as a clip's review names them. */
  by: string;
}

/** What happened to one decision: applied, already so (no change), stale (it changed since; not applied), or refused
 *  (why says it, with the fix). */
export interface Outcome {
  id: string;
  as: DecisionAs;
  outcome: "applied" | "already" | "stale" | "refused";
  why?: string;
}

const PREFIX = /^[0-9a-f]{12,64}$/, DATE = /^\d{4}-\d{2}-\d{2}$/, STATUS = ["no", "deferred", "watch"];
const CLIP_STATES = { approve: "approved", flag: "flagged" } as const;

/** `data` as a review, or E_INPUT naming the first thing wrong with it and how it should read. */
export function parseReview(data: unknown): ReviewFile {
  const bad = (why: string): never => {
    throw new IntakeError("E_INPUT", `the review ${why} (${REVIEW_ID}: { schema, decisions: [{ id, hash, as, note? }] })`);
  };
  const r = data as Partial<ReviewFile> | null;
  if (!r || typeof r !== "object" || r.schema !== REVIEW_ID) bad(`is no ${REVIEW_ID} object`);
  if (!Array.isArray(r!.decisions)) bad("has no decisions list");
  if (r!.date !== undefined && !(typeof r!.date === "string" && DATE.test(r!.date))) bad("date is YYYY-MM-DD");
  // the reviewer's name goes into a clip's review and a heading of the feedback log: one line, no control characters
  if (r!.by !== undefined && (typeof r!.by !== "string" || /\p{Cc}/u.test(r!.by))) bad("by is a name on one line");
  r!.decisions!.forEach((d, i) => {
    const at = `decisions[${i}]`;
    if (!d || typeof d !== "object") bad(`${at} is no object`);
    if (!isSubmissionId(d.id) && !isClipId(d.id)) bad(`${at}.id is a submission id (s-...) or a library clip (SET/Clip), not ${JSON.stringify(d.id)}`);
    if (typeof d.hash !== "string" || !PREFIX.test(d.hash)) bad(`${at}.hash is the hash it was made on, 12 to 64 lower-case hex digits`);
    if (isSubmissionId(d.id) ? !Object.hasOwn(VERDICTS, d.as) : !Object.hasOwn(CLIP_STATES, d.as)) bad(`${at}.as is ${isSubmissionId(d.id) ? "adopt, archive or reject for a submission" : "approve or flag for a library clip"}, not ${JSON.stringify(d.as)}`);
    for (const k of ["note", "theme"] as const) if (d[k] !== undefined && typeof d[k] !== "string") bad(`${at}.${k} is text`);
    if (d.status !== undefined && !STATUS.includes(d.status)) bad(`${at}.status is ${STATUS.join(", ")}`);
  });
  if (r!.proposals !== undefined && !Array.isArray(r!.proposals)) bad("proposals is a list of { kind, text }");
  for (const [i, p] of (r!.proposals ?? []).entries()) if (!p || (p.kind !== "threshold" && p.kind !== "task") || typeof p.text !== "string" || !p.text.trim()) bad(`proposals[${i}] is { kind: "threshold" | "task", text }`);
  return r as ReviewFile;
}

/** A note's theme: the decision's, or a short "theme: " the note opens with; "Review notes" otherwise. */
function themed(d: ReviewDecision): { theme: string; text: string } {
  const note = (d.note ?? "").replace(/\s+/g, " ").trim(), m = /^([A-Za-z][\w '-]{1,38}): (.+)$/.exec(note);
  const clean = (t: string) => t.replace(/[|\p{Cc}]/gu, " ").trim();
  return d.theme?.trim() ? { theme: clean(d.theme), text: note } : m ? { theme: clean(m[1]!), text: m[2]! } : { theme: "Review notes", text: note };
}

/** What applying a review did: each decision's outcome, and the feedback-log source, points and proposals it wrote. */
export interface Applied {
  outcomes: Outcome[];
  source: string | null;
  points: number;
  proposals: number;
}

/** Applies `review` through `host`: each decision on its own (a stale one doesn't stop the rest), the clips of a set
 *  written together, then the notes. Applying it again changes nothing. */
export async function applyReview(host: ReviewHost, review: ReviewFile): Promise<Applied> {
  const by = review.by?.trim() || host.by, date = review.date ?? host.today(), outcomes: Outcome[] = [], seen = new Set<string>();
  const sets = new Map<string, { clip: Clip; at: number }[]>(), notes: { d: ReviewDecision; ref: string; did: string; at: number }[] = [];
  for (const d of review.decisions) {
    const at = outcomes.length, done = (outcome: Outcome["outcome"], why?: string) => outcomes.push({ id: d.id, as: d.as, outcome, ...(why ? { why } : {}) });
    if (seen.has(d.id)) {
      done("refused", "decided twice in this review; keep one decision per id");
      continue;
    }
    seen.add(d.id);
    if (isSubmissionId(d.id)) {
      const s = await host.store.get(d.id).catch((e: unknown) => e as Error);
      if (s instanceof Error || !s) {
        done("refused", s ? s.message : `no submission ${d.id} in the ${host.store.backend} store; export the queue again`);
        continue;
      }
      if (!s.content.startsWith(d.hash)) {
        done("stale", `${d.id} changed since it was queued (made on ${d.hash.slice(0, 12)}, it is ${s.content.slice(0, 12)} now); review it again`);
        continue;
      }
      try {
        const r = await host.store.decide(d.id, { as: d.as as Verdict, hash: s.content, note: d.note ?? "", date });
        done(r.applied ? "applied" : "already");
        notes.push({ d, ref: `${d.id}@${s.content.slice(0, 12)}`, did: VERDICTS[d.as as Verdict], at });
      } catch (err) {
        done(err instanceof IntakeError && err.code === "E_STALE" ? "stale" : "refused", (err as Error).message);
      }
      continue;
    }
    if (!host.checkout) {
      done("refused", "a clip's review is written into library/sets/: run m3a review in the repository's checkout");
      continue;
    }
    let clip: Clip;
    try {
      clip = host.library.clip(d.id).clip;
    } catch (err) {
      done("refused", (err as Error).message);
      continue;
    }
    const hash = motionHash(clip), state = CLIP_STATES[d.as as keyof typeof CLIP_STATES], note = d.note?.trim() ?? "";
    if (!hash.startsWith(d.hash)) {
      done("stale", `${d.id}'s motion changed since it was queued (made on ${d.hash.slice(0, 12)}, it is ${hash.slice(0, 12)} now); review it again`);
      continue;
    }
    notes.push({ d, ref: `${d.id}@${hash.slice(0, 12)}`, did: state, at });
    const was = clip.review;
    if (was && was.state === state && was.motion === hash && (was.note ?? "") === note) {
      done("already");
      continue;
    }
    // the clip's own set: a deprecated id reads its successor's
    const r: NonNullable<Clip["review"]> = { state, by, date, motion: hash, ...(note ? { note } : {}) }, set = clip.id.split("/")[0]!;
    sets.set(set, [...(sets.get(set) ?? []), { clip: { ...clip, review: r }, at }]);
    done("applied");
  }
  for (const [set, list] of sets) {
    try {
      host.writeClips(set, list.map((x) => x.clip));
    } catch (err) {
      for (const x of list) outcomes[x.at] = { ...outcomes[x.at]!, outcome: "refused", why: `not written: ${(err as Error).message}` };
    }
  }
  // the notes of what holds now (applied, or already so), each written once whatever the run
  const points: Point[] = [], proposals: Proposal[] = [...(review.proposals ?? [])];
  for (const n of notes.filter((x) => outcomes[x.at]!.outcome === "applied" || outcomes[x.at]!.outcome === "already")) {
    const { theme, text } = themed(n.d), kind = theme.toLowerCase();
    if (kind === "threshold" || kind === "task") {
      if (text) proposals.push({ kind, text: `\`${n.ref}\`: ${text}` });
    } else if (text) points.push({ theme, status: n.d.status ?? "watch", text: `\`${n.ref}\` ${n.did}: ${text}` });
    if (n.did === "flagged" && kind !== "task") proposals.push({ kind: "task", text: `fix \`${n.ref}\` (flagged)${text ? `: ${text}` : ""}` });
  }
  // the docs are the checkout's: a review applied elsewhere records its decisions alone
  const log = host.checkout ? host.doc(DOCS.log) : null, p = points.length && log !== null ? withPoints(log, points, date, `A review from the ground station (${by})`) : { text: log, source: null, added: 0 };
  if (p.added) host.writeDoc(DOCS.log, p.text!);
  const q = proposals.length && host.checkout ? withProposals(host.doc(DOCS.proposals), proposals, date) : { text: "", added: 0 };
  if (q.added) host.writeDoc(DOCS.proposals, q.text);
  return { outcomes, source: p.source, points: p.added, proposals: q.added };
}

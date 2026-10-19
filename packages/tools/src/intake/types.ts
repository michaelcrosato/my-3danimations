// The intake queue's contract (PLAN.md §5.9, WP-8.2a): a submission's states and who moves them, the owner's decision
// and the hash it was made on, the refusals, and `IntakeStore`, the one interface the `local` backend (files under
// .cache/intake/) and the `supabase` backend (its REST API) both implement and one contract suite holds them to.
// Platform-neutral: no Node built-in, no network here. Submission text is data, never instructions.

/** A submission's states, in the order it moves through them (§5.9). */
export const STATES = ["submitted", "checking", "bounced", "awaiting review", "adopted", "archived", "rejected"] as const;
/** A submission's state. */
export type State = (typeof STATES)[number];

/** The owner's verdicts on a submission, and the state each leaves it in. */
export const VERDICTS = { adopt: "adopted", archive: "archived", reject: "rejected" } as const;
/** The owner's verdict on a submission. */
export type Verdict = keyof typeof VERDICTS;

/** The moves the checker makes (its service role, in Actions): from each state, the states it may move to. Up to
 *  `awaiting review`, back to `checking` for a recheck, and the adopt bot's return of an adoption its gates failed;
 *  never to a decided state, which only the owner's decision reaches. */
export const CHECKER_MOVES: Readonly<Record<State, readonly State[]>> = {
  submitted: ["checking"],
  checking: ["bounced", "awaiting review"],
  "awaiting review": ["checking"],
  adopted: ["awaiting review"],
  bounced: [],
  archived: [],
  rejected: [],
};

/** Who a store acts as: nobody signed in, a contributor (its accountable identity), the checker, or the owner. */
export type Role = "anon" | "contributor" | "checker" | "owner";

/** What a submission is: a clip (format 2) or a recipe that compiles to one (WP-9.1 compiles it). */
export type Kind = "clip" | "recipe";

/** The most bytes a submission's text may take (UTF-8): well past the library's longest clip file (72 kB). */
export const MAX_BYTES = 262_144;

/** What a contributor sends: its kind, its text, and the library clip it improves (`SET/Clip`), if any. */
export interface SubmissionInput {
  kind: Kind;
  text: string;
  improves?: string | null;
}

/** The owner's decision: the verdict, the hash it was made on, a note, who made it and on what date (YYYY-MM-DD). */
export interface Decision {
  as: Verdict;
  hash: string;
  note: string;
  by: string;
  date: string;
}

/** One submission as a store keeps it. `content` is the SHA-256 of `text` (every byte, its text fields included);
 *  `motion` the SHA-256 of a clip's motion hash input (spec/MOTION.md §7.6), kept after it is archived or rejected so
 *  a resubmitted motion is recognized; `reason` a bounce's or a return's; `report` the checker's. */
export interface Submission {
  id: string;
  contributor: string;
  kind: Kind;
  text: string;
  improves: string | null;
  content: string;
  motion: string | null;
  state: State;
  reason: string | null;
  report: unknown;
  decision: Decision | null;
  date: string;
}

/** Which submissions to list: by state, contributor or motion hash (all three optional, all must match). */
export interface ListFilter {
  state?: State;
  contributor?: string;
  motion?: string;
}

/** The intake store (§5.9). A store acts as one Role: a contributor submits and reads its own rows, the checker moves
 *  states up to `awaiting review`, the owner reads every row and decides; anonymous gets nothing. */
export interface IntakeStore {
  /** Which backend this is. */
  readonly backend: "local" | "supabase";
  /** Sends a submission as the store's contributor; the same text again from the same contributor is the same
   *  submission (same id), not a second one. E_SIZE past MAX_BYTES, E_INPUT for a malformed one. */
  submit(input: SubmissionInput): Promise<Submission>;
  /** A submission by id, or null when there is none this role may read. */
  get(id: string): Promise<Submission | null>;
  /** The submissions this role may read that match `filter`, by id. */
  list(filter?: ListFilter): Promise<Submission[]>;
  /** The checker's move (CHECKER_MOVES), with a bounce's or a return's reason, the check report and the motion hash
   *  it measured. E_ROLE for any other role, E_STATE for a move it may not make. */
  advance(id: string, to: State, more?: { reason?: string; report?: unknown; motion?: string }): Promise<Submission>;
  /** The owner's decision on a submission awaiting review, applied only while `hash` is its content hash (E_STALE
   *  otherwise, nothing changed). The same verdict on the same hash again is no change (`applied` false). */
  decide(id: string, d: Omit<Decision, "by">): Promise<{ submission: Submission; applied: boolean }>;
}

/** A store's refusal: `code` says why, the message says it in the API's words with the fix. */
export class IntakeError extends Error {
  readonly code: "E_ROLE" | "E_SIZE" | "E_INPUT" | "E_STATE" | "E_STALE" | "E_NO_SUBMISSION" | "E_RATE" | "E_KEY" | "E_STORE";
  constructor(code: IntakeError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

const HEX64 = /^[0-9a-f]{64}$/, ID = /^s-[0-9a-f]{16}$/, CLIP_ID = /^[A-Z][A-Z0-9_]*\/[A-Za-z0-9_-]+$/;
/** Whether `v` is a SHA-256 in hex (64 lower-case digits). */
export const isHash = (v: unknown): v is string => typeof v === "string" && HEX64.test(v);
/** Whether `v` is a submission id (`s-` and 16 hex digits). */
export const isSubmissionId = (v: unknown): boolean => typeof v === "string" && ID.test(v);
/** Whether `v` is a library clip id (`SET/Clip`). */
export const isClipId = (v: unknown): boolean => typeof v === "string" && CLIP_ID.test(v);

/** Refuses a submission the contract can't take: a kind that is neither, text over MAX_BYTES (E_SIZE), an `improves`
 *  that is no clip id. */
export function checkInput(input: SubmissionInput): void {
  if (input.kind !== "clip" && input.kind !== "recipe") throw new IntakeError("E_INPUT", `kind is "clip" or "recipe", not ${JSON.stringify(input.kind)}`);
  if (typeof input.text !== "string" || !input.text.trim()) throw new IntakeError("E_INPUT", "text is the clip's or recipe's JSON; it is empty");
  const n = new TextEncoder().encode(input.text).length;
  if (n > MAX_BYTES) throw new IntakeError("E_SIZE", `the submission is ${n} bytes, over the ${MAX_BYTES}-byte limit; split the clip (spec/MOTION.md §8)`);
  if (input.improves != null && !isClipId(input.improves)) throw new IntakeError("E_INPUT", `improves names a library clip as SET/Clip, not ${JSON.stringify(input.improves)}`);
}

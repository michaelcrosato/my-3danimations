// The intake queue's surface (PLAN.md §5.9, WP-8.2a): the contract (states, roles, the IntakeStore interface and its
// refusals), the hashes decisions are made on, the `local` and `supabase` backends, the review file and how a review
// is applied, and the feedback log's and proposals list's text. Platform-neutral; the Node entry's files under
// .cache/intake/ and the checkout's writer are in ../node/intake.ts.
export { CHECKER_MOVES, IntakeError, MAX_BYTES, STATES, VERDICTS, checkInput, isClipId, isHash, isSubmissionId, type Decision, type IntakeStore, type Kind, type ListFilter, type Role, type State, type Submission, type SubmissionInput, type Verdict } from "./types.ts";
export { contentHash, motionHash, motionOfText, submissionId } from "./hash.ts";
export { localStore, memoryFiles, type LocalOptions, type StoreFiles } from "./local.ts";
export { supabaseStore, type SupabaseOptions } from "./supabase.ts";
export { REVIEW_ID, applyReview, parseReview, type Applied, type DecisionAs, type Outcome, type ReviewDecision, type ReviewFile, type ReviewHost } from "./review.ts";
export { DOCS, PROPOSALS_HEAD, withPoints, withProposals, type Point, type Proposal } from "./feedback.ts";

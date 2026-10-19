// The review and contributor pages' actions (PLAN.md WP-8.2b, DOCTRINE.md principle 2): each thing the pages do and
// the `m3a review` call (or the tool, or the command) that does the same without a display. The gallery's action list
// (../actions.ts) takes these in, and its e2e checks that every tool named here is in the registry.
import type { Action } from "../actions.ts";

/** Every action the review queue's page and the contributor page offer, in the order they show them. */
export const REVIEW_ACTIONS: readonly Action[] = [
  { action: "open the review queue (bundled at build time when M3A_REVIEW_QUEUE asks, or a file given)", tool: "review", call: "m3a review export (writes check-output/review/queue.json); m3a review lists the same rows" },
  { action: "see a submission's or sampled clip's preview sheet", tool: "sheet", call: "m3a sheet <the submission's clip file | SET/Name> --frames 8" },
  { action: "read a row's numbers and the checker's report", tool: "review", call: "m3a review (each row's verdict and findings); check-output/review/queue.json has its metrics and report" },
  { action: "see how a submission parts from the clip it improves", tool: "diff", call: "m3a diff <SET/Name it improves> <the submission's clip file>" },
  { action: "adopt, archive or reject a submission, with a note", tool: "review", call: "m3a review adopt|archive|reject <s-...@hash> --note '<why>'" },
  { action: "approve or flag a sampled library clip, with a note", tool: "review", call: "m3a review approve|flag <SET/Name@hash> --note '<why>'" },
  { action: "decide a batch at once", tool: "review", call: "m3a review <verdict> <ref>,<ref>,... --note '<why>'" },
  { action: "export the review (the share sheet on a phone, a download on a desk)", tool: "review", call: "m3a review ingest <the review file> applies it (m3a.review/1)" },
  { action: "get or revoke a contributor key (once O8's project is linked)", tool: null, call: "Supabase Auth (GitHub) and the contributor_keys table, services/intake/migrations; until then agents submit to the local store, .cache/intake/" },
];

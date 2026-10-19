// B8-ten's grader (PLAN.md §9.3's G9: "a fresh agent submits 10 clips through the intake queue, and they reach review
// with every check green"): B8's job ten times over, by one agent in one workspace and one queue. The checker runs on
// the workspace's queue as B8's grader runs it (`gradeQueue`); then every submission waiting for review is checked again
// from its text one at a time, each after those before it (`inTurn`), so the dedup gate holds the agent's clips distinct
// from each other as well as from the library (one checker run reads its batch against the library and the submissions
// decided or deciding, not against each other: ten alike sent between two runs would all reach review); then each is
// graded as B8 grades one (`graded`). It passes when at least ten pass every check, and says how many did and what
// failed for the others. Here too is its known-good: ten emotes compiled from recipes on the CC0 library and sent by
// their m3a calls (known-good-ten/, played by `solveB8Ten`).
import { cpSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { intake } from "@m3a/tools";
import type { Check, Grade } from "../B1/grade.ts";
import { gradeQueue, inTurn, solveWith, type Again } from "./grade.ts";

/** How many submissions must pass every check. */
export const TEN = 10;
/** The known-good's files: ten recipes and their m3a calls (submit.sh). */
export const KNOWN_GOOD_TEN = join(import.meta.dirname, "known-good-ten");

/** B8-ten's reading of the submissions waiting for review: this run's verdicts, then every one waiting checked again
 *  from its text in turn (`inTurn`), that verdict the one graded. */
export const turn: Again = async (waiting, ran, c) => {
  const out = new Map(ran.map((r) => [r.id, r]));
  for (const [id, v] of await inTurn(waiting, c)) out.set(id, v);
  return out;
};

/** One submission's checks as `tally` reads them: its id, its kind and B8's checks of it. */
export interface Tallied {
  s: Pick<intake.Submission, "id" | "kind">;
  checks: readonly Check[];
}

/** The count of submissions passing every check: ok at TEN or more, its detail how many of how many passed and, for
 *  each other, the first check it failed (with its detail) and the names of the rest. */
export function tally(each: readonly Tallied[]): Check {
  const pass = each.filter((g) => g.checks.every((x) => x.ok)), others = each.filter((g) => !pass.includes(g));
  const why = others.map(({ s, checks }) => {
    const [first, ...more] = checks.filter((x) => !x.ok);
    return `${s.id} (${s.kind}) fails ${first!.name}: ${first!.detail.replace(`${s.id} (${s.kind}): `, "").slice(0, 200)}${more.length ? `; and ${more.map((x) => x.name).join(", ")}` : ""}`;
  });
  return { name: `${TEN} of them pass every check`, ok: pass.length >= TEN, detail: `${pass.length} of ${each.length} pass every check${others.length ? `; ${others.length === 1 ? "the other" : `the ${others.length} others`}: ${why.join(" | ")}` : ""}` };
}

/** Grades the workspace's queue (its .cache/intake/): ten of its submissions or more must each pass every check B8
 *  holds one to, read in turn so that they are distinct from each other. */
export async function gradeB8Ten(workspace: string): Promise<Grade> {
  const t0 = performance.now(), q = await gradeQueue(workspace, turn), out: Check[] = [], unread = q.stopped?.name === "the queue can be read";
  out.push({ name: `${TEN} submissions reached the queue`, ok: !unread && q.count >= TEN, detail: unread ? q.stopped!.detail : `${q.count} in .cache/intake/${q.count < TEN ? `: send ${TEN - q.count} more emotes with m3a library submit` : ""}` });
  if (q.stopped && !unread) out.push(q.stopped);
  else if (q.count) out.push(tally(q.each));
  return { pass: out.every((x) => x.ok), checks: out, ms: performance.now() - t0 };
}

/** B8-ten's known-good in a workspace: its ten recipes and calls copied in, then its m3a calls (submit.sh), each
 *  exiting 0, or a refusal naming the one that didn't. */
export function solveB8Ten(workspace: string): void {
  for (const f of readdirSync(KNOWN_GOOD_TEN)) cpSync(join(KNOWN_GOOD_TEN, f), join(workspace, f));
  solveWith(workspace, "submit.sh", "B8-ten");
}

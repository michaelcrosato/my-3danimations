// `m3a review`, the owner's review queue (PLAN.md WP-8.2a): one tool, so the queue costs a model about 90 tokens to
// see. `list` (the default) shows the submissions awaiting review, each with its numbers (the sensors' verdict), the
// checker's report and, when it improves a library clip, how far its poses part from that clip's; and a sample of
// library clips whose review is missing or stale (their motion changed since), picked in a fixed order (by the
// SHA-256 of their ids), so the same library gives the same sample. Each row's ref is `id@<hash>`, the hash the
// decision will be made on. `export` writes the whole queue as JSON (m3a.review-queue/1, the gallery's and the phone's
// input) to check-output/review/queue.json; `ingest` applies a review made elsewhere (m3a.review/1); `adopt`,
// `archive`, `reject` (submissions) and `approve`, `flag` (library clips) decide on refs, comma-separated, a batch at
// once, with one note. Decisions go through intake/review.ts (stale ones refused, a repeat no change).
import { recipe, validate, type Clip, type Rest } from "@m3a/core";
import { metrics } from "@m3a/sensors";
import { applyReview, IntakeError, motionHash, parseReview, QUEUE_ID, REVIEW_ID, type DecisionAs, type Queue, type QueueClip as ClipItem, type QueueNumbers as Numbers, type QueueSubmission as SubmissionItem, type ReviewFile, type ReviewHost, type Submission } from "../intake/index.ts";
import { defineTool, ToolError, type ToolContext, type ToolOutput } from "../registry/registry.ts";
import { poseDiff } from "./check.ts";
import { call, capped, count, cut, fileOrJson, more, output, round } from "./common.ts";

/** How many library clips a queue samples: G8's batch for the owner's phone review (PLAN.md §9.3); a list shows 8. */
export const SAMPLE = 20;
/** Where `m3a review export` writes the queue. */
export const QUEUE_FILE = "check-output/review/queue.json";

const DECIDE = ["adopt", "archive", "reject", "approve", "flag"] as const;

const ref = (id: string, hash: string) => `${id}@${hash.slice(0, 12)}`;

/** A clip's numbers on rest R. */
function numbers(c: Clip, R: Rest): Numbers {
  const r = metrics(c, R), worst = Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, round(v, 2)]));
  return { verdict: r.verdict, findings: r.findings.length, fail: r.findings.filter((f) => f.level === "fail").length, dur: c.dur, keys: c.keys.length, fit: c.quality?.fit ?? null, metrics: worst };
}

/** A submission's queue row: its clip measured on the rest of the clip it improves (else of the set source its restSrc
 *  names), and its diff against that clip; a recipe, or a clip that doesn't validate, unmeasured. */
function item(h: ReviewHost, s: Submission): SubmissionItem {
  const row: SubmissionItem = { ref: ref(s.id, s.content), id: s.id, hash: s.content, kind: s.kind, contributor: s.contributor, improves: s.improves, date: s.date, numbers: null, report: s.report, diff: null, text: s.text };
  try {
    const c = JSON.parse(s.text) as Clip;
    if (s.kind !== "clip" || !validate(c).ok) return row;
    const base = s.improves ? h.library.clip(s.improves) : null;
    const rest = base?.rest ?? h.library.sets().map((x) => h.library.about(x.set).sources[c.restSrc]?.rest).find(Boolean);
    if (!rest) return row;
    row.numbers = numbers(c, rest);
    if (base) {
      const d = poseDiff(base.clip, c, rest);
      row.diff = { against: base.clip.id, hash: motionHash(base.clip), max: round(d.max), point: d.point, at: round(d.at, 3), mean: round(d.mean, 1), verdict: [metrics(base.clip, rest).verdict, row.numbers.verdict] };
    }
  } catch {
    // unmeasured: the checker's report says why (WP-9.1)
  }
  return row;
}

/** The queue: every submission awaiting review, and SAMPLE library clips unreviewed or stale. */
async function queue(h: ReviewHost): Promise<Queue> {
  const subs = (await h.store.list({ state: "awaiting review" })).map((s) => item(h, s)), clips: ClipItem[] = [];
  const ids = h.library.catalog().map((r) => r.id).map((id) => [recipe.sha256(id), id] as const).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [, id] of ids) {
    if (clips.length >= SAMPLE) break;
    const got = h.library.clip(id), hash = motionHash(got.clip), r = got.clip.review ?? null, stale = r !== null && r.state !== "unreviewed" && r.motion !== hash;
    if (r && r.state !== "unreviewed" && !stale) continue;
    clips.push({ ref: ref(id, hash), id, hash, tier: got.tier, review: r, stale, numbers: numbers(got.clip, got.rest) });
  }
  return { schema: QUEUE_ID, store: h.store.backend, date: h.today(), submissions: subs, clips };
}

/** A queue row as a line: its ref, what it is and its numbers. */
const line = (x: SubmissionItem | ClipItem) => {
  const n = x.numbers, said = n ? `${n.verdict.toUpperCase()}, ${count(n.findings, "finding")}` : "unmeasured";
  if ("stale" in x) return `${x.ref} (${x.tier}) ${x.stale ? "stale" : "unreviewed"}: ${said}`;
  return `${x.ref} ${x.kind} by ${cut(x.contributor, 40)}: ${said}${x.diff ? `; improves ${x.diff.against}, ${x.diff.max ? `poses differ up to ${x.diff.max} mm` : "the same poses"}` : x.improves ? `; improves ${x.improves}` : ""}`;
};

/** `review`'s arguments. */
type Args = { do?: "list" | "export" | "ingest" | (typeof DECIDE)[number]; on?: string; note?: string };

/** `review`: the owner's review queue. */
export const review = defineTool<Args, unknown>({
  name: "review",
  description: "The owner's review queue.",
  params: {
    type: "object",
    properties: {
      do: { type: "string", enum: ["list", "export", "ingest", ...DECIDE] },
      on: { type: "string", description: "refs, or a review file" },
      note: { type: "string" },
    },
  },
  output: output({ do: "string", store: "string", submissions: "array", clips: "array", outcomes: "array", path: "string?" }),
  positionals: ["do", "on"],
  writes: true,
  examples: [{ args: {} }],
  async run(x, ctx) {
    try {
      return await act({ ...x, do: x.do ?? "list" }, ctx);
    } catch (err) {
      // the library's and the store's refusals (E_TAMPERED, E_STORE ...) in their own words, not as a bug
      const code = (err as { code?: unknown }).code;
      throw err instanceof ToolError || typeof code !== "string" || !code.startsWith("E_") ? err : new ToolError(code, (err as Error).message);
    }
  },
});

/** What `review` does for each `do`. */
async function act(a: Args & { do: NonNullable<Args["do"]> }, ctx: ToolContext): Promise<ToolOutput> {
  const h = ctx.intake(), none = { submissions: [], clips: [], outcomes: [], path: null };
  if (a.do === "list" || a.do === "export") {
    if (a.on !== undefined || a.note !== undefined) throw new ToolError("E_ARGS", `${a.do} takes no ${a.on !== undefined ? "on" : "note"}`, true);
    const q = await queue(h), what = `${count(q.submissions.length, "submission")} awaiting review, ${count(q.clips.length, "sampled clip")} (${q.store} store)`;
    if (a.do === "export") {
      const path = ctx.write(QUEUE_FILE, `${JSON.stringify(q, null, 1)}\n`);
      return { verdict: `review export: ${what}, written to ${path}`, data: { do: a.do, store: q.store, ...none, path }, next: `open it in the gallery's review page; apply what comes back with ${call("review", ["ingest", "<the review file>"])}` };
    }
    const s = capped(q.submissions.map(({ text: _, ...x }) => x), 10), c = capped(q.clips, 8), first = q.submissions[0]?.ref ?? q.clips[0]?.ref;
    return {
      verdict: `review: ${what}`,
      data: { do: a.do, store: q.store, submissions: s.rows, clips: c.rows, outcomes: [], path: null },
      lines: [...s.rows.map(line), ...more(s.more, "submission"), ...c.rows.map(line), ...more(c.more, "clip")],
      next: first ? `decide on refs as listed: ${call("review", [q.submissions.length ? "adopt" : "approve", first], { note: "<why>" })} (${q.submissions.length ? "or archive, reject; approve or flag a clip" : "or flag"})` : "the queue is empty: nothing awaits review",
    };
  }
  let r: ReviewFile;
  if (a.do === "ingest") {
    if (a.on === undefined || a.note !== undefined) throw new ToolError("E_ARGS", a.on === undefined ? "ingest names the review file (on), or gives its JSON" : "a review's notes are in its file", true);
    const got = await fileOrJson(ctx, a.on, "the review");
    try {
      r = parseReview(got.data);
    } catch (err) {
      throw err instanceof IntakeError ? new ToolError("E_REVIEW", err.message, got.path === null) : err;
    }
  } else r = { schema: REVIEW_ID, decisions: refs(a.on).map(([id, hash]) => ({ id, hash, as: a.do as DecisionAs, ...(a.note === undefined ? {} : { note: a.note }) })) };
  try {
    if (a.do !== "ingest") parseReview(r);
  } catch (err) {
    throw err instanceof IntakeError ? new ToolError("E_ARGS", err.message.replace(/^the review /, `${a.do} on refs: `), true) : err;
  }
  const release = await ctx.lock(".m3a/locks/review.lock");
  let done;
  try {
    done = await applyReview(h, r);
  } finally {
    release();
  }
  const n = (o: string) => done.outcomes.filter((x) => x.outcome === o).length, bad = done.outcomes.filter((x) => x.outcome === "stale" || x.outcome === "refused");
  const said = ["applied", "already", "stale", "refused"].map((o) => `${n(o)} ${o}`).join(", "), shown = capped(done.outcomes, 12);
  const wrote = [done.points && `${count(done.points, "note")} in docs/FEEDBACK-LOG.md (${done.source})`, done.proposals && `${count(done.proposals, "proposal")} in docs/REVIEW-PROPOSALS.md`].filter(Boolean);
  return {
    verdict: `review ${a.do}: ${count(done.outcomes.length, "decision")}, ${said}${wrote.length ? `; ${wrote.join(", ")}` : ""}`,
    data: { do: a.do, store: h.store.backend, submissions: [], clips: [], outcomes: shown.rows, path: null },
    lines: [...shown.rows.map((o) => `${o.outcome}: ${o.as} ${o.id}${o.why ? `: ${o.why}` : ""}`), ...more(shown.more, "decision")],
    findings: bad.length > 0,
    next: bad.length ? `nothing stale or refused was applied: ${call("review")} lists the queue with its hashes now` : `${call("review")} lists what is left; WP-9.1's adopt bot commits what is adopted`,
  };
}

/** `on`'s refs, "id@hash" comma-separated, as [id, hash] pairs; E_ARGS for a ref with no hash. */
function refs(on: string | undefined): [string, string][] {
  const list = (on ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!list.length) throw new ToolError("E_ARGS", "name what is decided (on): refs as m3a review lists them, id@hash, comma-separated", true);
  return list.map((x) => {
    const m = /^(.+)@([0-9a-f]{12,64})$/.exec(x);
    if (!m) throw new ToolError("E_ARGS", `${JSON.stringify(cut(x, 60))} has no hash: give each ref as m3a review lists it, id@hash, the hash the decision is made on`, true, { next: `${call("review")} lists the refs` });
    return [m[1]!, m[2]!];
  });
}

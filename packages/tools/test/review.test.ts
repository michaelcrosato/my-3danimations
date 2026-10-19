// `m3a review` (WP-8.2a): its example on the four surfaces, then a review in a scratch checkout from start to end.
// The queue lists a submission awaiting review with its numbers and its diff against the clip it improves, and the
// sampled clips; the export is the gallery's input; a review made from it (the gallery's m3a.review/1) changes the
// right states and files (the store, the clip's review field through the writer, its set's content id and lock, the
// feedback log by theme, the proposals list) and leaves catalog.tsv alone; applying it twice changes no byte; a
// decision on a clip or submission that changed since it was queued is refused as stale with nothing written; and
// each wrong call is refused naming the fix.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { join } from "node:path";
import { serialize, type Clip } from "@m3a/core";
import { TIERS } from "@m3a/library";
import { openLibrary } from "@m3a/library/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { motionHash, REVIEW_ID, type Queue, type ReviewFile } from "../src/intake/index.ts";
import { nodeReviewHost } from "../src/node/intake.ts";
import { Registry, type Reply } from "../src/registry/index.ts";
import { REVIEW } from "../src/tools/index.ts";
import { QUEUE_FILE } from "../src/tools/review.ts";
import { runExamples } from "./helpers/surfaces.ts";
import { checkout, libraryClip, ROOT, SET, TODAY, type Checkout } from "./review-helpers.ts";

/** The two formats' JSON Schemas (services/intake/schemas), compiled. */
const schema = (name: string) => new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(join(ROOT, "services/intake/schemas", name), "utf8")) as object);

describe("review on every surface", () => runExamples(REVIEW));

describe("a review in a scratch checkout", () => {
  let co: Checkout, sub: string, other: string;
  const reg = new Registry(REVIEW), call = (args: object, host = co.host) => reg.call("review", args, { host });
  const files = () => Object.fromEntries([...["library/sets.lock.json", "docs/FEEDBACK-LOG.md"], ...readdirSync(join(co.cwd, "library/sets", SET)).map((f) => `library/sets/${SET}/${f}`), ...readdirSync(join(co.cwd, ".cache/intake")).filter((f) => f.endsWith(".json")).map((f) => `.cache/intake/${f}`)].map((f) => [f, co.file(f)]));
  /** Walk_Loop with its head turned `deg` more at every key: an improvement's motion. */
  const walk = (deg: number): Clip => ((c) => ({ ...c, keys: c.keys.map((k) => ({ ...k, head: (k as unknown as { head: number[] }).head.map((v, i) => (i === 0 ? v + deg : v)) })) }) as Clip)(libraryClip(`${SET}/Walk_Loop`));

  beforeAll(async () => {
    co = checkout();
    const alice = co.store("contributor", "alice"), checker = co.store("checker");
    for (const [i, c] of [walk(2), { ...walk(0), desc: "walks, kept as it is" }].entries()) {
      const s = await alice.submit({ kind: "clip", text: serialize(c), improves: `${SET}/Walk_Loop` });
      await checker.advance(s.id, "checking");
      await checker.advance(s.id, "awaiting review", { report: { gates: "pass", n: i } });
      if (i === 0) sub = s.id;
      else other = s.id;
    }
  }, 60_000);
  afterAll(() => co.rm());

  it("lists each submission awaiting review with its numbers and its diff against the clip it improves, and the sampled clips", async () => {
    const r = await call({});
    expect([r.status, r.verdict]).toEqual(["ok", "review: 2 submissions awaiting review, 8 sampled clips (local store)"]);
    const d = r.data as { submissions: Queue["submissions"]; clips: Queue["clips"] }, s = d.submissions.find((x) => x.id === sub)!;
    expect(s).toMatchObject({ kind: "clip", contributor: "alice", improves: `${SET}/Walk_Loop`, report: { gates: "pass" }, numbers: { verdict: expect.any(String), keys: 20 }, diff: { against: `${SET}/Walk_Loop`, hash: motionHash(libraryClip(`${SET}/Walk_Loop`)) } });
    expect(s.diff!.max).toBeGreaterThan(0);
    expect(d.submissions.find((x) => x.id === other)!.diff!.max).toBe(0); // the same motion, its description changed
    expect(d.clips.map((c) => c.id.split("/")[0])).toEqual(Array(8).fill(SET));
    expect(d.clips.every((c) => c.ref === `${c.id}@${c.hash.slice(0, 12)}` && c.review === null && !c.stale)).toBe(true);
    expect(r.next).toMatch(/^decide on refs as listed: `review adopt s-[0-9a-f]{16}@[0-9a-f]{12} --note <why>`/);
  });

  it("exports the queue as the gallery's input, with each submission's text", async () => {
    const r = await call({ do: "export" }), q = JSON.parse(co.file(QUEUE_FILE)) as Queue;
    expect([r.status, (r.data as { path: string }).path]).toEqual(["ok", QUEUE_FILE]);
    expect([q.schema, q.store, q.date, q.submissions.length, q.clips.length]).toEqual(["m3a.review-queue/1", "local", TODAY, 2, 8]);
    expect(JSON.parse(q.submissions.find((x) => x.id === sub)!.text!)).toEqual(walk(2));
    const valid = schema("queue.schema.json");
    expect(valid(q), JSON.stringify(valid.errors)).toBe(true);
  });

  it("applies a review: the right states and files change; applying it twice changes no byte", async () => {
    const q = JSON.parse(co.file(QUEUE_FILE)) as Queue, [c1, c2] = q.clips, catalog = co.file(`library/sets/${SET}/catalog.tsv`), lock0 = co.file("library/sets.lock.json");
    const review: ReviewFile = {
      schema: REVIEW_ID,
      decisions: [
        { id: sub, hash: q.submissions.find((x) => x.id === sub)!.hash, as: "adopt", note: "foot contact: the head turn reads better" },
        { id: other, hash: q.submissions.find((x) => x.id === other)!.hash, as: "reject", note: "no change to the motion", theme: "WP sizes" },
        { id: c1!.id, hash: c1!.hash, as: "approve", note: "clean" },
        { id: c2!.id, hash: c2!.hash, as: "flag", note: "threshold: its jitter passes but reads" },
      ],
    };
    writeFileSync(join(co.cwd, "review.json"), JSON.stringify(review));
    const valid = schema("review.schema.json");
    expect([valid(review), valid({ ...review, decisions: [{ ...review.decisions[0]!, as: "approve" }] })], JSON.stringify(valid.errors)).toEqual([true, false]); // the schema reads as parseReview does
    const r = await call({ do: "ingest", on: "review.json" });
    expect([r.status, r.verdict]).toEqual(["ok", "review ingest: 4 decisions, 4 applied, 0 already, 0 stale, 0 refused; 3 notes in docs/FEEDBACK-LOG.md (F6), 2 proposals in docs/REVIEW-PROPOSALS.md"]);
    const owner = co.store("owner");
    expect([(await owner.get(sub))!.state, (await owner.get(sub))!.decision, (await owner.get(other))!.state]).toEqual(["adopted", { as: "adopt", hash: q.submissions.find((x) => x.id === sub)!.hash, note: "foot contact: the head turn reads better", by: "owner", date: TODAY }, "rejected"]);
    const clip = (id: string) => JSON.parse(co.file(`library/sets/${id}.json`)) as Clip;
    expect([clip(c1!.id).review, clip(c2!.id).review]).toEqual([{ state: "approved", by: "owner", date: TODAY, motion: c1!.hash, note: "clean" }, { state: "flagged", by: "owner", date: TODAY, motion: c2!.hash, note: "threshold: its jitter passes but reads" }]);
    expect(co.file(`library/sets/${c1!.id}.json`)).toBe(serialize(clip(c1!.id))); // the canonical serializer's bytes
    expect([co.file(`library/sets/${SET}/catalog.tsv`) === catalog, co.file("library/sets.lock.json") === lock0]).toEqual([true, false]);
    expect(() => openLibrary({ dir: join(co.cwd, "library/sets"), tiers: TIERS, packs: {}, warn: () => {} }).verify()).not.toThrow(); // content id and lock agree
    const log = co.file("docs/FEEDBACK-LOG.md").replace(/\n {2}/g, " ");
    expect(log).toMatch(/\n### F6 · 2026-10-19 · A review from the ground station \(owner\)\n\n- \*\*F6\.1\*\* \(foot contact, watch\) `s-[0-9a-f]{16}@[0-9a-f]{12}` adopted: the head turn reads better\n/);
    expect(log).toMatch(/\n\| WP sizes \| \*\*reached\*\* \(F1, F4\) \| F1, F4, F6 \|/);
    expect(log).toMatch(/\n\| Foot contact \| watch \| F6 \| When it reaches three sources/);
    expect(log).toContain(`(review notes, watch) \`${c1!.ref}\` approved: clean`);
    const proposals = co.file("docs/REVIEW-PROPOSALS.md").replace(/\n {2}/g, " ");
    expect(proposals).toContain(`- 2026-10-19 · threshold · \`${c2!.ref}\`: its jitter passes but reads`);
    expect(proposals).toContain(`- 2026-10-19 · task · fix \`${c2!.ref}\` (flagged): its jitter passes but reads`);
    const before = files(), again = await call({ do: "ingest", on: "review.json" });
    expect(again.verdict).toBe("review ingest: 4 decisions, 0 applied, 4 already, 0 stale, 0 refused");
    expect([files(), co.file("docs/REVIEW-PROPOSALS.md").replace(/\n {2}/g, " ")]).toEqual([before, proposals]);
  });

  it("decides a batch of refs from the command line, and refuses as stale a clip or submission that changed since it was queued", async () => {
    const q = JSON.parse(co.file(QUEUE_FILE)) as Queue, [, , c3, c4] = q.clips, host = nodeReviewHost(co.cwd, { today: () => TODAY });
    const moved = { ...libraryClip(c3!.id), keys: walk(5).keys.slice(0, 2).map((k, i) => ({ ...k, t: i * 0.1 })), dur: 0.2 } as Clip;
    host.writeClips(SET, [moved]); // c3 changes after it was queued, through the writer
    const was = co.file(`library/sets/${c3!.id}.json`), r = await call({ do: "approve", on: `${c3!.ref},${c4!.ref}`, note: "batch" });
    expect([r.status, r.verdict]).toEqual(["findings", "review approve: 2 decisions, 1 applied, 0 already, 1 stale, 0 refused; 1 note in docs/FEEDBACK-LOG.md (F7)"]);
    expect(r.lines[0]).toMatch(new RegExp(`^stale: approve ${c3!.id}: ${c3!.id}'s motion changed since it was queued \\(made on ${c3!.hash.slice(0, 12)}, it is [0-9a-f]{12} now\\)`));
    expect([co.file(`library/sets/${c3!.id}.json`), (JSON.parse(co.file(`library/sets/${c4!.id}.json`)) as Clip).review?.state]).toEqual([was, "approved"]);
    // a submission whose stored text changed since it was checked: its content hash no longer holds
    const fresh = await co.store("contributor", "alice").submit({ kind: "clip", text: serialize(walk(3)) }), checker = co.store("checker");
    await checker.advance(fresh.id, "checking");
    await checker.advance(fresh.id, "awaiting review");
    const rec = join(co.cwd, ".cache/intake", `${fresh.id}.json`);
    writeFileSync(rec, readFileSync(rec, "utf8").replace("Walk_Loop", "Walk_Loop2"));
    const s = await call({ do: "adopt", on: `${fresh.id}@${fresh.content.slice(0, 12)}` });
    expect([s.status, (s.data as { outcomes: { outcome: string; why: string }[] }).outcomes[0]]).toEqual(["findings", { id: fresh.id, as: "adopt", outcome: "stale", why: expect.stringMatching(/changed since the decision was made/) }]);
    expect((await co.store("owner").get(fresh.id))!.state).toBe("awaiting review");
    expect((await call({ do: "reject", on: `${sub}@${"0".repeat(12)}` })).lines[0]).toMatch(/^stale: reject s-/);
  });

  it("refuses wrong calls naming the fix", async () => {
    const said = (r: Reply) => [r.status, r.error?.code, r.error?.message];
    expect(said(await call({ do: "approve", on: `${SET}/Walk_Loop` }))).toEqual(["usage", "E_ARGS", `"${SET}/Walk_Loop" has no hash: give each ref as m3a review lists it, id@hash, the hash the decision is made on`]);
    expect(said(await call({ do: "approve", on: `${sub}@${"a".repeat(12)}` }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^approve on refs: decisions\[0\]\.as is adopt, archive or reject for a submission, not "approve"/)]);
    expect(said(await call({ do: "list", note: "x" }))).toEqual(["usage", "E_ARGS", "list takes no note"]);
    expect(said(await call({ do: "ingest" }))).toEqual(["usage", "E_ARGS", "ingest names the review file (on), or gives its JSON"]);
    expect(said(await call({ do: "ingest", on: '{"schema":"m3a.review/0"}' }))).toEqual(["usage", "E_REVIEW", expect.stringMatching(/^the review is no m3a.review\/1 object/)]);
    writeFileSync(join(co.cwd, "bad.json"), JSON.stringify({ schema: REVIEW_ID, decisions: [{ id: "walk", hash: "0".repeat(12), as: "approve" }] }));
    expect(said(await call({ do: "ingest", on: "bad.json" }))).toEqual(["error", "E_REVIEW", expect.stringMatching(/decisions\[0\]\.id is a submission id/)]);
    expect(said(await reg.call("review", {}, { host: {} }))).toEqual(["usage", "E_HOST", expect.stringMatching(/^this surface keeps no intake store/)]);
    const bare = checkout(true);
    try {
      const r = await call({ do: "flag", on: `${SET}/Walk_Loop@${motionHash(libraryClip(`${SET}/Walk_Loop`)).slice(0, 12)}` }, bare.host);
      expect([r.status, r.lines[0]]).toEqual(["findings", `refused: flag ${SET}/Walk_Loop: a clip's review is written into library/sets/: run m3a review in the repository's checkout`]);
    } finally {
      bare.rm();
    }
  });
});

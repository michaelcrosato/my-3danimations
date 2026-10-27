// Unit tests for the review batches a build carries and the gallery links the cards give (WP-F.11): which committed
// batches can go into a page (G8's can; G9's, holding submissions, can't, nor a row that is no library clip, nor any
// key or value a sampled clip's row hasn't, nested ones included) and the page getting the values read, not the file;
// which a build carries when none are named (the newest in each gate's directory, holding no submission); the newest
// and the one a link names; and a clip's link as the gallery's route writes and reads it. T1 runs it (vitest.config.ts).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "@m3a/core";
import { intake } from "@m3a/tools";
import { describe, expect, it } from "vitest";
import { clipLink, formatRoute, parseRoute } from "../route.ts";
import { batchName, byNewest, checkBatch, committed, GATES_DIR, newest, pick, QUEUE_SCHEMA, REVIEW_STATES, SENSOR_VERDICTS, TIERS, unshippable, type Batch } from "./batches.ts";

const ROOT = join(import.meta.dirname, "../../../.."), hasClip = (id: string) => existsSync(join(ROOT, "library/sets", `${id}.json`));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
/** Every committed batch, by path. */
const COMMITTED = readdirSync(join(ROOT, GATES_DIR), { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => readdirSync(join(ROOT, GATES_DIR, d.name)).filter((f) => /^queue.*\.json$/.test(f)).map((f) => `${GATES_DIR}/${d.name}/${f}`)).sort();
const G8 = `${GATES_DIR}/G8-run-1/queue-0.56.0.json`, G9 = `${GATES_DIR}/G9-run-2/queue.json`, NEXT = `${GATES_DIR}/reviews/queue-0.64.0.json`;
const batch = (name: string, date: string): Batch => ({ name, path: `${GATES_DIR}/${name}.json`, date, clips: 1, text: "" });

describe("review batches", () => {
  it("reads the queue's schema id, the tiers and the review states as the packages write them", () => {
    expect([QUEUE_SCHEMA, TIERS, REVIEW_STATES]).toEqual([intake.QUEUE_ID, [...format.TIERS], [...format.REVIEW_STATES]]);
    // the sensors' verdicts (metrics' Report: a type alone), as every committed batch's rows have them
    const verdicts = COMMITTED.flatMap((p) => (JSON.parse(read(p)) as { clips: { numbers: { verdict: string } }[] }).clips.map((c) => c.numbers.verdict));
    expect(verdicts.length > 0 && verdicts.every((v) => SENSOR_VERDICTS.includes(v))).toBe(true);
  });

  it("names a batch by its path under the gates' records", () => {
    expect([batchName(G8), batchName(`./${G9}`), batchName("check-output/review/queue.json")]).toEqual(["G8-run-1/queue-0.56.0", "G9-run-2/queue", "check-output/review/queue"]);
  });

  it("takes G8's committed batches and refuses those holding submissions, naming the count", () => {
    expect(COMMITTED.length).toBeGreaterThanOrEqual(4);
    const verdicts = Object.fromEntries(COMMITTED.map((p) => [batchName(p), unshippable(read(p), hasClip)]));
    expect(verdicts["G8-run-1/queue-0.56.0"]).toBeNull();
    expect(verdicts["G8-run-1/queue"]).toBeNull();
    expect(verdicts["G9-run-1/queue"]).toMatch(/^it holds 10 submissions/);
    expect(verdicts["G9-run-2/queue"]).toMatch(/^it holds 10 submissions/);
    // the page gets the queue rebuilt from the values read: the same queue, not the file's text
    const b = checkBatch(G8, read(G8), hasClip);
    expect([b.name, b.path, b.date, b.clips, JSON.parse(b.text)]).toEqual(["G8-run-1/queue-0.56.0", G8, "2026-10-22", 20, JSON.parse(read(G8))]);
    expect(() => checkBatch(G9, read(G9), hasClip)).toThrow(/^review batch G9-run-2\/queue \(bench\/results\/gates\/G9-run-2\/queue\.json\) can't go into a page: it holds 10 submissions/);
  });

  it("refuses a batch that is no queue, or carries anything but library clips' rows, their values read", () => {
    type Q = { clips: (Record<string, unknown> & { numbers: Record<string, unknown> })[] } & Record<string, unknown>;
    const q = JSON.parse(read(G8)) as Q, row = q.clips[0]!, id = (i: number) => String(q.clips[i]!.id);
    const edit = (f: (x: Q) => void) => {
      const x = structuredClone(q);
      f(x);
      return unshippable(JSON.stringify(x), hasClip);
    };
    const review = { state: "approved", by: "owner", date: "2026-10-22", motion: String(row.hash), note: "clean" };
    expect([unshippable("{", hasClip), unshippable("null", hasClip), unshippable(null, hasClip)]).toEqual(["it isn't JSON", `it isn't a ${QUEUE_SCHEMA} queue`, `it isn't a ${QUEUE_SCHEMA} queue`]);
    expect(edit((x) => (x.schema = "m3a.review/1"))).toBe(`it isn't a ${QUEUE_SCHEMA} queue`);
    expect(edit((x) => delete (x as Record<string, unknown>).clips)).toBe("it has no submissions and clips lists");
    expect(edit((x) => (x.submissions = [{ id: "s-0123456789abcdef", text: "{}" }]))).toMatch(/^it holds 1 submission \(/);
    expect(edit((x) => (x.notes = "x"))).toBe("it has keys a batch of clips hasn't: notes");
    expect(edit((x) => (x.store = "STORE_LEAK"))).toBe("its store isn't local or supabase");
    expect(edit((x) => delete x.date)).toBe("it has no date (YYYY-MM-DD)");
    // a row: no key and no value but a sampled library clip's, each of its type and form, nested ones included
    const cases: [(x: Q) => unknown, string][] = [
      [(x) => (x.clips[1]!.text = "a contributor's text"), `row ${id(1)}: it has keys a sampled clip's row hasn't: text`],
      [(x) => (x.clips[1]!.numbers.text = "NESTED_LEAK"), `row ${id(1)}: its numbers have keys a sampled clip's row hasn't: text`],
      [(x) => (x.clips[1]!.ref = "REF_LEAK"), `row ${id(1)}: its ref isn't its id@ and its hash's first 12 digits`],
      [(x) => (x.clips[1]!.hash = "HASH_LEAK"), `row ${id(1)}: its hash isn't 64 hex digits`],
      [(x) => (x.clips[1]!.tier = "TIER_LEAK"), `row ${id(1)}: its tier isn't one of cc0, cc-by, cmu, local`],
      [(x) => (x.clips[1]!.stale = "no"), `row ${id(1)}: its stale isn't true or false`],
      [(x) => (x.clips[1]!.review = "REVIEW_LEAK"), `row ${id(1)}: its review isn't null or a review`],
      [(x) => (x.clips[1]!.review = { ...review, text: "REVIEW_LEAK" }), `row ${id(1)}: its review has keys a sampled clip's row hasn't: text`],
      [(x) => (x.clips[1]!.review = { ...review, state: "REVIEW_LEAK" }), `row ${id(1)}: its review's state isn't one of approved, flagged, unreviewed`],
      [(x) => (x.clips[1]!.review = { ...review, by: "a contributor's text, at length" }), `row ${id(1)}: its review's by, date or motion isn't of its form`],
      [(x) => (x.clips[1]!.review = { ...review, note: 7 }), `row ${id(1)}: its review's note isn't text`],
      [(x) => delete (x.clips[1] as Record<string, unknown>).numbers, `row ${id(1)}: it has no numbers`],
      [(x) => (x.clips[1]!.numbers.verdict = "VERDICT_LEAK"), `row ${id(1)}: its numbers' verdict isn't one of pass, warn, fail`],
      [(x) => (x.clips[1]!.numbers.dur = "1 s"), `row ${id(1)}: its numbers' findings, fail, dur or keys isn't a number`],
      [(x) => (x.clips[1]!.numbers.fit = ["FIT_LEAK"]), `row ${id(1)}: its numbers' fit isn't null or numbers`],
      [(x) => ((x.clips[1]!.numbers.metrics as Record<string, unknown>).slide = "METRIC_LEAK"), `row ${id(1)}: its numbers' metrics aren't names with numbers`],
      [(x) => ((x.clips[1]!.numbers.metrics as Record<string, unknown>)["a contributor's text"] = 1), `row ${id(1)}: its numbers' metrics aren't names with numbers`],
    ];
    for (const [f, why] of cases) expect(edit(f)).toBe(why);
    expect(edit((x) => (x.clips[2]!.id = "s-0123456789abcdef"))).toMatch(/^a row isn't a library clip's: /);
    expect(edit((x) => (x.clips[2]!.id = "../../etc/passwd"))).toMatch(/^a row isn't a library clip's: /);
    expect(edit((x) => (x.clips[2] = null as never))).toBe("a row isn't a library clip's: null");
    expect(edit((x) => (x.clips[3]!.id = "QUATERNIUS_3D2DGE/No_Such_Clip"))).toBe("row QUATERNIUS_3D2DGE/No_Such_Clip: its ref isn't its id@ and its hash's first 12 digits");
    expect(edit((x) => Object.assign(x.clips[3]!, { id: "QUATERNIUS_3D2DGE/No_Such_Clip", ref: `QUATERNIUS_3D2DGE/No_Such_Clip@${String(x.clips[3]!.hash).slice(0, 12)}` }))).toBe("row QUATERNIUS_3D2DGE/No_Such_Clip is no clip in the library");
    // a review and a fit of null pass, rebuilt as read
    const ok = structuredClone(q);
    Object.assign(ok.clips[1]!, { review, stale: true });
    ok.clips[1]!.numbers.fit = null;
    expect([unshippable(JSON.stringify(ok), hasClip), JSON.parse(checkBatch("x/queue.json", JSON.stringify(ok), hasClip).text)]).toEqual([null, ok]);
    expect(Object.keys(row).sort()).toEqual(["hash", "id", "numbers", "ref", "review", "stale", "tier"]);
  });

  it("carries, when none are named, the newest batch in each gate's directory that holds no submission", () => {
    const found = COMMITTED.map((path) => ({ path, text: read(path) }));
    expect(committed(found, hasClip)).toEqual({
      carried: [G8, NEXT], // the owner's next batch (the next goal's item 5) in reviews/, where each export supersedes the last
      left: [`${GATES_DIR}/G8-run-1/queue.json (superseded by G8-run-1/queue-0.56.0)`, `${GATES_DIR}/G9-run-1/queue.json (10 submissions)`, `${GATES_DIR}/G9-run-2/queue.json (10 submissions)`],
    });
    // a newer export holding a submission supersedes an older one holding none; a file that is no queue is left out
    const g = (name: string, text: string) => ({ path: `${GATES_DIR}/GX-run-1/${name}`, text });
    const q = JSON.parse(read(G8)) as Record<string, unknown>, newer = JSON.stringify({ ...q, date: "2026-10-23", submissions: [{ id: "s-0123456789abcdef" }] });
    expect(committed([g("queue.json", read(G8)), g("queue-b.json", newer), g("queue-null.json", "null"), g("queue-bad.json", "{")], hasClip)).toEqual({
      carried: [],
      left: [`${GATES_DIR}/GX-run-1/queue-b.json (1 submission)`, `${GATES_DIR}/GX-run-1/queue-bad.json (not JSON)`, `${GATES_DIR}/GX-run-1/queue-null.json (not a queue: no submissions and clips lists)`, `${GATES_DIR}/GX-run-1/queue.json (superseded by GX-run-1/queue-b)`],
    });
    const stray = JSON.stringify({ ...q, date: "2026-10-23", clips: [{ id: "NO_SET/No_Clip" }] });
    expect(committed([g("queue.json", stray)], hasClip)).toEqual({ carried: [], left: [`${GATES_DIR}/GX-run-1/queue.json (1 row not library clips)`] });
  });

  it("opens the newest, or the one a link names, saying so when it names none here", () => {
    const [a, b, c] = [batch("G8-run-1/queue", "2026-10-19"), batch("G8-run-1/queue-0.56.0", "2026-10-22"), batch("G9-run-1/queue", "2026-10-22")];
    expect(byNewest([a, b, c]).map((x) => x.name)).toEqual(["G9-run-1/queue", "G8-run-1/queue-0.56.0", "G8-run-1/queue"]);
    expect([newest([a, b])?.name, newest([])]).toEqual(["G8-run-1/queue-0.56.0", null]);
    expect(pick([a, b], "")).toEqual({ batch: b, problem: null });
    expect(pick([a, b], "?queue=G8-run-1/queue")).toEqual({ batch: a, problem: null });
    expect(pick([a, b], "?renderer=webgl2&queue=G8-run-1%2Fqueue.json")).toEqual({ batch: a, problem: null });
    expect(pick([a, b], "?queue=G9-run-2/queue")).toEqual({ batch: b, problem: "?queue=G9-run-2/queue is no batch this page carries (it carries G8-run-1/queue, G8-run-1/queue-0.56.0); the newest, G8-run-1/queue-0.56.0, is open" });
    expect(pick([], "?queue=x")).toEqual({ batch: null, problem: "?queue=x is no batch this page carries (it carries none)" });
    expect(pick([], "")).toEqual({ batch: null, problem: null });
  });
});

describe("a card's gallery link", () => {
  it("is the route's link for the clip, and opens it", () => {
    const id = "STYLE100_SIDERUN/Stiff_SideRunLeft", link = clipLink(id), { route, problems } = parseRoute(link);
    expect(link).toBe("?clip=STYLE100_SIDERUN%2FStiff_SideRunLeft");
    expect([route.clip, route.set, route.char, route.view, route.t, route.rate, route.panel, problems]).toEqual([id, "STYLE100_SIDERUN", "gen-1", "three-quarter", null, 1, "clip", []]);
    expect(formatRoute(route)).toBe(link);
    expect(clipLink(id, "webgl2")).toBe("?clip=STYLE100_SIDERUN%2FStiff_SideRunLeft&renderer=webgl2");
  });
});

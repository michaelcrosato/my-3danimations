// The submit function (services/intake/functions/submit, WP-8.2a) with its store injected, no network: a contributor
// key checked by its hash (missing, unknown and revoked refused), the size and rate limits, the insert and its id and
// content hash (hash.ts's), a repeat answered with the row already there, and a failing store answered 500 naming no
// secret. Then the `supabase` IntakeStore's client against that handler and a fake PostgREST: what it sends, and the
// SQL's "E_CODE: message" refusals and HTTP statuses read back as IntakeErrors.
import { describe, expect, it } from "vitest";
import { handle, MAX_BYTES as FN_MAX_BYTES, PER_DAY, restStore, sha256, type SubmissionRow, type SubmitDeps, type SubmitStore } from "../../../services/intake/functions/submit/handler.ts";
import { contentHash, IntakeError, MAX_BYTES, submissionId, supabaseStore } from "../src/intake/index.ts";

const UID = "6f1c2a7e-3b9d-4c2e-9a51-0d4e8b7f1a23", KEY = "m3a_test_key_alice", OLD = "m3a_test_key_alice_revoked";
const NOW = new Date("2026-10-19T12:00:00Z");

/** A store in memory: one live key and one revoked (their hashes), the rows, and how many a contributor sent today. */
async function memory(sentToday = 0) {
  const keys = new Map([[await sha256(KEY), UID], [await sha256(OLD), UID]]), revoked = new Set([await sha256(OLD)]), rows = new Map<string, SubmissionRow>(), seen: string[] = [];
  const store: SubmitStore = {
    contributor: async (h) => (revoked.has(h) ? null : (keys.get(h) ?? null)),
    count: async (uid, since) => (seen.push(since), uid === UID ? sentToday : 0),
    async insert(row) {
      const was = rows.get(row.id);
      if (was) return { row: was, created: false };
      rows.set(row.id, row);
      return { row, created: true };
    },
  };
  return { store, rows, seen, keys };
}
const post = (body: unknown, key: string | null = KEY) => new Request("https://x.supabase.co/functions/v1/submit", { method: "POST", headers: { "content-type": "application/json", ...(key ? { "x-m3a-key": key } : {}) }, body: typeof body === "string" ? body : JSON.stringify(body) });
const answer = async (res: Response) => [res.status, (await res.json()) as Record<string, unknown>] as const;
const TEXT = '{"format":"2.0","id":"INTAKE/Walk","keys":[]}';

describe("the submit function", () => {
  it("inserts a submission from a contributor key, with the id and content hash the tools make, once", async () => {
    const m = await memory(), deps: SubmitDeps = { store: m.store, now: () => NOW };
    const [status, body] = await answer(await handle(post({ kind: "clip", text: TEXT, improves: "QUATERNIUS_3D2DGE/Walk_Loop" }), deps));
    const id = submissionId(UID, contentHash(TEXT));
    expect([status, body.submission]).toEqual([201, { id, contributor: UID, kind: "clip", body: TEXT, improves: "QUATERNIUS_3D2DGE/Walk_Loop", content: contentHash(TEXT), motion: null, state: "submitted", submitted_on: "2026-10-19" }]);
    expect(m.seen).toEqual(["2026-10-18T12:00:00.000Z"]); // the rate counts the last 24 hours
    const [again] = await answer(await handle(post({ kind: "clip", text: TEXT, improves: "QUATERNIUS_3D2DGE/Walk_Loop" }), deps));
    expect([again, m.rows.size]).toEqual([200, 1]);
    expect(FN_MAX_BYTES).toBe(MAX_BYTES);
  });

  it("refuses a missing, unknown or revoked key, a body over the limit, a contributor past its rate, and a malformed body", async () => {
    const m = await memory(), deps: SubmitDeps = { store: m.store, now: () => NOW }, ok = { kind: "clip", text: TEXT };
    const cases: [Request, SubmitDeps, number, RegExp][] = [
      [post(ok, null), deps, 401, /^E_KEY: send the contributor key/],
      [post(ok, "not a key"), deps, 401, /^E_KEY: no such contributor key, or it was revoked/],
      [post(ok, OLD), deps, 401, /^E_KEY: no such contributor key, or it was revoked/],
      [post({ kind: "clip", text: "x".repeat(MAX_BYTES + 1) }), deps, 413, /^E_SIZE: the submission is 262145 bytes/],
      [post(ok), { store: (await memory(20)).store, now: () => NOW }, 429, /^E_RATE: 20 submissions in the last 24 hours/],
      [post("{"), deps, 400, /^E_INPUT: the body is JSON/],
      [post({ kind: "glb", text: TEXT }), deps, 400, /^E_INPUT: kind is/],
      [post({ ...ok, improves: "walk" }), deps, 400, /^E_INPUT: improves names a library clip/],
      [post({ ...ok, motion: "abc" }), deps, 400, /^E_INPUT: motion is the clip's motion hash/],
      [new Request("https://x.supabase.co/functions/v1/submit"), deps, 405, /^E_INPUT: POST a submission/],
    ];
    for (const [req, d, status, error] of cases) {
      const [s, body] = await answer(await handle(req, d));
      expect([s, body.error], String(error)).toEqual([status, expect.stringMatching(error)]);
    }
    expect(m.rows.size).toBe(0);
    const broken: SubmitStore = { ...m.store, insert: () => Promise.reject(new Error("connection reset")) };
    expect(await answer(await handle(post(ok), { store: broken, now: () => NOW }))).toEqual([500, { error: "E_STORE: the store failed (connection reset); send it again later" }]);
  });

  it("runs on the deployed store against PostgREST: the key looked up live, the day counted, the database's rate kept", async () => {
    // a fake PostgREST over one table each, answering only the filters restStore sends (a revoked key is filtered out)
    const keys = [{ hash: await sha256(KEY), uid: UID, revoked_at: null }, { hash: await sha256(OLD), uid: UID, revoked_at: "2026-10-18T00:00:00Z" }];
    const rows: (SubmissionRow & { created_at: string })[] = [], asked: string[] = [];
    let trigger = false; // the rate trigger: raise E_RATE as the database would for a request that raced past the count
    const f = (async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(String(input)), q = url.searchParams, ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      asked.push(`${init.method ?? "GET"} ${url.pathname}?${q}`);
      expect(init.headers).toMatchObject({ apikey: "service-key", authorization: "Bearer service-key" });
      if (url.pathname === "/rest/v1/contributor_keys") return ok(keys.filter((k) => `eq.${k.hash}` === q.get("hash") && (q.get("revoked_at") !== "is.null" || k.revoked_at === null)).map(({ uid }) => ({ uid })));
      if (url.pathname === "/rest/v1/submissions" && init.method === "POST") {
        if (trigger) return ok({ code: "P0001", message: "E_RATE: 20 submissions in the last 24 hours, the most a contributor sends; send again tomorrow" }, 400);
        const row = JSON.parse(String(init.body)) as SubmissionRow;
        if (rows.some((r) => r.id === row.id)) return ok([], 201);
        rows.push({ ...row, created_at: NOW.toISOString() });
        return ok([row], 201);
      }
      if (url.pathname === "/rest/v1/submissions") return ok(rows.filter((r) => (!q.get("contributor") || q.get("contributor") === `eq.${r.contributor}`) && (!q.get("created_at") || r.created_at >= q.get("created_at")!.slice(4)) && (!q.get("id") || q.get("id") === `eq.${r.id}`)));
      return ok({ message: "no such path" }, 404);
    }) as typeof fetch;
    const deps: SubmitDeps = { store: restStore("https://x.supabase.co/", "service-key", f), now: () => NOW }, ok = { kind: "clip", text: TEXT };
    expect((await answer(await handle(post(ok), deps)))[0]).toBe(201);
    expect((await answer(await handle(post(ok), deps)))[0]).toBe(200); // the same text: the row already there
    expect(await answer(await handle(post(ok, OLD), deps))).toEqual([401, { error: expect.stringMatching(/^E_KEY: no such contributor key, or it was revoked/) }]);
    expect(asked).toContain(`GET /rest/v1/submissions?contributor=eq.${UID}&created_at=gte.2026-10-18T12%3A00%3A00.000Z&select=id&limit=${PER_DAY + 1}`);
    trigger = true;
    expect(await answer(await handle(post({ kind: "clip", text: `${TEXT} ` }), deps))).toEqual([429, { error: "E_RATE: 20 submissions in the last 24 hours, the most a contributor sends; send again tomorrow" }]);
    expect(rows).toHaveLength(1);
  });
});

describe("the supabase IntakeStore's client", () => {
  /** A fake project: the submit function served by the handler, PostgREST answering `rest` per path. */
  const project = async (rest: (url: URL, init: RequestInit) => Response) => {
    const m = await memory(), sent: { url: string; init: RequestInit }[] = [];
    const f = (async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(String(input));
      sent.push({ url: String(input), init });
      return url.pathname === "/functions/v1/submit" ? handle(new Request(url, init), { store: m.store, now: () => NOW }) : rest(url, init);
    }) as typeof fetch;
    return { sent, as: (o: { token?: string; key?: string }) => supabaseStore({ url: "https://x.supabase.co/", apikey: "anon-key", fetch: f, ...o }) };
  };
  const pg = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("submits through the function with the key, and reads rows with the caller's token, their latest decision kept", async () => {
    const row = { id: "s-0123456789abcdef", contributor: UID, kind: "clip", body: TEXT, improves: null, content: contentHash(TEXT), motion: null, state: "adopted", reason: null, report: null, submitted_on: "2026-10-19", decisions: [{ verdict: "archive", hash: contentHash(TEXT), note: "first", decided_by: "o", decided_on: "2026-10-18", decided_at: "2026-10-18T09:00:00Z" }, { verdict: "adopt", hash: contentHash(TEXT), note: "then", decided_by: "o", decided_on: "2026-10-19", decided_at: "2026-10-19T09:00:00Z" }] };
    const p = await project(() => pg(200, [row]));
    const made = await p.as({ token: "alice-jwt", key: KEY }).submit({ kind: "clip", text: TEXT });
    expect(made).toMatchObject({ id: submissionId(UID, contentHash(TEXT)), state: "submitted", reason: null, decision: null });
    expect(p.sent[0]!.init.headers).toMatchObject({ "x-m3a-key": KEY, apikey: "anon-key" });
    expect(await p.as({ token: "owner-jwt" }).get(row.id)).toMatchObject({ state: "adopted", decision: { as: "adopt", note: "then", date: "2026-10-19" } });
    expect(p.sent[1]!.url).toBe(`https://x.supabase.co/rest/v1/submissions?select=${encodeURIComponent("*,decisions(verdict,hash,note,decided_by,decided_on,decided_at)")}&id=eq.s-0123456789abcdef&order=id`);
    expect(p.sent[1]!.init.headers).toMatchObject({ authorization: "Bearer owner-jwt" });
    expect(await p.as({ token: "x" }).list({ state: "awaiting review" })).toHaveLength(1);
    expect(p.sent[2]!.url).toContain("&state=eq.awaiting%20review&order=id");
    // an agent holds its key alone (§5.9): it submits with no token (the function is deployed with --no-verify-jwt:
    // services/intake/functions/submit/index.ts), its key the check
    expect(await p.as({ key: KEY }).submit({ kind: "clip", text: `${TEXT}\n` })).toMatchObject({ state: "submitted" });
    expect(Object.keys(p.sent.at(-1)!.init.headers as object).map((h) => h.toLowerCase())).not.toContain("authorization");
  });

  it("reads the SQL's coded refusals and the API's statuses back as IntakeErrors", async () => {
    const answers: Record<string, Response> = {
      "/rest/v1/rpc/decide": pg(400, { code: "P0001", message: "E_STALE: s-0123456789abcdef changed since the decision was made" }),
      "/rest/v1/submissions": pg(401, { code: "42501", message: "permission denied for table submissions" }),
    };
    const p = await project((url) => answers[url.pathname]!.clone());
    const code = (q: Promise<unknown>) => q.then(() => "resolved", (e: IntakeError) => `${e.code}: ${e.message}`);
    expect(await code(p.as({ token: "owner" }).decide("s-0123456789abcdef", { as: "adopt", hash: "0".repeat(64), note: "", date: "2026-10-19" }))).toBe("E_STALE: s-0123456789abcdef changed since the decision was made");
    expect(await code(p.as({}).list())).toMatch(/^E_ROLE: the hosted store refused this role \(permission denied/);
    expect(await code(p.as({ token: "alice" }).submit({ kind: "clip", text: TEXT }))).toMatch(/^E_KEY: submitting takes a contributor key/);
    expect(await code(p.as({ key: "revoked" }).submit({ kind: "clip", text: TEXT }))).toMatch(/^E_KEY: no such contributor key/);
  });
});

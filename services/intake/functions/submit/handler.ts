// The submit function's handler (PLAN.md §5.9, WP-8.2a), a Supabase Edge Function in plain fetch-API TypeScript
// (Deno runs it; Node's tests call it): POST a submission `{ kind, text, improves?, motion? }` with a contributor key
// in `x-m3a-key`. It looks the key up by its SHA-256 (keys are stored hashed; a revoked one is refused), refuses a
// body over the size limit (413; read as a stream and counted, never buffered past it) and a new submission past the
// contributor's rate (429, a day's count; the database's rate trigger holds it against requests that race past the
// count), then inserts the submission as `submitted` with its content hash and id (packages/tools/src/intake/hash.ts
// makes the same) and answers 201, or 200 with the one already there for the same text, at the rate's limit too (a
// retry is no new submission). `motion` is the client's motion hash, which the checker recomputes.
// The store is injected: the deployed function's talks to PostgREST with the service role key (restStore); tests
// give one in memory. Errors answer `{ error: "E_CODE: message" }`, as the IntakeStore reads them.

/** The most bytes a submission's text may take, as MAX_BYTES in packages/tools/src/intake/types.ts. */
export const MAX_BYTES = 262_144;
/** The most submissions a contributor sends in a day (24 hours). */
export const PER_DAY = 20;

/** A submissions row as the function writes it. */
export interface SubmissionRow {
  id: string;
  contributor: string;
  kind: "clip" | "recipe";
  body: string;
  improves: string | null;
  content: string;
  motion: string | null;
  state: "submitted";
  submitted_on: string;
}

/** What the function reads and writes: a key's contributor by the key's hash (null when none or revoked), how many
 *  submissions a contributor sent since a time, the row with an id (null when none), and an insert that keeps the row
 *  already there for the same id. */
export interface SubmitStore {
  contributor(keyHash: string): Promise<string | null>;
  count(uid: string, sinceIso: string): Promise<number>;
  get(id: string): Promise<SubmissionRow | null>;
  insert(row: SubmissionRow): Promise<{ row: SubmissionRow; created: boolean }>;
}

/** The handler's dependencies: the store, the clock, and the limits (MAX_BYTES and PER_DAY by default). */
export interface SubmitDeps {
  store: SubmitStore;
  now(): Date;
  limits?: { bytes: number; perDay: number };
}

/** The SHA-256 of a text's UTF-8 bytes, in hex (WebCrypto, in Deno and Node alike). */
export async function sha256(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const refuse = (status: number, code: string, message: string) => json(status, { error: `${code}: ${message}` });
const HEX64 = /^[0-9a-f]{64}$/, CLIP_ID = /^[A-Z][A-Z0-9_]*\/[A-Za-z0-9_-]+$/;

/** The request's body as text, read as a stream and counted, so a body that declares no length (or a false one) is
 *  never buffered whole: null once it passes `cap` bytes, the rest left unread. */
async function cappedBody(req: Request, cap: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader(), utf8 = new TextDecoder();
  let n = 0, text = "";
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    n += r.value.byteLength;
    if (n > cap) {
      await reader.cancel();
      return null;
    }
    text += utf8.decode(r.value, { stream: true });
  }
  return text + utf8.decode();
}

/** Answers one request; a store that fails answers 500 (E_STORE), naming no secret. */
export async function handle(req: Request, deps: SubmitDeps): Promise<Response> {
  try {
    return await answer(req, deps);
  } catch (err) {
    return refuse(500, "E_STORE", `the store failed (${String((err as Error).message).slice(0, 200)}); send it again later`);
  }
}

async function answer(req: Request, deps: SubmitDeps): Promise<Response> {
  const { bytes, perDay } = deps.limits ?? { bytes: MAX_BYTES, perDay: PER_DAY };
  if (req.method !== "POST") return refuse(405, "E_INPUT", "POST a submission as JSON: { kind, text, improves?, motion? }");
  const key = req.headers.get("x-m3a-key");
  if (!key) return refuse(401, "E_KEY", "send the contributor key in x-m3a-key; sign in once on the gallery's contributor page to get one");
  const cap = bytes * 2 + 4096, declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > cap) return refuse(413, "E_SIZE", `the request is ${declared} bytes; a submission's text takes at most ${bytes}`);
  const raw = await cappedBody(req, cap);
  if (raw === null) return refuse(413, "E_SIZE", `the request is over ${cap} bytes; a submission's text takes at most ${bytes}`);
  let body: { kind?: unknown; text?: unknown; improves?: unknown; motion?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return refuse(400, "E_INPUT", "the body is JSON: { kind, text, improves?, motion? }");
  }
  const { kind, text, improves = null, motion = null } = body ?? {};
  if (kind !== "clip" && kind !== "recipe") return refuse(400, "E_INPUT", `kind is "clip" or "recipe"`);
  if (typeof text !== "string" || !text.trim()) return refuse(400, "E_INPUT", "text is the clip's or recipe's JSON");
  const n = new TextEncoder().encode(text).length;
  if (n > bytes) return refuse(413, "E_SIZE", `the submission is ${n} bytes, over the ${bytes}-byte limit; split the clip (spec/MOTION.md §8)`);
  if (improves !== null && !(typeof improves === "string" && CLIP_ID.test(improves))) return refuse(400, "E_INPUT", "improves names a library clip as SET/Clip");
  if (motion !== null && !(typeof motion === "string" && HEX64.test(motion))) return refuse(400, "E_INPUT", "motion is the clip's motion hash, 64 lower-case hex digits");
  const uid = await deps.store.contributor(await sha256(key));
  if (!uid) return refuse(401, "E_KEY", "no such contributor key, or it was revoked; get a new one on the gallery's contributor page");
  const content = await sha256(text), id = `s-${(await sha256(`${uid}\n${content}`)).slice(0, 16)}`;
  const now = deps.now(), sent = await deps.store.count(uid, new Date(now.getTime() - 86_400_000).toISOString());
  if (sent >= perDay) {
    // the same text again is no new submission: its row, as an insert below would answer
    const was = await deps.store.get(id);
    return was ? json(200, { submission: was }) : refuse(429, "E_RATE", `${sent} submissions in the last 24 hours, the most a contributor sends; send again tomorrow`);
  }
  const row: SubmissionRow = { id, contributor: uid, kind, body: text, improves: improves as string | null, content, motion: motion as string | null, state: "submitted", submitted_on: now.toISOString().slice(0, 10) };
  let done;
  try {
    done = await deps.store.insert(row);
  } catch (err) {
    // the database holds the rate too (its rate trigger, under a lock): a request racing past the count lands here
    const rate = /E_RATE: ([^"\\]*)/.exec(String((err as Error).message));
    if (rate) return refuse(429, "E_RATE", rate[1]!);
    throw err;
  }
  return json(done.created ? 201 : 200, { submission: done.row });
}

/** The deployed function's store: PostgREST at `url` with the service role key (which bypasses row-level security,
 *  so the function itself is the check). */
export function restStore(url: string, serviceKey: string, f: typeof fetch = fetch): SubmitStore {
  const base = `${url.replace(/\/+$/, "")}/rest/v1`, headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };
  const get = async <T>(path: string): Promise<T> => {
    const res = await f(`${base}${path}`, { headers });
    if (!res.ok) throw new Error(`E_STORE: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  };
  const one = async (id: string) => (await get<SubmissionRow[]>(`/submissions?id=eq.${id}`))[0] ?? null;
  return {
    async contributor(hash) {
      const rows = await get<{ uid: string }[]>(`/contributor_keys?hash=eq.${hash}&revoked_at=is.null&select=uid`);
      return rows[0]?.uid ?? null;
    },
    async count(uid, since) {
      return (await get<unknown[]>(`/submissions?contributor=eq.${uid}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=${PER_DAY + 1}`)).length;
    },
    get: one,
    async insert(row) {
      const res = await f(`${base}/submissions?on_conflict=id`, { method: "POST", headers: { ...headers, prefer: "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify(row) });
      if (!res.ok) throw new Error(`E_STORE: ${res.status} ${await res.text()}`);
      const made = (await res.json()) as SubmissionRow[];
      return made.length ? { row: made[0]!, created: true } : { row: (await one(row.id))!, created: false };
    },
  };
}

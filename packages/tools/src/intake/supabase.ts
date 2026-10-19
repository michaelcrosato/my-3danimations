// The `supabase` IntakeStore backend (PLAN.md §5.9, O8): the hosted store through Supabase's REST API with plain fetch
// (no client dependency). A submission goes to the submit function (services/intake/functions/submit) with the
// contributor's key; reads go to PostgREST's `submissions` table with the caller's token, which row-level security
// filters (services/intake/migrations); the checker's moves are PATCHes with the service role key, which the table's
// guard trigger holds to CHECKER_MOVES; the owner's decision is the `decide` function, which checks the owner's fixed
// auth.uid() and the hash. Refusals come back as IntakeErrors: the SQL raises them as "E_CODE: message".
import { motionOfText } from "./hash.ts";
import { IntakeError, VERDICTS, checkInput, type Decision, type IntakeStore, type ListFilter, type State, type Submission } from "./types.ts";

/** How the hosted store is reached: the project's URL and anon (publishable) key; the caller's token (a signed-in
 *  user's access token, or the service role key for the checker; none for anonymous); a contributor key to submit
 *  with; and the fetch to use. */
export interface SupabaseOptions {
  url: string;
  apikey: string;
  token?: string;
  key?: string;
  fetch?: typeof fetch;
}

/** A row of `submissions` with its decisions embedded, as PostgREST returns it. */
interface Row {
  id: string;
  contributor: string;
  kind: Submission["kind"];
  body: string;
  improves: string | null;
  content: string;
  motion: string | null;
  state: State;
  reason: string | null;
  report: unknown;
  submitted_on: string;
  decisions?: { verdict: Decision["as"]; hash: string; note: string; decided_by: string; decided_on: string; decided_at: string }[];
}

const SELECT = "*,decisions(verdict,hash,note,decided_by,decided_on,decided_at)";

/** A row as a Submission: its latest decision, by when it was made. */
function fromRow(r: Row): Submission {
  const d = [...(r.decisions ?? [])].sort((a, b) => (a.decided_at < b.decided_at ? 1 : -1))[0];
  return {
    id: r.id, contributor: r.contributor, kind: r.kind, text: r.body, improves: r.improves, content: r.content, motion: r.motion ?? null, state: r.state, reason: r.reason ?? null, report: r.report ?? null,
    decision: d ? { as: d.verdict, hash: d.hash, note: d.note, by: d.decided_by, date: d.decided_on } : null, date: r.submitted_on,
  };
}

const CODES = ["E_ROLE", "E_SIZE", "E_INPUT", "E_STATE", "E_STALE", "E_NO_SUBMISSION", "E_RATE", "E_KEY"] as const;

/** A failed response as an IntakeError: the SQL's or the function's "E_CODE: message", else by HTTP status. */
async function refusal(res: Response): Promise<IntakeError> {
  const text = await res.text();
  let body: { message?: string; code?: string; error?: string } = {};
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    // not JSON: the status says it
  }
  const message = body.message ?? body.error ?? text.slice(0, 200), coded = /^(E_[A-Z_]+): (.*)$/s.exec(message);
  if (coded && (CODES as readonly string[]).includes(coded[1]!)) return new IntakeError(coded[1] as IntakeError["code"], coded[2]!);
  if (res.status === 401 || res.status === 403 || body.code === "42501") return new IntakeError("E_ROLE", `the hosted store refused this role (${message}); sign in, or use the key the role needs`);
  if (res.status === 413) return new IntakeError("E_SIZE", message);
  if (res.status === 429) return new IntakeError("E_RATE", message);
  return new IntakeError("E_STORE", `the hosted store answered ${res.status}: ${message}`);
}

/** The hosted IntakeStore as the caller `o` names. */
export function supabaseStore(o: SupabaseOptions): IntakeStore {
  const f = o.fetch ?? fetch, base = o.url.replace(/\/+$/, "");
  const headers = (more: Record<string, string> = {}): Record<string, string> => ({ apikey: o.apikey, "content-type": "application/json", ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...more });
  const send = async <T>(path: string, init: RequestInit): Promise<T> => {
    let res: Response;
    try {
      res = await f(`${base}${path}`, init);
    } catch (err) {
      throw new IntakeError("E_STORE", `the hosted store can't be reached (${(err as Error).message}); check the project's URL`);
    }
    if (!res.ok) throw await refusal(res);
    return (await res.json()) as T;
  };
  const rows = async (query: string) => (await send<Row[]>(`/rest/v1/submissions?select=${encodeURIComponent(SELECT)}${query}&order=id`, { headers: headers() })).map(fromRow);
  const eq = (k: string, v: string) => `&${k}=eq.${encodeURIComponent(v)}`;
  const one = async (id: string) => (await rows(eq("id", id)))[0] ?? null;
  return {
    backend: "supabase",
    async submit(input) {
      checkInput(input);
      if (!o.key) throw new IntakeError("E_KEY", "submitting takes a contributor key: sign in once on the gallery's contributor page to get one");
      const body = JSON.stringify({ kind: input.kind, text: input.text, improves: input.improves ?? null, motion: motionOfText(input.kind, input.text) });
      const r = await send<{ submission: Row }>("/functions/v1/submit", { method: "POST", headers: headers({ "x-m3a-key": o.key }), body });
      return fromRow(r.submission);
    },
    get: one,
    list: (fl: ListFilter = {}) => rows([fl.state && eq("state", fl.state), fl.contributor && eq("contributor", fl.contributor), fl.motion && eq("motion", fl.motion)].filter(Boolean).join("")),
    async advance(id, to, more = {}) {
      const patch = { state: to, reason: more.reason ?? null, ...(more.report === undefined ? {} : { report: more.report }), ...(more.motion === undefined ? {} : { motion: more.motion }) };
      const done = await send<Row[]>(`/rest/v1/submissions?id=eq.${encodeURIComponent(id)}&select=id`, { method: "PATCH", headers: headers({ prefer: "return=representation" }), body: JSON.stringify(patch) });
      if (!done.length) throw new IntakeError("E_NO_SUBMISSION", `no submission ${JSON.stringify(id)} this role may move`);
      return (await one(id))!;
    },
    async decide(id, d) {
      if (!Object.hasOwn(VERDICTS, d.as)) throw new IntakeError("E_INPUT", `a verdict is ${Object.keys(VERDICTS).join(", ")}, not ${JSON.stringify(d.as)}`);
      const applied = await send<boolean>("/rest/v1/rpc/decide", { method: "POST", headers: headers(), body: JSON.stringify({ p_id: id, p_as: d.as, p_hash: d.hash, p_note: d.note, p_date: d.date }) });
      return { submission: (await one(id))!, applied };
    },
  };
}

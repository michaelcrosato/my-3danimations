// The `local` IntakeStore backend (PLAN.md §5.9, WP-8.2a): one JSON record a submission (`<id>.json`), kept through a
// StoreFiles (the Node entry's are files under .cache/intake/, written atomically, behind a lock file), used by tests,
// CI, the benchmark and every WP until O8's hosted project is linked. It holds itself to the same roles as the hosted
// store's row-level security: the role is the store's, given when it is opened, never read from a record or a name.
// Dates come from the clock it is given; nothing it hashes reads one.
import { contentHash, motionOfText, submissionId } from "./hash.ts";
import { CHECKER_MOVES, IntakeError, VERDICTS, checkInput, isHash, isSubmissionId, type Decision, type IntakeStore, type ListFilter, type Role, type State, type Submission } from "./types.ts";

/** Where a local store keeps its records: each read whole, written atomically, listed, and a lock that keeps every
 *  other writer (in this process or another) out while one holds it. */
export interface StoreFiles {
  /** A record's text, or null when there is none. */
  read(name: string): string | null;
  /** Writes a record atomically. */
  write(name: string, text: string): void;
  /** The records' names. */
  list(): string[];
  /** Takes the store's lock; resolves to its release. */
  lock(): Promise<() => void>;
}

/** StoreFiles in memory, with a lock taken one caller at a time: for the API and tests. */
export function memoryFiles(): StoreFiles {
  const m = new Map<string, string>();
  let tail = Promise.resolve();
  return {
    read: (n) => m.get(n) ?? null,
    write: (n, t) => void m.set(n, t),
    list: () => [...m.keys()],
    async lock() {
      let free!: () => void;
      const before = tail;
      tail = new Promise((ok) => (free = ok));
      await before;
      return free;
    },
  };
}

/** How a local store is opened: its files, the role it acts as (and the contributor's or owner's identity), and the
 *  clock that dates submissions and decisions (YYYY-MM-DD). */
export interface LocalOptions {
  files: StoreFiles;
  role: Role;
  id?: string;
  today(): string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A local IntakeStore acting as `o.role`. */
export function localStore(o: LocalOptions): IntakeStore {
  const { files, role } = o, who = role === "contributor" || role === "owner" ? (o.id ?? role) : role;
  if (role === "contributor" && !o.id) throw new IntakeError("E_INPUT", "a contributor's store names its accountable identity (id)");
  const only = (r: Role, what: string) => {
    if (role === "anon") throw new IntakeError("E_ROLE", "anonymous gets nothing from the intake store; sign in (a contributor key, the checker's service key or the owner's session)");
    if (role !== r) throw new IntakeError("E_ROLE", `only ${r === "owner" ? "the owner" : r === "checker" ? "the checker" : "a contributor"} ${what}; this store acts as the ${role}`);
  };
  const load = (id: string): Submission | null => {
    const t = isSubmissionId(id) ? files.read(`${id}.json`) : null;
    return t === null ? null : (JSON.parse(t) as Submission);
  };
  const save = (s: Submission) => files.write(`${s.id}.json`, `${JSON.stringify(s)}\n`);
  const sees = (s: Submission) => role === "owner" || role === "checker" || s.contributor === who;
  const reading = () => {
    if (role === "anon") only("owner", "reads");
  };
  /** `f` under the store's lock, on the submission `id` (E_NO_SUBMISSION when there is none). */
  const change = async <T>(id: string, f: (s: Submission) => T): Promise<T> => {
    const release = await files.lock();
    try {
      const s = load(id);
      if (!s) throw new IntakeError("E_NO_SUBMISSION", `no submission ${JSON.stringify(id)}; list them with the store's list()`);
      return f(s);
    } finally {
      release();
    }
  };
  return {
    backend: "local",
    async submit(input) {
      only("contributor", "submits");
      checkInput(input);
      const content = contentHash(input.text), id = submissionId(who, content), release = await files.lock();
      try {
        const was = load(id);
        if (was) return was;
        const s: Submission = { id, contributor: who, kind: input.kind, text: input.text, improves: input.improves ?? null, content, motion: motionOfText(input.kind, input.text), state: "submitted", reason: null, report: null, decision: null, date: o.today() };
        save(s);
        return s;
      } finally {
        release();
      }
    },
    async get(id) {
      reading();
      const s = load(id);
      return s && sees(s) ? s : null;
    },
    async list(f: ListFilter = {}) {
      reading();
      const all = files.list().filter((n) => n.endsWith(".json")).map((n) => load(n.slice(0, -5))).filter((s): s is Submission => s !== null);
      return all.filter((s) => sees(s) && (!f.state || s.state === f.state) && (!f.contributor || s.contributor === f.contributor) && (!f.motion || s.motion === f.motion)).sort((a, b) => (a.id < b.id ? -1 : 1));
    },
    async advance(id, to: State, more = {}) {
      only("checker", "moves a submission's state");
      return change(id, (s) => {
        if (!CHECKER_MOVES[s.state].includes(to)) throw new IntakeError("E_STATE", `${id} is ${s.state}; the checker moves it only to ${CHECKER_MOVES[s.state].join(" or ") || (s.state === "bounced" ? "nothing (it is bounced: its contributor sends it again as a new submission)" : "nothing (it is decided)")}`);
        if ((to === "bounced" || s.state === "adopted") && !more.reason) throw new IntakeError("E_INPUT", `moving ${id} to ${to} gives the contributor a reason`);
        if (more.motion !== undefined && !isHash(more.motion)) throw new IntakeError("E_INPUT", "motion is the clip's motion hash, 64 lower-case hex digits");
        const next: Submission = { ...s, state: to, reason: more.reason ?? null, report: more.report === undefined ? s.report : more.report, motion: more.motion ?? s.motion };
        save(next);
        return next;
      });
    },
    async decide(id, d) {
      only("owner", "decides");
      if (!Object.hasOwn(VERDICTS, d.as)) throw new IntakeError("E_INPUT", `a verdict is ${Object.keys(VERDICTS).join(", ")}, not ${JSON.stringify(d.as)}`);
      if (!isHash(d.hash) || !DATE.test(d.date)) throw new IntakeError("E_INPUT", "a decision gives the content hash it was made on (64 hex digits) and its date (YYYY-MM-DD)");
      return change(id, (s) => {
        const now = contentHash(s.text);
        if (now !== s.content || d.hash !== s.content) throw new IntakeError("E_STALE", `${id} changed since the decision was made (made on ${d.hash.slice(0, 12)}, it is ${now.slice(0, 12)} now); nothing was changed: review it again`);
        if (s.state === VERDICTS[d.as] && s.decision?.as === d.as && s.decision.hash === d.hash) return { submission: s, applied: false };
        if (s.state !== "awaiting review") throw new IntakeError("E_STATE", `${id} is ${s.state}, not awaiting review; only a submission awaiting review is decided`);
        const decision: Decision = { as: d.as, hash: d.hash, note: d.note, by: who, date: d.date }, next: Submission = { ...s, state: VERDICTS[d.as], decision };
        save(next);
        return { submission: next, applied: true };
      });
    },
  };
}

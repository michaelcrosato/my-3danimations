// The hosted intake schema, proved on a local Postgres 16 (WP-8.2a): a scratch cluster under .cache/intake-sql/ on a
// free port (TCP on 127.0.0.1 only), Supabase's auth, roles and storage stubbed (services/intake/test/stub.sql), the
// migrations applied, and the row-level security cases run through psql as each role with its JWT claims, as
// PostgREST would set them: anonymous gets nothing; a contributor reads only its own rows; editing its own
// user_metadata gains nothing; only the checker's service role moves states up to awaiting review; only the owner
// decides, on the hash. The trigger's ids and hashes are checked against hash.ts's. Skips, saying why, when Postgres
// 16 isn't installed (M3A_PG_BIN names another bin directory). Run alone: `npm test -- intake-sql`.
import { execFileSync, spawnSync } from "node:child_process";
import { chownSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentHash, submissionId } from "../src/intake/index.ts";

const BIN = process.env.M3A_PG_BIN ?? "/usr/lib/postgresql/16/bin", root = process.getuid?.() === 0;
const pgUser = (() => {
  try {
    return root ? { uid: Number(execFileSync("id", ["-u", "postgres"], { encoding: "utf8" })), gid: Number(execFileSync("id", ["-g", "postgres"], { encoding: "utf8" })) } : null;
  } catch {
    return null;
  }
})();
const why = !existsSync(join(BIN, "initdb")) ? `no Postgres 16 at ${BIN} (set M3A_PG_BIN)` : root && !pgUser ? "run as root with no postgres user to own the cluster" : null;
const ROOT = join(import.meta.dirname, "../../.."), SQL = join(ROOT, "services/intake"), DIR = join(ROOT, ".cache/intake-sql", String(process.pid));
const [A, B, OWNER] = ["6f1c2a7e-3b9d-4c2e-9a51-0d4e8b7f1a23", "1d2e3f40-5a6b-4c7d-8e9f-a0b1c2d3e4f5", "9e8d7c6b-5a49-4382-a1b0-c9d8e7f6a5b4"];
let port = 0;

/** A Postgres program, as the postgres user when this runs as root (initdb and the server refuse root). */
const pg = (prog: string, args: string[]) => {
  const r = root ? spawnSync("runuser", ["-u", "postgres", "--", join(BIN, prog), ...args], { encoding: "utf8" }) : spawnSync(join(BIN, prog), args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${prog} failed: ${r.stderr || r.stdout}`);
};
/** Runs `text` through psql as the database owner, or as `role` with JWT `claims` in one transaction; its output and
 *  the error it stopped at ("" when none). */
function sql(text: string, as?: { role: string; sub?: string; meta?: object }): { out: string; err: string } {
  const claims = as ? JSON.stringify({ role: as.role, ...(as.sub ? { sub: as.sub } : {}), ...(as.meta ? { user_metadata: as.meta } : {}) }) : "";
  const input = as ? `begin;\nset local role ${as.role};\nselect set_config('request.jwt.claims', $c$${claims}$c$, true) \\g /dev/null\n${text}\ncommit;\n` : text;
  const r = spawnSync(join(BIN, "psql"), ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-f", "-"], { input, encoding: "utf8" });
  return { out: r.stdout.trim(), err: r.status === 0 ? "" : r.stderr.replace(/^psql:[^:]*:\d+: (ERROR|FATAL): +/, "").split("\n")[0]! };
}
const anon = { role: "anon" }, alice = { role: "authenticated", sub: A }, bob = { role: "authenticated", sub: B }, owner = { role: "authenticated", sub: OWNER }, checker = { role: "service_role" };
const text = (tag: string) => `{"format":"2.0","id":"INTAKE/Walk","desc":"walks (${tag})","keys":[]}`;
/** A submission's row values from hash.ts, as the submit function inserts them. */
const row = (uid: string, tag: string) => ((t, c) => ({ id: submissionId(uid, c), sql: `('${submissionId(uid, c)}', '${uid}', 'clip', $b$${t}$b$, '${c}')` }))(text(tag), contentHash(text(tag)));
const insert = (r: { sql: string }) => sql(`insert into public.submissions (id, contributor, kind, body, content) values ${r.sql};`, checker);
const move = (id: string, to: string, reason?: string) => sql(`update public.submissions set state = '${to}'${reason ? `, reason = '${reason}'` : ""} where id = '${id}';`, checker);
const decide = (id: string, as: string, hash: string, who: { role: string; sub?: string; meta?: object } = owner) => sql(`select public.decide('${id}', '${as}', '${hash}', 'a note', '2026-10-19');`, who);

describe.skipIf(why !== null)(`the hosted intake schema on Postgres 16${why ? ` (skipped: ${why})` : ""}`, () => {
  const a1 = row(A, "a1"), a2 = row(A, "a2"), b1 = row(B, "b1");
  beforeAll(async () => {
    port = await new Promise<number>((ok) => {
      const s = createServer().listen(0, "127.0.0.1", () => ((p) => s.close(() => ok(p)))((s.address() as { port: number }).port));
    });
    rmSync(DIR, { recursive: true, force: true });
    mkdirSync(DIR, { recursive: true });
    if (pgUser) chownSync(DIR, pgUser.uid, pgUser.gid);
    pg("initdb", ["-D", join(DIR, "db"), "-U", "postgres", "--auth=trust", "--no-sync", "-E", "UTF8"]);
    pg("pg_ctl", ["-D", join(DIR, "db"), "-l", join(DIR, "log"), "-w", "-o", `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories= -c fsync=off -c full_page_writes=off`, "start"]);
    for (const f of [join(SQL, "test/stub.sql"), ...readdirSync(join(SQL, "migrations")).sort().map((m) => join(SQL, "migrations", m))]) {
      const r = sql(readFileSync(f, "utf8"));
      if (r.err) throw new Error(`${f}: ${r.err}`);
    }
    expect(sql(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${OWNER}'); insert into public.intake_settings (owner) values ('${OWNER}');`).err).toBe("");
    for (const r of [a1, a2, b1]) expect(insert(r).err).toBe("");
    expect(sql(`insert into storage.objects (bucket_id, name) values ('intake', '${A}/${a1.id}/sheet.png'), ('intake', '${B}/${b1.id}/sheet.png');`, checker).err).toBe("");
  }, 60_000);
  afterAll(() => {
    try {
      pg("pg_ctl", ["-D", join(DIR, "db"), "-m", "immediate", "stop"]);
    } finally {
      rmSync(DIR, { recursive: true, force: true });
    }
  });

  it("gives anonymous nothing: no table, no function, no object", () => {
    for (const t of ["submissions", "decisions", "contributor_keys", "intake_settings"]) expect(sql(`select count(*) from public.${t};`, anon).err).toMatch(/^permission denied for table/);
    expect(sql(`select count(*) from storage.objects where bucket_id = 'intake';`, anon)).toEqual({ out: "0", err: "" });
    expect(decide(a1.id, "adopt", "0".repeat(64), anon).err).toMatch(/^permission denied for function decide/);
    expect(sql("select intake.owner();", anon).err).toMatch(/^permission denied for schema intake/);
  });

  it("lets a contributor read only its own rows, decisions, keys and objects", () => {
    expect(sql("select string_agg(id, ',' order by id) from public.submissions;", alice).out).toBe([a1.id, a2.id].sort().join(","));
    expect(sql("select string_agg(id, ',' order by id) from public.submissions;", bob).out).toBe(b1.id);
    expect(sql("select string_agg(name, ',') from storage.objects;", alice).out).toBe(`${A}/${a1.id}/sheet.png`);
    expect(sql("select count(*) from storage.objects;", owner).out).toBe("2");
    expect(sql(`insert into storage.objects (bucket_id, name) values ('intake', '${A}/x.png');`, alice).err).toMatch(/row-level security/);
  });

  it("gives a contributor nothing for editing its own user_metadata", () => {
    const claims = { role: "owner", is_owner: true, sub: OWNER, owner: OWNER };
    expect(sql(`select auth.update_own_metadata($m$${JSON.stringify(claims)}$m$);`, alice).err).toBe("");
    const impostor = { ...alice, meta: claims };
    expect(sql("select count(*) from public.submissions where contributor <> auth.uid();", impostor).out).toBe("0");
    expect(decide(a1.id, "adopt", contentHash(text("a1")), impostor).err).toMatch(/^E_ROLE: only the owner decides/);
    expect(sql("select count(*) from public.intake_settings;", impostor).err).toMatch(/^permission denied/);
  });

  it("lets only the checker's service role move states, up to awaiting review", () => {
    for (const who of [alice, owner]) expect(sql(`update public.submissions set state = 'checking' where id = '${a1.id}';`, who).err).toMatch(/^permission denied for table submissions/);
    expect(move(a1.id, "awaiting review").err).toMatch(/^E_STATE: .* is submitted; the checker does not move it to awaiting review/);
    expect(move(a1.id, "checking").err).toBe("");
    expect(move(a1.id, "adopted").err).toMatch(/^E_STATE/);
    expect(move(a1.id, "bounced").err).toMatch(/^E_INPUT: moving .* to bounced gives the contributor a reason/);
    expect(move(a1.id, "awaiting review").err).toBe("");
    expect(sql(`update public.submissions set body = 'other' where id = '${a1.id}';`, checker).err).toMatch(/^E_STATE: a submission's text and identity never change/);
    expect(sql(`insert into public.submissions (id, contributor, kind, body, content) values ('s-0000000000000000', '${A}', 'clip', '{}', '${"0".repeat(64)}');`, checker).err).toMatch(/^E_INPUT: content is the SHA-256 of the body/);
    expect(sql(`insert into public.decisions (submission, verdict, hash, decided_by, decided_on) values ('${a1.id}', 'adopt', '${contentHash(text("a1"))}', '${OWNER}', '2026-10-19');`, checker).err).toMatch(/^permission denied for table decisions/);
    expect(decide(a1.id, "adopt", contentHash(text("a1")), checker).err).toMatch(/^permission denied for function decide/);
  });

  it("lets only the owner decide, on the content hash, once; the contributor reads the decision", () => {
    const hash = contentHash(text("a1"));
    for (const who of [alice, bob]) expect(decide(a1.id, "adopt", hash, who).err).toMatch(/^E_ROLE/);
    expect(decide(a1.id, "adopt", contentHash("another text")).err).toMatch(/^E_STALE: .* changed since the decision was made/);
    expect(decide(a2.id, "adopt", contentHash(text("a2"))).err).toMatch(/^E_STATE: .* is submitted, not awaiting review/);
    expect(decide(a1.id, "adopt", hash)).toEqual({ out: "t", err: "" });
    expect(decide(a1.id, "adopt", hash)).toEqual({ out: "f", err: "" });
    expect(decide(a1.id, "reject", hash).err).toMatch(/^E_STATE: .* is adopted/);
    expect(sql(`select s.state || ' ' || d.verdict || ' ' || d.decided_by from public.submissions s join public.decisions d on d.submission = s.id where s.id = '${a1.id}';`, alice).out).toBe(`adopted adopt ${OWNER}`);
    expect(sql("select count(*) from public.decisions;", bob).out).toBe("0");
    expect(move(a1.id, "awaiting review").err).toMatch(/^E_INPUT/); // the adopt bot's return says why
    expect(move(a1.id, "awaiting review", "library gates failed").err).toBe("");
  });

  it("keeps contributor keys hashed, each contributor's own: added, revoked for good, never another's", () => {
    const k = (n: number) => contentHash(`key ${n}`);
    expect(sql(`insert into public.contributor_keys (hash, uid, label) values ('${k(1)}', '${A}', 'laptop');`, alice).err).toBe("");
    expect(sql(`insert into public.contributor_keys (hash, uid) values ('${k(2)}', '${B}');`, alice).err).toMatch(/row-level security/);
    expect(sql(`insert into public.contributor_keys (hash, uid) values ('not hex', '${A}');`, alice).err).toMatch(/check constraint/);
    expect(sql("select count(*) from public.contributor_keys;", bob).out).toBe("0");
    expect(sql(`update public.contributor_keys set hash = '${k(3)}' where uid = '${A}';`, alice).err).toMatch(/^permission denied/);
    expect(sql(`update public.contributor_keys set revoked_at = now() where hash = '${k(1)}';`, alice).err).toBe("");
    expect(sql(`update public.contributor_keys set revoked_at = null where hash = '${k(1)}';`, alice).err).toMatch(/row-level security/);
    expect(sql(`select count(*) from public.contributor_keys where hash = '${k(1)}' and revoked_at is not null;`, checker).out).toBe("1");
  });
});

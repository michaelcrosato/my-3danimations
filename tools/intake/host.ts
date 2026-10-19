// The intake tools' Node side (PLAN.md §5.9, WP-9.1a): the store the checker and the adopt bot act on (the local one
// under .cache/intake/, or the hosted one once O8's project is linked: its URL and the checker's service role key in
// the environment, the repository's Actions secrets M3A_SUPABASE_URL and M3A_SUPABASE_SERVICE_ROLE_KEY, the owner's
// fixed id read from its intake_settings row), the library of a checkout (its library/sets/ at every shipped tier, opened afresh: a scratch
// checkout's files change under the adopt bot), and the clock. Nothing here reads a secret it isn't given, and nothing
// prints one.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { directory, openLibrary } from "../../packages/library/src/node.ts";
import { IntakeError, localStore, supabaseStore, type IntakeStore, type Role } from "../../packages/tools/src/intake/index.ts";
import { INTAKE_DIR, intakeFiles } from "../../packages/tools/src/node/intake.ts";
import type { LibraryAccess } from "../../packages/tools/src/registry/registry.ts";
import { SHIPPED } from "../../packages/tools/src/tools/library-submit.ts";

/** The owner's identity in the local store: the reviewer `m3a review` decides as (packages/tools/src/node/intake.ts),
 *  fixed. The hosted store's is the owner's auth.uid(), as its one intake_settings row holds it (the migration's). */
export const LOCAL_OWNER = "owner";

/** The environment the hosted store is reached with: the repository's Actions secrets once O8 is linked, the project's
 *  URL and the checker's service role key. intake.yml does nothing without both. */
export const HOSTED_ENV = ["M3A_SUPABASE_URL", "M3A_SUPABASE_SERVICE_ROLE_KEY"] as const;

/** The hosted store's settings from `env`: both of HOSTED_ENV, or neither (null: not linked); one alone is a refusal
 *  naming the other, so a half-linked project never falls back to the local store unnoticed. */
export function hostedEnv(env: NodeJS.ProcessEnv = process.env): Record<(typeof HOSTED_ENV)[number], string> | null {
  const set = HOSTED_ENV.filter((k) => env[k]?.trim());
  if (!set.length) return null;
  if (set.length < HOSTED_ENV.length) throw new IntakeError("E_KEY", `the hosted store is half linked: ${HOSTED_ENV.filter((k) => !set.includes(k)).join(", ")} missing (the repository's Actions secrets, O8)`);
  return Object.fromEntries(HOSTED_ENV.map((k) => [k, env[k]!.trim()])) as Record<(typeof HOSTED_ENV)[number], string>;
}

/** A store the checker (or the adopt bot, which moves states as the checker does) acts on: which, the owner's fixed
 *  identity there (the hosted one's read from the store's own settings, never from a decision's record), and the local
 *  store's directory (null when hosted). */
export interface Opened {
  store: IntakeStore;
  owner(): Promise<string>;
  dir: string | null;
}

/** The hosted project's owner: the auth.uid() its one intake_settings row holds, read with the service role key. */
async function hostedOwner(url: string, key: string, f: typeof fetch): Promise<string> {
  const res = await f(`${url.replace(/\/+$/, "")}/rest/v1/intake_settings?select=owner`, { headers: { apikey: key, authorization: `Bearer ${key}` } }).catch((err: Error) => {
    throw new IntakeError("E_STORE", `the hosted store can't be reached (${err.message}); check M3A_SUPABASE_URL`);
  });
  const rows = res.ok ? ((await res.json()) as { owner?: unknown }[]) : [];
  if (!res.ok || typeof rows[0]?.owner !== "string") throw new IntakeError("E_STORE", `the hosted store names no owner (${res.status}): its intake_settings row is written when the project is linked (O8, services/intake/migrations)`);
  return rows[0].owner;
}

/** The checker's store: hosted when `env` links it (its fetch `fetch`), else the local one in `dir` (the working
 *  directory's .cache/intake/ by default), dated by `today`. */
export function checkerStore(opts: { cwd?: string; dir?: string; env?: NodeJS.ProcessEnv; today?: () => string; role?: Role; id?: string; fetch?: typeof fetch } = {}): Opened {
  const h = hostedEnv(opts.env);
  if (h) {
    const url = h.M3A_SUPABASE_URL, key = h.M3A_SUPABASE_SERVICE_ROLE_KEY, f = opts.fetch ?? fetch;
    return { store: supabaseStore({ url, apikey: key, token: key, fetch: f }), owner: () => hostedOwner(url, key, f), dir: null };
  }
  const dir = opts.dir ?? join(opts.cwd ?? process.cwd(), INTAKE_DIR);
  return { store: localStore({ files: intakeFiles(dir), role: opts.role ?? "checker", ...(opts.id ? { id: opts.id } : {}), today: opts.today ?? today }), owner: async () => LOCAL_OWNER, dir };
}

/** Today, YYYY-MM-DD, by the wall clock (the CLI's; tests give their own). */
export const today = (): string => new Date().toISOString().slice(0, 10);

/** SHA-256 of a text's UTF-8 bytes, in hex (Node's: the same as core's, faster). */
export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** The library of the checkout whose library/sets/ is `sets`, at every shipped tier, opened afresh with its lock and
 *  its license texts (library/LICENSES/), no installed pack joining: what a pull request holds, nothing else. */
export function libraryAt(sets: string): LibraryAccess {
  const source = directory(sets), library = openLibrary({ dir: sets, source, packs: {}, tiers: SHIPPED, warn: () => {} });
  const licenseText = (id: string) => {
    const f = join(sets, "..", "LICENSES", `${id}.txt`);
    return existsSync(f) ? readFileSync(f, "utf8") : null;
  };
  return { library, source, licenseText, tiers: SHIPPED, warnings: [] };
}

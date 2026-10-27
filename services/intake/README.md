# services/intake: the hosted intake store

**The owner's runbook for O8** (PLAN.md §5.9, D110): how to link a Supabase project to the intake queue. Until it is
linked, agents submit to the local store (`.cache/intake/`), intake.yml does nothing and says so, and ci.yml's
`intake-contract` fails asking for its secret. Steps 1 and 2 (the free-tier project, its schema and the submit
function) a session may run for the owner (D130), through the Supabase connector once the owner has connected it
(D137, below); steps 3 to 6 (the sign-in, the owner's row, the secrets, the Actions setting) are the owner's.

- `migrations/`: the schema (the owner's identity, contributor keys, submissions, decisions, the `intake` bucket, with
  row-level security on each), applied by `supabase db push`.
- `functions/submit/`: the submit function, `index.ts` serving `handler.ts` on Deno (the tests call `handler.ts`).
- `schemas/`: the queue's and the review's JSON schemas. `test/stub.sql`: what a Supabase project gives the migration,
  stubbed for `packages/tools/test/intake-sql.test.ts`; never applied to a project.

## The linked project (D138)

Steps 1 and 2 are done (2026-10-27, through the connector): the project `m3a-intake`, ref `suhheypppwwnddbgvngx`, in
us-east-1 on the free plan of the owner's one Supabase organization (Vercel's marketplace, $0).

- **URL:** `https://suhheypppwwnddbgvngx.supabase.co` (`VITE_M3A_INTAKE_URL`, `M3A_SUPABASE_URL`, the secret's `url`).
- **Publishable key:** `sb_publishable_7vKhs6s0iR5SHcH_JnPf6w_sFhVyb85` (`VITE_M3A_INTAKE_KEY`, the secret's
  `apikey`); public by design, as the contributor page's build carries it. The service role key is never written here.
- **The schema:** `migrations/20261019120000_intake.sql`, applied byte for byte (the stored statement's SHA-256 is the
  file's without its last newline), every table under row-level security; an anonymous client is refused on each
  table and on `decide`, and the bucket lists nothing.
- **The submit function:** `https://suhheypppwwnddbgvngx.supabase.co/functions/v1/submit`, `index.ts` and `handler.ts`
  as here, the JWT check off; it answers a GET 405, a POST without a key 401, an unknown key 401 after asking the
  database (so its service role reads), and a body that isn't JSON 400.
- **The advisors, answered:** `intake_settings` has no policy on purpose (only `intake.owner()`, a security definer,
  reads it); `decide` is a security definer callable when signed in on purpose (it checks the caller is the owner);
  the per-row `auth.uid()` in policies, two unindexed foreign keys and two unused indexes cost nothing at 20
  submissions a contributor a day: a later migration may add them if the queue grows.
- **Left to the owner:** steps 3 to 6 below, with these values: the GitHub OAuth app's callback
  `https://suhheypppwwnddbgvngx.supabase.co/auth/v1/callback`; the redirect URL
  `https://my-3danimations-ten.vercel.app/src/contributors/` (and previews' if wanted); the Vercel project's
  environment variables `VITE_M3A_INTAKE_URL` and `VITE_M3A_INTAKE_KEY` above, then a redeploy.

## Linking it

The Supabase CLI reads `supabase/config.toml`, `supabase/migrations/*.sql` and `supabase/functions/<name>/index.ts`
under its working directory. This directory keeps `migrations/` and `functions/` without that `supabase/` level, so
stage them in a scratch directory (`<repo>` is this repository's checkout):

1. `d=$(mktemp -d) && cd "$d" && supabase init && cp -r <repo>/services/intake/migrations <repo>/services/intake/functions supabase/`
2. `supabase link --project-ref <ref> && supabase db push && supabase functions deploy submit --no-verify-jwt`
   (`--no-verify-jwt`: an agent submits with its contributor key alone, in `x-m3a-key`, which the function checks).

   Through the Supabase connector instead (D137; no CLI or Deno needed): `create_project` on the free plan (the server
   quotes the cost; a nonzero quote waits for the owner), `apply_migration` with each file of `migrations/` in name
   order, then `deploy_edge_function` named `submit` with `index.ts` and `handler.ts` and `verify_jwt` off, as
   `--no-verify-jwt`. `get_project_url` and `get_publishable_keys` give the URL and publishable key steps 3 and 5 use;
   the service role key is the owner's to copy from the dashboard into the secrets.
3. Authentication: enable the GitHub provider (a GitHub OAuth app whose callback is the project's
   `/auth/v1/callback`) and add the contributor page's address to the redirect URLs. The page is the gallery's
   `src/contributors/`, built with `VITE_M3A_INTAKE_URL` (the project's URL) and `VITE_M3A_INTAKE_KEY` (its
   publishable key: a build given a secret key fails).
4. Sign in there once with GitHub, then, in the SQL editor as the database owner, name yourself the owner (your id is
   under Authentication, Users): `insert into public.intake_settings (owner) values ('<your auth.users id>');`
5. The repository's Actions secrets:
   - `M3A_SUPABASE_URL` (the project's URL) and `M3A_SUPABASE_SERVICE_ROLE_KEY` (its service role key), for
     intake.yml's checker and adopt bot.
   - `M3A_INTAKE_SUPABASE`, for ci.yml's `intake-contract` (G9's hosted proof): the JSON
     `{ "url", "apikey", "service", "owner", "a", "b", "impostor" }`, that is the project's URL, its publishable key,
     its service role key and four signed-in users, each `{ "token", "key"?, "id"? }`: the owner; contributor `a`
     with `key` (a contributor key whose SHA-256 it added on the contributor page) and `id` (its auth.users id);
     contributor `b` with `id`; and `impostor`, a contributor whose name claims the owner's. A `token` is a user's
     access token, which expires (an hour by default): set the secret just before dispatching.
6. Settings, Actions, General: "Allow GitHub Actions to create and approve pull requests", so the adopt bot opens the
   pull requests of the owner's adoptions.

Then dispatch ci.yml with the gate `intake-contract` (packages/tools/test/intake-contract.test.ts on the project), and
intake.yml's next run checks the hosted store's submissions every 15 minutes, which also keeps a free project awake
(D110).

# services/intake: the hosted intake store

**The owner's runbook for O8** (PLAN.md §5.9, D110): how to link a Supabase project to the intake queue. Until it is
linked, agents submit to the local store (`.cache/intake/`), intake.yml does nothing and says so, and ci.yml's
`intake-contract` fails asking for its secret. The session creates no Supabase resource: every step here is the
owner's.

- `migrations/`: the schema (the owner's identity, contributor keys, submissions, decisions, the `intake` bucket, with
  row-level security on each), applied by `supabase db push`.
- `functions/submit/`: the submit function, `index.ts` serving `handler.ts` on Deno (the tests call `handler.ts`).
- `schemas/`: the queue's and the review's JSON schemas. `test/stub.sql`: what a Supabase project gives the migration,
  stubbed for `packages/tools/test/intake-sql.test.ts`; never applied to a project.

## Linking it

The Supabase CLI reads `supabase/config.toml`, `supabase/migrations/*.sql` and `supabase/functions/<name>/index.ts`
under its working directory. This directory keeps `migrations/` and `functions/` without that `supabase/` level, so
stage them in a scratch directory (`<repo>` is this repository's checkout):

1. `d=$(mktemp -d) && cd "$d" && supabase init && cp -r <repo>/services/intake/migrations <repo>/services/intake/functions supabase/`
2. `supabase link --project-ref <ref> && supabase db push && supabase functions deploy submit --no-verify-jwt`
   (`--no-verify-jwt`: an agent submits with its contributor key alone, in `x-m3a-key`, which the function checks).
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

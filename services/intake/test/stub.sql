-- Test only, never applied to a hosted project: what a Supabase project gives the intake migrations, stubbed on a
-- plain Postgres 16 so packages/tools/test/intake-sql.test.ts can run them and their row-level security cases. The API
-- roles (anon, authenticated, and service_role, which bypasses row-level security); auth.users with its editable
-- user_metadata; auth.jwt(), auth.uid() and auth.role() read from the request's JWT claims as Supabase's do (PostgREST
-- sets request.jwt.claims; the test sets it per case); the storage schema's buckets and objects with row-level
-- security on and storage.foldername; and Supabase's default privileges, which grant every new table and function in
-- public to the API roles, so what the migrations revoke is what keeps a role out.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create schema storage;
grant usage on schema auth, storage, public to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb not null default '{}',
  raw_app_meta_data jsonb not null default '{}'
);

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt() ->> 'role' $$;

-- What Supabase's auth API lets every signed-in user do: replace its own user_metadata.
create function auth.update_own_metadata(m jsonb) returns void language sql security definer as $$
  update auth.users set raw_user_meta_data = m where id = auth.uid()
$$;
grant execute on function auth.update_own_metadata(jsonb) to authenticated;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

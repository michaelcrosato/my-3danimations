-- The intake queue's hosted schema (PLAN.md §5.9, WP-8.2a), applied to O8's Supabase project once it is linked
-- (supabase db push): the owner's fixed identity, contributor keys (stored hashed), submissions, the owner's decisions
-- and the `intake` storage bucket, with row-level security on every table and the bucket.
--
-- Roles: anonymous (anon) gets nothing: no grant, no policy. A contributor (authenticated) reads only its own rows and
-- keys, adds and revokes its own keys, and writes nothing else; editing its own user_metadata gains nothing, since no
-- policy reads metadata. Only the checker's service role (service_role, the key in the repository's Actions secrets)
-- inserts submissions (through the submit function) and moves states up to `awaiting review` (the guard trigger holds
-- it to the checker's moves), at most 20 a contributor in 24 hours (the rate trigger, under a lock). Only the owner
-- decides: public.decide checks auth.uid() against the one UUID in public.intake_settings, set once when the project
-- is linked, never against metadata, and only decide moves a state to a verdict (the guard reads the role it runs as
-- and the decision it has just written, not a setting a session could set). A decision applies only while the hash it
-- was made on is the submission's content hash, recomputed from its body.
--
-- Mirrors packages/tools/src/intake/ (types.ts's states and moves, hash.ts's ids); packages/tools/test/intake-sql.test.ts
-- runs this file and its cases on a local Postgres with Supabase's auth stubbed (services/intake/test/stub.sql).

create schema if not exists intake;
revoke all on schema intake from public;
grant usage on schema intake to authenticated, service_role;

-- The owner: one row, written by the database owner when the project is linked:
--   insert into public.intake_settings (owner) values ('<the owner''s auth.users id>');
create table public.intake_settings (
  one boolean primary key default true check (one),
  owner uuid not null
);
alter table public.intake_settings enable row level security;
revoke all on table public.intake_settings from anon, authenticated, service_role;

create function intake.owner() returns uuid
  language sql stable security definer set search_path = ''
  as $$ select owner from public.intake_settings where one $$;
revoke all on function intake.owner() from public, anon;
grant execute on function intake.owner() to authenticated, service_role;

-- Contributor keys: a human signs in once on the gallery and adds a key's SHA-256 (the key itself never leaves the
-- agent's environment); the submit function looks a key up by its hash. Revoking sets revoked_at, for good.
create table public.contributor_keys (
  hash text primary key check (hash ~ '^[0-9a-f]{64}$'),
  uid uuid not null references auth.users (id) on delete cascade,
  label text not null default '' check (length(label) <= 80),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.contributor_keys enable row level security;
revoke all on table public.contributor_keys from anon, authenticated, service_role;
grant select, insert (hash, uid, label), update (revoked_at) on table public.contributor_keys to authenticated;
grant select on table public.contributor_keys to service_role;
create policy keys_read_own on public.contributor_keys for select to authenticated using (uid = auth.uid());
create policy keys_add_own on public.contributor_keys for insert to authenticated with check (uid = auth.uid() and revoked_at is null);
create policy keys_revoke_own on public.contributor_keys for update to authenticated using (uid = auth.uid()) with check (uid = auth.uid() and revoked_at is not null);

-- Submissions: the body is the clip's or recipe's JSON (data, never instructions), content its SHA-256, and the id
-- 's-' and 16 hex digits of the SHA-256 of the contributor's id, a newline and the content (hash.ts submissionId).
create table public.submissions (
  id text primary key check (id ~ '^s-[0-9a-f]{16}$'),
  contributor uuid not null references auth.users (id),
  kind text not null check (kind in ('clip', 'recipe')),
  body text not null check (octet_length(body) <= 262144),
  improves text check (improves ~ '^[A-Z][A-Z0-9_]*/[A-Za-z0-9_-]+$'),
  content text not null check (content ~ '^[0-9a-f]{64}$'),
  motion text check (motion ~ '^[0-9a-f]{64}$'),
  state text not null default 'submitted' check (state in ('submitted', 'checking', 'bounced', 'awaiting review', 'adopted', 'archived', 'rejected')),
  reason text check (length(reason) <= 2000),
  report jsonb,
  submitted_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index submissions_by_contributor on public.submissions (contributor, created_at);
create index submissions_by_motion on public.submissions (motion);
alter table public.submissions enable row level security;
revoke all on table public.submissions from anon, authenticated, service_role;
grant select on table public.submissions to authenticated;
grant select, insert, update on table public.submissions to service_role;
create policy submissions_read on public.submissions for select to authenticated using (contributor = auth.uid() or auth.uid() = intake.owner());

-- The owner's decisions, each with the content hash it was made on; written by public.decide alone.
create table public.decisions (
  id bigint generated always as identity primary key,
  submission text not null references public.submissions (id) on delete cascade,
  verdict text not null check (verdict in ('adopt', 'archive', 'reject')),
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  note text not null default '' check (length(note) <= 4000),
  decided_by uuid not null,
  decided_on date not null,
  decided_at timestamptz not null default now()
);
alter table public.decisions enable row level security;
revoke all on table public.decisions from anon, authenticated, service_role;
revoke all on sequence public.decisions_id_seq from anon, authenticated, service_role;
grant select on table public.decisions to authenticated, service_role;
create policy decisions_read on public.decisions for select to authenticated
  using (auth.uid() = intake.owner() or exists (select 1 from public.submissions s where s.id = submission and s.contributor = auth.uid()));

-- The guard: a submission starts `submitted` with its content hash and id made from its body; its text and identity
-- never change; its state moves only by the checker's moves (the service role) or the owner's decision: decide runs as
-- its owner, never a client role, and has just written the decision the new state follows.
create function intake.guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.state <> 'submitted' or new.reason is not null or new.report is not null then
      raise exception 'E_STATE: a submission starts submitted, with no reason or report';
    end if;
    if new.content <> encode(sha256(convert_to(new.body, 'UTF8')), 'hex')
      or new.id <> 's-' || left(encode(sha256(convert_to(new.contributor::text || chr(10) || new.content, 'UTF8')), 'hex'), 16) then
      raise exception 'E_INPUT: content is the SHA-256 of the body, and the id is made from the contributor and content';
    end if;
    return new;
  end if;
  if (new.id, new.contributor, new.kind, new.body, new.improves, new.content, new.submitted_on, new.created_at)
    is distinct from (old.id, old.contributor, old.kind, old.body, old.improves, old.content, old.submitted_on, old.created_at) then
    raise exception 'E_STATE: a submission''s text and identity never change; send a new one';
  end if;
  if new.state is distinct from old.state then
    if current_setting('intake.deciding', true) = old.id and current_user not in ('anon', 'authenticated', 'service_role') then
      if old.state <> 'awaiting review' or new.state not in ('adopted', 'archived', 'rejected') then
        raise exception 'E_STATE: % is %, not awaiting review', old.id, old.state;
      end if;
      if not exists (select 1 from public.decisions d where d.id = (select max(id) from public.decisions where submission = old.id)
          and d.hash = old.content and new.state = case d.verdict when 'adopt' then 'adopted' when 'archive' then 'archived' else 'rejected' end) then
        raise exception 'E_STATE: % moves to % only by the owner''s decision on its content hash', old.id, new.state;
      end if;
    elsif current_user = 'service_role' then
      if (old.state, new.state) not in (('submitted', 'checking'), ('checking', 'bounced'), ('checking', 'awaiting review'), ('awaiting review', 'checking'), ('adopted', 'awaiting review')) then
        raise exception 'E_STATE: % is %; the checker does not move it to %', old.id, old.state, new.state;
      end if;
      if (new.state = 'bounced' or old.state = 'adopted') and coalesce(new.reason, '') = '' then
        raise exception 'E_INPUT: moving % to % gives the contributor a reason', old.id, new.state;
      end if;
    else
      raise exception 'E_ROLE: only the checker''s service role moves a submission''s state, and only the owner decides' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger submissions_guard before insert or update on public.submissions for each row execute function intake.guard();

-- The rate: at most 20 submissions a contributor in 24 hours (PER_DAY in services/intake/functions/submit/handler.ts),
-- held here, since the function's own count and insert are two requests that parallel ones all pass; a contributor's
-- inserts wait on one lock, so each counts the ones before it.
create function intake.rate() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('intake.rate ' || new.contributor::text, 0));
  select count(*) into n from public.submissions where contributor = new.contributor and created_at > now() - interval '24 hours';
  if n >= 20 then
    raise exception 'E_RATE: % submissions in the last 24 hours, the most a contributor sends; send again tomorrow', n;
  end if;
  return new;
end $$;
create trigger submissions_rate before insert on public.submissions for each row execute function intake.rate();

-- The owner's decision: true when applied, false when the same verdict on the same hash holds already.
create function public.decide(p_id text, p_as text, p_hash text, p_note text default '', p_date date default current_date)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  s public.submissions;
  last public.decisions;
  me uuid := auth.uid();
  want text := case p_as when 'adopt' then 'adopted' when 'archive' then 'archived' when 'reject' then 'rejected' end;
begin
  if me is null or me is distinct from intake.owner() then
    raise exception 'E_ROLE: only the owner decides; sign in as the owner' using errcode = '42501';
  end if;
  if want is null then
    raise exception 'E_INPUT: a verdict is adopt, archive or reject, not %', p_as;
  end if;
  select * into s from public.submissions where id = p_id for update;
  if not found then
    raise exception 'E_NO_SUBMISSION: no submission %', p_id;
  end if;
  if p_hash is distinct from s.content or s.content <> encode(sha256(convert_to(s.body, 'UTF8')), 'hex') then
    raise exception 'E_STALE: % changed since the decision was made (made on %, it is % now); nothing was changed: review it again', p_id, left(p_hash, 12), left(s.content, 12);
  end if;
  select * into last from public.decisions where submission = p_id order by id desc limit 1;
  if s.state = want and last.verdict = p_as and last.hash = p_hash then
    return false;
  end if;
  if s.state <> 'awaiting review' then
    raise exception 'E_STATE: % is %, not awaiting review; only a submission awaiting review is decided', p_id, s.state;
  end if;
  insert into public.decisions (submission, verdict, hash, note, decided_by, decided_on)
    values (p_id, p_as, p_hash, coalesce(p_note, ''), me, coalesce(p_date, current_date));
  perform set_config('intake.deciding', p_id, true);
  update public.submissions set state = want where id = p_id;
  perform set_config('intake.deciding', '', true);
  return true;
end $$;
revoke all on function public.decide(text, text, text, text, date) from public, anon, service_role;
grant execute on function public.decide(text, text, text, text, date) to authenticated;
revoke all on function intake.guard() from public, anon, authenticated;
revoke all on function intake.rate() from public, anon, authenticated;

-- The bucket: the checker's preview sheets and reports, under <contributor id>/<submission id>/; private, written by
-- the service role alone (no insert, update or delete policy), read by their contributor and the owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('intake', 'intake', false, 1048576, array['image/png', 'application/json'])
  on conflict (id) do nothing;
create policy intake_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'intake' and ((storage.foldername(name))[1] = auth.uid()::text or auth.uid() = intake.owner()));

-- Enough of Supabase to run schema.sql on a plain Postgres.
--
-- Supabase supplies an `auth` schema, an `auth.uid()` that reads the caller's
-- JWT, the `anon` and `authenticated` roles, and a realtime publication. None of
-- that exists on a bare database, so the schema cannot even be parsed without
-- these. Recreating them here means the rules get tested against real Postgres
-- instead of being hoped at.
--
-- auth.uid() reads a session setting rather than a JWT, which is the only
-- difference that matters. Tests call set_user() to become somebody.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- The real one decodes a JWT. This reads a GUC so a test can switch identity.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.user_id', true), '')::uuid
$$;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

do $$ begin
  create publication supabase_realtime;
exception when duplicate_object then null; end $$;

-- Supabase grants these by default; RLS is what actually restricts access.
grant usage on schema public, auth to anon, authenticated;
grant select on auth.users to anon, authenticated;

-- Become a given user for the statements that follow.
create or replace function set_user(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('test.user_id', coalesce(p_user::text, ''), false);
end $$;

-- Fails loudly with a readable message instead of a silent wrong answer.
create or replace function assert(ok boolean, what text) returns void
language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAILED: %', what;
  end if;
  raise notice '  ok: %', what;
end $$;

-- Did this statement raise? Used to prove a rule actually blocks something,
-- rather than quietly allowing it.
create or replace function refuses(sql text, what text) returns void
language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice '  ok: % (refused: %)', what, left(sqlerrm, 60);
    return;
  end;
  raise exception 'FAILED: % — the statement was allowed', what;
end $$;

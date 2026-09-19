-- imdown schema. Run in the Supabase SQL editor on a fresh project.
--
-- Rules that must hold no matter which client calls them live here, not in the app:
--   * a friendship needs both sides to agree
--   * enough of a circle tapping the same plan PROPOSES a hangout, it does not confirm one
--   * a late friend joins the open hangout instead of being stranded
--   * an outing can only be settled once, so proof counts cannot be inflated

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{2,20}$'),
  display_name text not null,
  emoji text not null default '🙂',
  -- how many of your circle must be down before a hangout is proposed
  threshold smallint not null default 2 check (threshold between 2 and 8),
  created_at timestamptz not null default now()
);

-- Accepted friendships only. Stored both directions by accept_friend_request().
create table if not exists friendships (
  user_id uuid not null references profiles(id) on delete cascade,
  friend_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references profiles(id) on delete cascade,
  to_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_id, to_id),
  check (from_id <> to_id)
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 120),
  steps text[] not null default '{}',
  area text not null default '',
  vibe text[] not null default '{}',
  cost_per_person numeric not null default 0 check (cost_per_person >= 0),
  hours numeric not null default 2,
  best_time text not null default '',
  tips text[] not null default '{}',
  done_count int not null default 0,
  last_done_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists taps (
  plan_id uuid not null references plans(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

do $$ begin
  create type hangout_status as enum ('voting', 'confirmed', 'done', 'flopped');
exception when duplicate_object then null; end $$;

create table if not exists hangouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  status hangout_status not null default 'voting',
  chosen_slot_id uuid,
  recap_note text,
  recap_photo text,
  recap_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists hangout_members (
  hangout_id uuid not null references hangouts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (hangout_id, user_id)
);

create table if not exists time_slots (
  id uuid primary key default gen_random_uuid(),
  hangout_id uuid not null references hangouts(id) on delete cascade,
  label text not null,
  at timestamptz not null
);

create table if not exists slot_votes (
  slot_id uuid not null references time_slots(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (slot_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  hangout_id uuid not null references hangouts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  text text not null check (length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- One share is one link dropped into one group chat. Interest is scoped to the
-- share, so posting an outing publicly never reveals tonight's plans.
create table if not exists shares (
  id text primary key,
  plan_id uuid not null references plans(id) on delete cascade,
  by_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists guest_interests (
  id uuid primary key default gen_random_uuid(),
  share_id text not null references shares(id) on delete cascade,
  name text not null check (length(name) between 2 and 24),
  created_at timestamptz not null default now(),
  unique (share_id, name)
);

-- ---------- helpers ----------
-- SECURITY DEFINER on purpose. A policy on hangout_members that called a plain
-- function reading hangout_members would recurse into itself and every read of a
-- hangout would fail. Running as definer reads the table without re-entering RLS.
create or replace function is_member(h uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from hangout_members where hangout_id = h and user_id = auth.uid())
$$;

create or replace function is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from friendships where user_id = a and friend_id = b)
$$;

-- ---------- friendship, by consent ----------
create or replace function send_friend_request(p_to uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare inbound uuid;
begin
  if p_to = auth.uid() then return 'That is you.'; end if;
  if is_friend(auth.uid(), p_to) then return 'Already friends.'; end if;

  -- If they already asked you, sending one back just accepts theirs.
  select id into inbound from friend_requests where from_id = p_to and to_id = auth.uid();
  if inbound is not null then perform accept_friend_request(inbound); return null; end if;

  insert into friend_requests(from_id, to_id) values (auth.uid(), p_to) on conflict do nothing;
  return null;
end $$;

create or replace function accept_friend_request(p_request uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r friend_requests%rowtype;
begin
  select * into r from friend_requests where id = p_request;
  if r.id is null then raise exception 'no such request'; end if;
  -- Only the person who received it may accept it.
  if r.to_id <> auth.uid() then raise exception 'not your request'; end if;

  insert into friendships(user_id, friend_id) values (r.from_id, r.to_id) on conflict do nothing;
  insert into friendships(user_id, friend_id) values (r.to_id, r.from_id) on conflict do nothing;
  delete from friend_requests where id = p_request;
end $$;

create or replace function decline_friend_request(p_request uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from friend_requests where id = p_request and (to_id = auth.uid() or from_id = auth.uid());
end $$;

create or replace function remove_friend(p_friend uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from friendships where (user_id = auth.uid() and friend_id = p_friend)
                             or (user_id = p_friend and friend_id = auth.uid());
end $$;

-- ---------- the core rule ----------
-- Enough of your circle down on the same plan PROPOSES a hangout. A time still
-- has to win a vote. Someone who taps after that joins the open one.
create or replace function on_tap() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  circle uuid[];
  tappers uuid[];
  need int;
  open_h uuid;
  h uuid;
  fri timestamptz; sat timestamptz; sun timestamptz;
begin
  select coalesce(array_agg(friend_id), '{}') into circle from friendships where user_id = new.user_id;
  circle := array_append(circle, new.user_id);

  select id into open_h
  from hangouts hg
  where hg.plan_id = new.plan_id
    and hg.status in ('voting', 'confirmed')
    and exists (select 1 from hangout_members hm where hm.hangout_id = hg.id and hm.user_id = any(circle))
  limit 1;

  -- Late arrival: join rather than start a second, competing hangout.
  if open_h is not null then
    insert into hangout_members(hangout_id, user_id) values (open_h, new.user_id) on conflict do nothing;
    return new;
  end if;

  select coalesce(array_agg(user_id), '{}') into tappers
  from taps where plan_id = new.plan_id and user_id = any(circle);

  select greatest(threshold, 2) into need from profiles where id = new.user_id;
  if coalesce(array_length(tappers, 1), 0) < coalesce(need, 2) then return new; end if;

  insert into hangouts(plan_id) values (new.plan_id) returning id into h;
  insert into hangout_members(hangout_id, user_id) select h, unnest(tappers) on conflict do nothing;

  -- next Fri 7pm, Sat 2pm, Sun 6pm; the client renders these in local time.
  fri := date_trunc('week', now()) + interval '4 days 19 hours';  if fri <= now() then fri := fri + interval '7 days'; end if;
  sat := date_trunc('week', now()) + interval '5 days 14 hours';  if sat <= now() then sat := sat + interval '7 days'; end if;
  sun := date_trunc('week', now()) + interval '6 days 18 hours';  if sun <= now() then sun := sun + interval '7 days'; end if;
  insert into time_slots(hangout_id, label, at) values
    (h, 'Fri 7:00 PM', fri), (h, 'Sat 2:00 PM', sat), (h, 'Sun 6:00 PM', sun);
  return new;
end $$;

drop trigger if exists taps_after_insert on taps;
create trigger taps_after_insert after insert on taps for each row execute function on_tap();

create or replace function join_hangout(p_hangout uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare ok boolean;
begin
  -- You may only join a hangout that a friend of yours is already in.
  select exists (
    select 1 from hangout_members hm where hm.hangout_id = p_hangout and is_friend(auth.uid(), hm.user_id)
  ) into ok;
  if not ok then raise exception 'not invited'; end if;
  if (select status from hangouts where id = p_hangout) not in ('voting', 'confirmed') then
    raise exception 'that hangout is closed';
  end if;
  insert into hangout_members(hangout_id, user_id) values (p_hangout, auth.uid()) on conflict do nothing;
end $$;

-- Vote for a slot. Majority of members confirms it.
create or replace function vote_time(p_hangout uuid, p_slot uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare n_members int; winner uuid;
begin
  if not is_member(p_hangout) then raise exception 'not a member'; end if;
  if not exists (select 1 from time_slots where id = p_slot and hangout_id = p_hangout) then
    raise exception 'that slot is not on this hangout';
  end if;

  delete from slot_votes sv using time_slots ts
    where sv.slot_id = ts.id and ts.hangout_id = p_hangout and sv.user_id = auth.uid();
  insert into slot_votes(slot_id, user_id) values (p_slot, auth.uid()) on conflict do nothing;

  select count(*) into n_members from hangout_members where hangout_id = p_hangout;
  select ts.id into winner
  from time_slots ts join slot_votes sv on sv.slot_id = ts.id
  where ts.hangout_id = p_hangout
  group by ts.id having count(*) >= (n_members / 2) + 1
  order by count(*) desc
  limit 1;

  if winner is not null then
    update hangouts set status = 'confirmed', chosen_slot_id = winner where id = p_hangout and status = 'voting';
  end if;
end $$;

-- Did it happen? Guarded so it can only be settled once: pressing "we did it"
-- twice, or two members pressing it, cannot inflate the plan's proof count.
create or replace function mark_outcome(p_hangout uuid, p_happened boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid; updated int;
begin
  if not is_member(p_hangout) then raise exception 'not a member'; end if;

  update hangouts
     set status = case when p_happened then 'done' else 'flopped' end::hangout_status
   where id = p_hangout and status in ('voting', 'confirmed')
   returning plan_id into pid;

  get diagnostics updated = row_count;
  if updated = 0 then return; end if;   -- already settled, do nothing

  if p_happened then
    update plans set done_count = done_count + 1, last_done_at = now() where id = pid;
  end if;
  delete from taps where plan_id = pid and user_id in (select user_id from hangout_members where hangout_id = p_hangout);
end $$;

create or replace function add_recap(p_hangout uuid, p_note text, p_photo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_member(p_hangout) then raise exception 'not a member'; end if;
  update hangouts set recap_note = p_note, recap_photo = p_photo, recap_at = now() where id = p_hangout;
end $$;

-- Public share page: one call, no account, no exposure of anything private.
create or replace function get_share(p_share text)
returns table (plan_id uuid, title text, steps text[], area text, vibe text[],
               cost_per_person numeric, hours numeric, best_time text, tips text[],
               done_count int, shared_by text, names text[])
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.title, p.steps, p.area, p.vibe, p.cost_per_person, p.hours, p.best_time, p.tips,
         p.done_count, pr.display_name,
         coalesce((select array_agg(g.name order by g.created_at) from guest_interests g where g.share_id = s.id), '{}')
  from shares s join plans p on p.id = s.plan_id join profiles pr on pr.id = s.by_id
  where s.id = p_share
$$;

create or replace function add_guest_interest(p_share text, p_name text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare clean text;
begin
  clean := btrim(p_name);
  if length(clean) < 2 or length(clean) > 24 then return 'Put a name so they know who is in.'; end if;
  if not exists (select 1 from shares where id = p_share) then return 'This link is not valid.'; end if;
  if exists (select 1 from guest_interests where share_id = p_share and lower(name) = lower(clean)) then
    return 'You are already in.';
  end if;
  insert into guest_interests(share_id, name) values (p_share, clean);
  return null;
end $$;

-- Auto-create a profile row on signup.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare base text; candidate text; n int := 0;
begin
  base := coalesce(new.raw_user_meta_data->>'username', regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
  if length(base) < 2 then base := 'user'; end if;
  candidate := left(base, 20);
  -- usernames are unique, so add a suffix until one is free
  while exists (select 1 from profiles where username = candidate) loop
    n := n + 1;
    candidate := left(base, 17) || n::text;
  end loop;

  insert into profiles(id, username, display_name)
  values (new.id, candidate, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------- row level security ----------
alter table profiles enable row level security;
alter table friendships enable row level security;
alter table friend_requests enable row level security;
alter table plans enable row level security;
alter table taps enable row level security;
alter table hangouts enable row level security;
alter table hangout_members enable row level security;
alter table time_slots enable row level security;
alter table slot_votes enable row level security;
alter table messages enable row level security;
alter table shares enable row level security;
alter table guest_interests enable row level security;

drop policy if exists "profiles readable" on profiles;
create policy "profiles readable" on profiles for select using (true);
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "my friendships" on friendships;
create policy "my friendships" on friendships for select using (user_id = auth.uid());

-- Requests you sent or received. Writing goes through the RPCs above.
drop policy if exists "my requests" on friend_requests;
create policy "my requests" on friend_requests for select using (from_id = auth.uid() or to_id = auth.uid());

-- Plans are the public idea layer. Everyone reads, signed-in users add.
drop policy if exists "plans readable" on plans;
create policy "plans readable" on plans for select using (true);
drop policy if exists "plans insert" on plans;
create policy "plans insert" on plans for insert with check (created_by = auth.uid());

-- Taps: your own and your friends'. Nobody else sees what you are down for.
drop policy if exists "taps visible" on taps;
create policy "taps visible" on taps for select using (user_id = auth.uid() or is_friend(auth.uid(), user_id));
drop policy if exists "taps own insert" on taps;
create policy "taps own insert" on taps for insert with check (user_id = auth.uid());
drop policy if exists "taps own delete" on taps;
create policy "taps own delete" on taps for delete using (user_id = auth.uid());

-- Hangouts are private to members.
drop policy if exists "hangouts members" on hangouts;
create policy "hangouts members" on hangouts for select using (is_member(id));
drop policy if exists "members visible" on hangout_members;
create policy "members visible" on hangout_members for select using (is_member(hangout_id));
drop policy if exists "slots visible" on time_slots;
create policy "slots visible" on time_slots for select using (is_member(hangout_id));
drop policy if exists "votes visible" on slot_votes;
create policy "votes visible" on slot_votes for select
  using (exists (select 1 from time_slots t where t.id = slot_id and is_member(t.hangout_id)));
drop policy if exists "messages visible" on messages;
create policy "messages visible" on messages for select using (is_member(hangout_id));
drop policy if exists "messages insert" on messages;
create policy "messages insert" on messages for insert with check (user_id = auth.uid() and is_member(hangout_id));

-- Shares: you create your own. Reading a share page goes through get_share(),
-- so the tables themselves stay closed and guests learn nothing else.
drop policy if exists "shares mine" on shares;
create policy "shares mine" on shares for select using (by_id = auth.uid());
drop policy if exists "shares insert" on shares;
create policy "shares insert" on shares for insert with check (by_id = auth.uid());
drop policy if exists "guest interests mine" on guest_interests;
create policy "guest interests mine" on guest_interests for select
  using (exists (select 1 from shares s where s.id = share_id and s.by_id = auth.uid()));

-- The two calls a signed-out guest on a share link is allowed to make.
grant execute on function get_share(text) to anon, authenticated;
grant execute on function add_guest_interest(text, text) to anon, authenticated;

-- Realtime
do $$ begin
  alter publication supabase_realtime add table taps, hangouts, hangout_members, time_slots, slot_votes, messages, plans, friend_requests, friendships, guest_interests;
exception when duplicate_object then null; end $$;

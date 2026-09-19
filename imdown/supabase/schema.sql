-- imdown schema. Run in the Supabase SQL editor on a fresh project.
-- The core rule (3 taps in a friend circle => a hangout) lives here as a trigger,
-- so every client sees the same result.

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{2,20}$'),
  display_name text not null,
  emoji text not null default '🙂',
  created_at timestamptz not null default now()
);

-- Friendships are stored both directions by add_friend().
create table if not exists friendships (
  user_id uuid not null references profiles(id) on delete cascade,
  friend_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  steps text[] not null default '{}',
  area text not null default '',
  vibe text[] not null default '{}',
  cost smallint not null default 1 check (cost between 1 and 3),
  hours numeric not null default 2,
  best_time text not null default '',
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

create type hangout_status as enum ('voting', 'confirmed', 'done', 'flopped');

create table if not exists hangouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  status hangout_status not null default 'voting',
  chosen_slot_id uuid,
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

-- ---------- helpers ----------
create or replace function is_friend(a uuid, b uuid) returns boolean
language sql stable as $$
  select exists (select 1 from friendships where user_id = a and friend_id = b)
$$;

create or replace function is_member(h uuid) returns boolean
language sql stable as $$
  select exists (select 1 from hangout_members where hangout_id = h and user_id = auth.uid())
$$;

-- Adds a friendship both ways. Invite-link acceptance is v2; for now anyone can add anyone by username.
create or replace function add_friend(p_friend uuid) returns void
language plpgsql security definer as $$
begin
  if p_friend = auth.uid() then raise exception 'cannot friend yourself'; end if;
  insert into friendships(user_id, friend_id) values (auth.uid(), p_friend) on conflict do nothing;
  insert into friendships(user_id, friend_id) values (p_friend, auth.uid()) on conflict do nothing;
end $$;

-- ---------- the core rule ----------
-- After a tap: collect taps on this plan from the tapper + their friends.
-- If >= 3 and none of them is already in an open hangout for this plan, create one with 3 proposed slots.
create or replace function on_tap() returns trigger
language plpgsql security definer as $$
declare
  circle uuid[];
  tappers uuid[];
  h uuid;
  fri timestamptz; sat timestamptz; sun timestamptz;
begin
  select array_agg(friend_id) into circle from friendships where user_id = new.user_id;
  circle := array_append(coalesce(circle, '{}'), new.user_id);

  select array_agg(user_id) into tappers
  from taps where plan_id = new.plan_id and user_id = any(circle);

  if coalesce(array_length(tappers, 1), 0) < 3 then return new; end if;

  if exists (
    select 1 from hangouts hg
    join hangout_members hm on hm.hangout_id = hg.id
    where hg.plan_id = new.plan_id and hg.status in ('voting', 'confirmed') and hm.user_id = any(tappers)
  ) then return new; end if;

  insert into hangouts(plan_id) values (new.plan_id) returning id into h;
  insert into hangout_members(hangout_id, user_id) select h, unnest(tappers);

  -- next Fri 7pm, Sat 2pm, Sun 6pm in UTC; the client renders local time.
  fri := date_trunc('week', now()) + interval '4 days 19 hours';  if fri <= now() then fri := fri + interval '7 days'; end if;
  sat := date_trunc('week', now()) + interval '5 days 14 hours';  if sat <= now() then sat := sat + interval '7 days'; end if;
  sun := date_trunc('week', now()) + interval '6 days 18 hours';  if sun <= now() then sun := sun + interval '7 days'; end if;
  insert into time_slots(hangout_id, label, at) values
    (h, 'Fri 7:00 PM', fri), (h, 'Sat 2:00 PM', sat), (h, 'Sun 6:00 PM', sun);
  return new;
end $$;

drop trigger if exists taps_after_insert on taps;
create trigger taps_after_insert after insert on taps for each row execute function on_tap();

-- Vote for a slot. Majority of members confirms the hangout.
create or replace function vote_time(p_hangout uuid, p_slot uuid) returns void
language plpgsql security definer as $$
declare
  n_members int; winner uuid;
begin
  if not is_member(p_hangout) then raise exception 'not a member'; end if;
  delete from slot_votes sv using time_slots ts
    where sv.slot_id = ts.id and ts.hangout_id = p_hangout and sv.user_id = auth.uid();
  insert into slot_votes(slot_id, user_id) values (p_slot, auth.uid());

  select count(*) into n_members from hangout_members where hangout_id = p_hangout;
  select ts.id into winner
  from time_slots ts join slot_votes sv on sv.slot_id = ts.id
  where ts.hangout_id = p_hangout
  group by ts.id having count(*) >= (n_members / 2) + 1
  limit 1;

  if winner is not null then
    update hangouts set status = 'confirmed', chosen_slot_id = winner where id = p_hangout and status = 'voting';
  end if;
end $$;

-- Did it happen? Yes feeds the loop: proof count up, plan resurfaces, taps cleared for the members.
create or replace function mark_outcome(p_hangout uuid, p_happened boolean) returns void
language plpgsql security definer as $$
declare
  pid uuid;
begin
  if not is_member(p_hangout) then raise exception 'not a member'; end if;
  select plan_id into pid from hangouts where id = p_hangout;
  if p_happened then
    update plans set done_count = done_count + 1, last_done_at = now() where id = pid;
    update hangouts set status = 'done' where id = p_hangout;
  else
    update hangouts set status = 'flopped' where id = p_hangout;
  end if;
  delete from taps where plan_id = pid and user_id in (select user_id from hangout_members where hangout_id = p_hangout);
end $$;

-- Auto-create a profile row on signup (username from metadata or email prefix).
create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into profiles(id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g')),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  ) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------- row level security ----------
alter table profiles enable row level security;
alter table friendships enable row level security;
alter table plans enable row level security;
alter table taps enable row level security;
alter table hangouts enable row level security;
alter table hangout_members enable row level security;
alter table time_slots enable row level security;
alter table slot_votes enable row level security;
alter table messages enable row level security;

create policy "profiles readable" on profiles for select using (true);
create policy "own profile" on profiles for update using (id = auth.uid());

create policy "my friendships" on friendships for select using (user_id = auth.uid());

-- Plans are the shared idea layer: everyone reads, signed-in users add.
create policy "plans readable" on plans for select using (true);
create policy "plans insert" on plans for insert with check (created_by = auth.uid());

-- Taps: you see your own and your friends'.
create policy "taps visible" on taps for select using (user_id = auth.uid() or is_friend(auth.uid(), user_id));
create policy "taps own insert" on taps for insert with check (user_id = auth.uid());
create policy "taps own delete" on taps for delete using (user_id = auth.uid());

-- Hangouts are private to members.
create policy "hangouts members" on hangouts for select using (is_member(id));
create policy "members visible" on hangout_members for select using (is_member(hangout_id));
create policy "slots visible" on time_slots for select using (is_member(hangout_id));
create policy "votes visible" on slot_votes for select using (exists (select 1 from time_slots t where t.id = slot_id and is_member(t.hangout_id)));
create policy "messages visible" on messages for select using (is_member(hangout_id));
create policy "messages insert" on messages for insert with check (user_id = auth.uid() and is_member(hangout_id));

-- Realtime
alter publication supabase_realtime add table taps, hangouts, hangout_members, time_slots, slot_votes, messages, plans;

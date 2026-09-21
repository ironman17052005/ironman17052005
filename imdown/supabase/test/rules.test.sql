-- Does the database actually enforce what the README claims?
--
-- Every rule here is one a second client, or a curl request with the anon key,
-- must not be able to route around. The app cannot be trusted to enforce them
-- because the app is not the only thing that can talk to the database.
--
-- Two roles are used on purpose. Actions run as `authenticated` with a user id
-- set, exactly as a signed-in browser would. Structural checks run as the owner,
-- because row level security would otherwise hide the very rows being counted.
--
-- Run with scripts/test-db.sh. Any failure aborts with a readable message.

\set ON_ERROR_STOP on
\o /dev/null

set client_min_messages to notice;

-- Supabase grants these by default; RLS is what actually restricts access.
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

\set alice '''11111111-1111-1111-1111-111111111111'''
\set bob   '''22222222-2222-2222-2222-222222222222'''
\set cara  '''33333333-3333-3333-3333-333333333333'''
\set dave  '''44444444-4444-4444-4444-444444444444'''
\set nobody '''99999999-9999-9999-9999-999999999999'''
\set plan  '''aaaaaaaa-0000-0000-0000-000000000001'''

-- Inserting into auth.users is what signup does, so this also tests the trigger.
insert into auth.users (id, email) values
  (:alice, 'alice@uh.edu'), (:bob, 'bob@uh.edu'), (:cara, 'cara@uh.edu'),
  (:dave, 'dave@uh.edu'), (:nobody, 'stranger@uh.edu');

\qecho ''
\qecho 'seed data'
select assert((select count(*) from plans) = 15, 'seed.sql fills the feed so a fresh deployment is not empty');
select assert((select count(*) from plans where created_by is not null) = 0, 'seeded plans belong to nobody, so nobody can edit or delete them');

\qecho ''
\qecho 'signup'
select assert((select count(*) from profiles) = 5, 'a profile is created for each new user');
select assert((select username from profiles where id = :alice) = 'alice', 'the username comes from the email');
select assert((select threshold from profiles where id = :alice) = 2, 'two people is the default threshold');

insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'alice@gmail.com');
select assert((select count(distinct username) from profiles) = 6, 'a colliding username gets a suffix instead of failing signup');
delete from auth.users where id = '55555555-5555-5555-5555-555555555555';

-- ---------------------------------------------------------------- friendship

\qecho ''
\qecho 'friendship needs consent'

set role authenticated;
select set_user(:alice);
select send_friend_request(:bob);
reset role;
select assert((select count(*) from friendships) = 0, 'a request on its own does not make you friends');
select assert((select count(*) from friend_requests) = 1, 'the request is recorded');

set role authenticated;
select set_user(:alice);
select refuses(
  format('select accept_friend_request(%L)', (select id from friend_requests limit 1)),
  'the sender cannot accept their own request');

select set_user(:bob);
select accept_friend_request((select id from friend_requests limit 1));
reset role;
select assert((select count(*) from friendships) = 2, 'accepting records the friendship in both directions');
select assert(is_friend(:alice, :bob) and is_friend(:bob, :alice), 'both sides now see each other as friends');
select assert((select count(*) from friend_requests) = 0, 'the request is cleared once accepted');

-- Cara asks Alice; Alice asks back. That should settle it, not deadlock.
set role authenticated;
select set_user(:cara);
select send_friend_request(:alice);
select set_user(:alice);
select send_friend_request(:cara);
reset role;
select assert(is_friend(:alice, :cara), 'asking someone who already asked you accepts theirs');

set role authenticated;
select set_user(:dave);
select send_friend_request(:alice);
select set_user(:alice);
select accept_friend_request((select id from friend_requests limit 1));
reset role;

-- ---------------------------------------------------------------- the tap rule

\qecho ''
\qecho 'the threshold proposes a hangout, it never confirms one'

insert into plans (id, title, steps, cost_per_person, hours, best_time, done_count)
values (:plan, 'Hot pot then karaoke', array['Hot pot', 'Karaoke'], 35, 4, 'Fri/Sat night', 14);

set role authenticated;
select set_user(:alice);
insert into taps (plan_id, user_id) values (:plan, :alice);
reset role;
select assert((select count(*) from hangouts) = 0, 'one person being down proposes nothing');

set role authenticated;
select set_user(:bob);
insert into taps (plan_id, user_id) values (:plan, :bob);
reset role;
select assert((select count(*) from hangouts) = 1, 'two friends down on the same plan proposes a hangout');
select assert((select status from hangouts limit 1) = 'voting', 'it is proposed, not confirmed');
select assert((select chosen_slot_id from hangouts limit 1) is null, 'no time is chosen yet');
select assert((select count(*) from time_slots) = 3, 'three times are offered');
select assert((select count(*) from hangout_members) = 2, 'both people who were down are members');

set role authenticated;
select set_user(:nobody);
insert into taps (plan_id, user_id) values (:plan, :nobody);
reset role;
select assert((select count(*) from hangouts) = 1, 'a stranger being down does not start a rival hangout');
select assert((select count(*) from hangout_members) = 2, 'and does not join theirs');

\qecho ''
\qecho 'a late friend joins rather than being stranded'
set role authenticated;
select set_user(:cara);
insert into taps (plan_id, user_id) values (:plan, :cara);
reset role;
select assert((select count(*) from hangouts) = 1, 'no second hangout is created for the same plan');
select assert((select count(*) from hangout_members) = 3, 'the late friend is added to the open one');

set role authenticated;
select set_user(:nobody);
select refuses(
  format('select join_hangout(%L)', (select id from hangouts limit 1)),
  'someone with no friend in it cannot join');
reset role;

-- ---------------------------------------------------------------- voting

\qecho ''
\qecho 'a majority confirms the time'
set role authenticated;
select set_user(:alice);
select vote_time((select id from hangouts limit 1), (select id from time_slots order by at limit 1));
reset role;
select assert((select status from hangouts limit 1) = 'voting', 'one vote out of three is not a majority');

set role authenticated;
select set_user(:bob);
select vote_time((select id from hangouts limit 1), (select id from time_slots order by at limit 1));
reset role;
select assert((select status from hangouts limit 1) = 'confirmed', 'two of three confirms it');
select assert(
  (select chosen_slot_id from hangouts limit 1) = (select id from time_slots order by at limit 1),
  'the winning slot is the one recorded');

set role authenticated;
select set_user(:alice);
select vote_time((select id from hangouts limit 1), (select id from time_slots order by at offset 1 limit 1));
reset role;
select assert((select count(*) from slot_votes where user_id = :alice) = 1, 'changing your vote moves it rather than adding one');

set role authenticated;
select set_user(:alice);
select refuses(
  format('select vote_time(%L, %L)', (select id from hangouts limit 1), gen_random_uuid()),
  'a slot that belongs to no hangout is refused');
select set_user(:nobody);
select refuses(
  format('select vote_time(%L, %L)', (select id from hangouts limit 1), (select id from time_slots limit 1)),
  'a non-member cannot vote');
reset role;

-- ---------------------------------------------------------------- settling

\qecho ''
\qecho 'an outing settles exactly once'
set role authenticated;
select set_user(:alice);
select mark_outcome((select id from hangouts limit 1), true);
reset role;
select assert((select done_count from plans where id = :plan) = 15, 'the proof count goes up by one');
select assert((select status from hangouts limit 1) = 'done', 'the hangout is closed');
select assert(
  (select count(*) from taps where plan_id = :plan and user_id in (:alice, :bob, :cara)) = 0,
  'members taps are cleared so the plan can happen again');

set role authenticated;
select set_user(:alice);
select mark_outcome((select id from hangouts limit 1), true);
reset role;
select assert((select done_count from plans where id = :plan) = 15, 'pressing it twice does not inflate the count');

set role authenticated;
select set_user(:bob);
select mark_outcome((select id from hangouts limit 1), true);
reset role;
select assert((select done_count from plans where id = :plan) = 15, 'a second member pressing it does not inflate it either');

set role authenticated;
select set_user(:nobody);
select refuses(
  format('select mark_outcome(%L, true)', (select id from hangouts limit 1)),
  'a non-member cannot settle a hangout');

select set_user(:alice);
select add_recap((select id from hangouts limit 1), 'KBox let us stay past close', null);
reset role;
select assert((select recap_note from hangouts limit 1) = 'KBox let us stay past close', 'a member can add the recap');

-- ---------------------------------------------------------------- privacy

\qecho ''
\qecho 'row level security'

-- This is the one that used to fail outright. A policy on hangout_members that
-- called a function reading hangout_members recursed, and every read raised.
set role authenticated;
select set_user(:alice);
select assert((select count(*) from hangouts) = 1, 'a member reads their hangout without the policy recursing');
select assert((select count(*) from hangout_members) = 3, 'and can see who else is in it');
select assert((select count(*) from time_slots) = 3, 'and the times');

select set_user(:nobody);
select assert((select count(*) from hangouts) = 0, 'a non-member sees no hangouts at all');
select assert((select count(*) from hangout_members) = 0, 'no membership rows');
select assert((select count(*) from time_slots) = 0, 'no times');
select assert((select count(*) from slot_votes) = 0, 'no votes');
select assert((select count(*) from messages) = 0, 'no messages');

reset role;
insert into plans (id, title, steps) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Night market crawl', array['Market']);

set role authenticated;
select set_user(:dave);
insert into taps (plan_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000002', :dave);

select set_user(:alice);
select assert((select count(*) from taps where user_id = :dave) = 1, 'you see what your friend is down for');
select set_user(:bob);
select assert((select count(*) from taps where user_id = :dave) = 0, 'you do not see what a stranger is down for');

select set_user(:alice);
insert into saves (plan_id, user_id) values (:plan, :alice);
select assert((select count(*) from saves) = 1, 'you can see your own saves');
select set_user(:bob);
select assert((select count(*) from saves) = 0, 'a friend cannot see what you saved');
reset role;

-- ---------------------------------------------------------------- owning a card

\qecho ''
\qecho 'only the author changes a card'
set role authenticated;
select set_user(:alice);
insert into plans (id, title, steps, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000003', 'Alice plan', array['x'], :alice);

select set_user(:bob);
update plans set title = 'Bob was here' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
reset role;
select assert(
  (select title from plans where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'Alice plan',
  'someone else cannot edit your card');

set role authenticated;
select set_user(:alice);
update plans set title = 'Alice plan, fixed' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
reset role;
select assert(
  (select title from plans where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'Alice plan, fixed',
  'the author can fix a typo');

set role authenticated;
select set_user(:bob);
select assert(delete_plan('aaaaaaaa-0000-0000-0000-000000000003') is not null, 'someone else cannot delete your card');
select set_user(:alice);
select assert(delete_plan('aaaaaaaa-0000-0000-0000-000000000003') is null, 'the author can delete their own');
reset role;
select assert((select count(*) from plans where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 0, 'and it is gone');

-- Deleting out from under people who are mid-plan is refused.
set role authenticated;
select set_user(:alice);
insert into plans (id, title, steps, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000004', 'Busy plan', array['x'], :alice);
insert into taps (plan_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000004', :alice);
select set_user(:bob);
insert into taps (plan_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000004', :bob);
select set_user(:alice);
select assert(delete_plan('aaaaaaaa-0000-0000-0000-000000000004') is not null, 'a card people are mid-plan on cannot be deleted');
reset role;

-- ---------------------------------------------------------------- share links

\qecho ''
\qecho 'a share link exposes the outing and nothing else'
set role authenticated;
select set_user(:alice);
insert into shares (id, plan_id, by_id) values ('sharetoken1', :plan, :alice);
reset role;

-- A guest has no session at all.
set role anon;
select set_user(null);
select assert((select count(*) from get_share('sharetoken1')) = 1, 'a signed-out guest can open the link');
select assert((select title from get_share('sharetoken1')) = 'Hot pot then karaoke', 'and sees the outing');
select assert(add_guest_interest('sharetoken1', 'Tuan') is null, 'and can say they are in with just a first name');
select assert(add_guest_interest('sharetoken1', 'tuan') is not null, 'the same name twice is refused');
select assert(add_guest_interest('sharetoken1', 'x') is not null, 'a one letter name is refused');
select assert(add_guest_interest('nosuchtoken', 'Tuan') is not null, 'an invalid link is refused');
select assert((select array_length(names, 1) from get_share('sharetoken1')) = 1, 'the names on the link come back');

select assert((select count(*) from taps) = 0, 'a guest reads no taps');
select assert((select count(*) from hangouts) = 0, 'a guest reads no hangouts');
select assert((select count(*) from guest_interests) = 0, 'a guest cannot enumerate who is in on other links');
select assert((select count(*) from shares) = 0, 'a guest cannot enumerate links');
select assert((select count(*) from plans) > 0, 'plans stay readable, they are the shared idea layer');

-- The sharer, and only the sharer, sees the interest their link collected.
reset role;
set role authenticated;
select set_user(:alice);
select assert((select count(*) from guest_interests) = 1, 'the sharer sees interest from their own link');
select set_user(:bob);
select assert((select count(*) from guest_interests) = 0, 'nobody else sees it');
reset role;

\qecho ''
\qecho 'every database rule holds'
\o

# i'm down

Plans your friends actually did. Tap one you like. When three friends are down for the same plan, it becomes a real hangout with times to vote on and a group chat. After you go, mark it done and the plan goes back into the feed for everyone else, proven one more time.

The idea is shared with strangers. The hangout stays between friends.

## The loop

1. **Feed** shows plan cards: title, steps, area, cost, hours, best time, and how many groups have actually done it.
2. **I'm down** is visible to your friends only.
3. **Three taps** inside a friend circle locks it: a hangout is created with three proposed times.
4. **Majority vote** on a time confirms it. Group chat lives on the card.
5. **We did it** bumps the plan's proof count and resurfaces it. **Flopped** just closes it.
6. **+ plan** posts a plan you did, which becomes a card for everyone.

## Run it

```bash
npm install
npm run dev
```

With no env vars it runs in **demo mode**: everything is in localStorage and your five friends are simulated. They tap and vote on their own so you can watch the loop work.

## Go live with Supabase

1. Create a Supabase project.
2. Paste `supabase/schema.sql` into the SQL editor and run it. It creates the tables, row-level security, and the trigger that enforces the three-tap rule server-side.
3. Enable email magic links under Authentication.
4. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. `npm run dev`. Sign in with your school email. Add friends by `@username` or share the invite link from the Friends tab.

Deploy anywhere static (Vercel works with zero config).

## What to measure

One number matters: taps that become a hangout that actually happened. Everything else is noise.

## Not built yet

- Calendar sync for smarter time proposals
- Push notifications when a friend taps or a plan locks
- Invite-link acceptance flow (right now anyone can add anyone by username)
- Multi-city feeds; everything is Houston-seeded

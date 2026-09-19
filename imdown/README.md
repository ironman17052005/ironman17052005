# i'm down

A feed of outings real friend groups actually did. Tap one you like. When enough
of your friends are down for the same plan, it **proposes** a hangout with times
to vote on. Once a time wins, you go. Afterwards you mark it done and post a
one-line recap, and the plan goes back into the feed, proven one more time.

The idea is public. Who is going out tonight is not.

## The loop

1. **Feed** shows the whole outing: steps, dollars per person, hours, best time,
   and the tips you only learn by having gone. A card is meant to be worth copying.
2. **I'm down** is visible to your friends only.
3. Enough of your circle down on the same plan **proposes** a hangout. Interest is
   not availability, so nothing is booked until a majority votes for one of three times.
4. **Group chat** lives on the hangout card.
5. **We did it** bumps the plan's proof count. **Flopped** just closes it. Either
   way it can only be settled once.
6. **Recap** adds a line and a photo, with a **Copy this plan** button attached.
7. **Send to a group chat** makes a public link. Friends tap "I'm down" from it
   with a first name. No account, no download.

## Run it

```bash
npm install
npm run dev     # app
npm test        # the rules: 16 unit tests
npm run lint

# the whole loop in a real browser, against a build
npm run build && npm run preview &
npx playwright install chromium   # once
npm run e2e
```

The browser test walks the path that matters: a plan card shows the full outing,
a friend request needs accepting, a tap proposes rather than confirms, a majority
vote locks a time, an outing settles once, a recap posts, and a signed-out guest
joins from a share link without seeing anything private. Set `CHROMIUM_PATH` if
you want it to use a browser you already have.

With no env vars it runs in **demo mode**: localStorage, plus simulated people who
are *deliberately unreliable*. Roughly half reply, some never vote, some never
accept your friend request. Getting people to commit is the actual problem this
product has to solve, so the demo does not pretend it is free. Press **nudge** to
force a reply when you want to walk the whole loop.

## Go live with Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor. It is safe to re-run.
3. Enable email magic links under Authentication.
4. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. `npm run dev`, then sign in. Add friends by `@username`; they must accept.

Deploy anywhere static. Vercel works with zero config.

### What the database enforces, not the app

A second client, or a curl request with the anon key, cannot route around these:

- **Friendship needs consent.** A request sits in `friend_requests` until the
  recipient accepts. Nobody lands in your circle, or sees what you are down for,
  without agreeing.
- **The threshold proposes, it never confirms.** The tap trigger creates a hangout
  in `voting`. Only `vote_time` can move it to `confirmed`, and only on a majority.
- **A late friend joins.** Tapping a plan that already has an open hangout adds you
  to it instead of starting a rival one or stranding you.
- **An outing settles once.** `mark_outcome` only acts on a live hangout, so
  pressing "we did it" twice, or two members pressing it, cannot inflate a plan's
  proof count.
- **Hangouts are members-only.** Row-level security scopes hangouts, votes and
  messages to members. The membership check runs as `security definer` so the
  policy does not recurse into the table it is protecting.
- **A share link leaks nothing else.** The public page is one function returning
  the outing and the first names on that link. Guests cannot read any table.

## What to measure in the first test

Three to five real friend groups. One number: **taps that became a hangout that
actually happened**. Then: did they come back the next week without you reminding
them, and would anyone pay to keep it.

## Known gaps

- Live mode has never been run against a real Supabase project. Do that with three
  separate accounts before trusting it.
- No push notifications, so a proposal can sit unseen.
- No calendar sync. Three fixed time choices, on purpose.
- Guest interest on a share link is not linked to an account if that guest later signs up.
- Seed plans are all Houston.
- Recap photos are stored inline, which will not scale past a prototype.

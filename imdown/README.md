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
   Photos are shrunk to 1280px before they are stored, since a raw phone photo
   would fill the browser's storage on its own.
7. **Send to a group chat** makes a public link. Friends tap "I'm down" from it
   with a first name. No account, no download.

## Finding something to do

- **Search** across the title, area, vibe, steps and tips. Prefixes count, so
  typing "karao" already finds the karaoke plan, and every word has to match
  something, so "karaoke bowling" returns nothing rather than both.
- **Filters**: tonight, saved, under $10/$20/$40, under 2h/3h/5h, and by vibe.
- **Sorts**: for you, most done, recent, cheapest, quickest. A typed query
  overrides the sort, because searching means you want the closest match first.
- **Save** a plan with the star. Saves are private; nobody sees your bookmarks.
- **Make it mine** opens the post form prefilled with someone else's outing. It
  does not clone the card, so the feed does not fill with near-identical copies
  nobody edited. A duplicate title is flagged before you post.
- **Edit and delete** your own plans. Deleting asks first, and refuses while people
  are mid-plan on that card.
- **🎲** answers "just tell me what to do" with one plan that suits today, drawn
  from the top of your feed so rolling again gives a different answer.

### How "for you" is ordered

Friends wanting to go beats everything, because it is the only signal that turns
into an actual night out. The rest breaks ties:

| Signal | Weight | Why |
| --- | --- | --- |
| Friends down | up to +9 | The only thing that becomes a real plan. Capped at three so a pile-on cannot bury everything else. |
| You are down | +1.5 | Keeps your own picks near the top. |
| Matches your taste | up to +1.2 | Vibes you keep tapping, saving or doing. |
| Proven | +0.8 × log | Many groups did it. Logged so a 200× plan does not dominate forever. |
| Recently proven | up to +1.0 | Decays over about a month. |
| Fits your budget | up to +0.5 | Median of what you usually tap. Neutral until it knows you. |
| Suits today | +0.4 | Saturday should not lead with a weeknight plan. |
| You just did it | down to −2.5 | Fades over three weeks so the feed keeps moving. |

## Run it

```bash
npm install
npm run dev     # app
npm test        # the rules, search and ranking: 47 unit tests
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
- **Saves are private.** Only you can read your own bookmarks, friends included.
- **Only the author edits a card.** An update policy and `delete_plan` both check
  the creator, and deleting is refused while a hangout for it is still open.

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
- Recap photos are stored inline as data URLs. Shrunk first, but still not a
  substitute for object storage.
- Every write refetches the whole snapshot in live mode. Fine at prototype scale,
  wasteful past it.

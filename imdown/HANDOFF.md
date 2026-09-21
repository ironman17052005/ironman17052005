# Handoff: everything from the Claude Code session

Paste or upload this to pick up where we left off. Written 19 Sep 2026.

---

## 1. Who I am

- Clark. Second-year CS student at the University of Houston. GitHub: `ironman17052005`.
- Prior projects, from my own profile: **Homefolk** (AI assistant platform, multi-agent
  orchestration, tool execution, real-time streaming), **YouStory** (a permanent
  Wikipedia-style page for anyone, Stripe, SSR, full-text search), **CapCrash** (2D
  physics game with a custom engine, collision detection, rigid body dynamics).
- Stack I actually use: TypeScript, React, Node, Supabase, Postgres, Tailwind, Vite,
  Vercel, Stripe, Java.

## 2. How I want to be worked with

- **Be concise.** Long answers lose me. I said this several times. Short paragraphs,
  tables over prose, no walls of text.
- **Simple English.** English is not my first language. Plain words, short sentences.
- **I vibe code.** I want to build fast, not read essays about architecture.
- **Do not go poking through my GitHub** to "understand me" unless I ask.
- **Consumer products, not developer tools.** Dev infrastructure does not excite me.
- **Original means problem first.** Find a real problem and a real buyer, then the
  solution. Do not hand me a solution hunting for a problem.
- **Do not state guesses as facts.** Say when something is unverified.
- I cross-check answers against ChatGPT and expect both to be honest about mistakes.

## 3. Startup ideas considered and rejected

Rejected because a competitor already owns it, or because it was a dev tool:

| Idea | Why it died |
| --- | --- |
| Time-travel debugger for AI agents | Developer tool. I want consumer. |
| Voice agent that makes phone calls | Bland, Retell, Vapi, Synthflow, ElevenLabs, Telnyx all do it. FCC rules make unsolicited outbound calls illegal. |
| Gym form-correction app | FORMFIT, AI Smart Coach, Formology, Gymscore already exist. |
| AI bandmate that jams with you | Bander, Moises AI Studio, BandM8. |
| Photo of a broken part → 3D printed replacement | Repliform does exactly this. |
| Smart chicken coop camera | The Smart Coop, sold at Tractor Supply. |
| Translated video calls in your own voice | AI Call, Owll Translator. |
| Group decision / restaurant picker | ForkYes, Daccord, Hangrily, DinnerWhere, and more. |
| "Find one more player" for pickup sports | Pickup, Baller, Fullcourt, PlayMate. |
| QR tags telling an object's story ("Tiny Museum") | QR Lasting Legacy, Memorygram, Storii. I liked this one but it is taken and it is a gift business, not a unicorn. |
| Family Mail (explain immigrant parents' mail) | Genuinely unserved and I nearly built it, but ChatGPT and Google Translate camera already do the core job, and I did not believe people would switch. |

Still open if I ever want them: agent-versus-agent negotiation, smart glasses apps
(Meta opened the Ray-Ban Display SDK in May 2026 and there is no app store yet),
a board-game referee camera.

## 4. The idea I chose: "i'm down"

**One line.** A feed of outings that real friend groups actually did. Tap one. When
enough of your friends are down for the same plan, it proposes a hangout with times
to vote on. After you go, you mark it done and it goes back in the feed, proven once
more.

**The gap.** Everything else is venues (Yelp, TikTok), public events with strangers
(Meetup, Pie, Timeleft), or invite tools once you already have a plan (Partiful,
Howbout). Nobody has a feed of *proven, completed* outings where interest is visible
only to your friends. Closest are What Now? and Hangs, which do voting but have no
self-sustaining content loop.

**Why it could work.** Content makes itself. Every hangout that happens becomes a
card for everyone else.

**The two hard parts.**
1. Cold start. A feed with five plans is dead. Needs one campus with a few hundred users.
2. Interest must become a real plan. Likes that never turn into a night out are worthless.

**The honest risk.** Every "what should we do tonight" app dies because people scroll
and never go. The bet is that the friend layer plus proven plans fixes that.

**The only metric that matters in a first test:** taps that became a hangout that
actually happened. Then: did the group come back next week without me nudging them,
and would anyone pay.

## 5. What is built

A working prototype called `imdown`, in the `imdown/` folder of my profile repo,
on branch `claude/startup-project-ideas-aqb67o`.

**Stack.** Vite 8, React 19, TypeScript, Tailwind v4, Supabase (optional), vitest,
Playwright. Mobile-first, dark, single page, roughly 260 KB JS.

**Two modes.**
- **Demo mode** (no env vars): everything in localStorage, other people simulated.
  The simulation is deliberately unreliable: about half of friends reply, some never
  vote, some never accept a friend request. Commitment is the hard part so the demo
  must not pretend it is free. A "nudge" button forces a reply when you want to walk
  the whole loop.
- **Live mode**: Supabase with magic-link auth. The schema, triggers and policies
  are tested against a real Postgres by `npm run test:db` (69 checks), but the app
  itself has never been pointed at an actual Supabase project. Magic-link auth and
  realtime are the untested parts.

**The loop.**
1. Feed card shows the whole outing: steps, dollars per person, hours, best time, and
   tips you only learn by having gone. Meant to be worth copying.
2. "I'm down" is visible to friends only.
3. Enough of your circle down on the same plan **proposes** a hangout. Threshold
   defaults to 2 and is a per-person setting. Proposing is not confirming.
4. Majority vote on one of three times confirms it. Group chat on the card.
5. "We did it" bumps the proof count. "Flopped" closes it. Can only be settled once.
6. Recap: one line plus a photo, with a "copy this plan" button.
7. "Send to a group chat" makes a public link. A signed-out friend taps "I'm down"
   with just a first name. No account, no download.

**Search and discovery.**
- Search across title, area, vibe, steps, tips. Prefixes count, and every word must
  match something, so "karaoke bowling" returns nothing rather than both.
- Filters: tonight, saved, under $10/$20/$40, under 2h/3h/5h, by vibe.
- Sorts: for you, most done, recent, cheapest, quickest. A typed query overrides sort.
- Star to save. Saves are private.
- A dice button picks one plan that suits today, from the top of the feed.

**The "for you" ranking.** Friends being down dominates, capped at three so a pile-on
cannot bury everything. Ties break on taste learned from what you tap, proof count on
a log scale, decay since last proven, fit with your usual spend, and whether it suits
today. A plan the group just did is pushed down and recovers over three weeks.

**Files.**
```
imdown/
  src/types.ts                 domain types + the Store interface
  src/data/logic.ts            all the rules: tap resolution, voting, ranking, search
  src/data/logic.test.ts       47 unit tests
  src/data/demoStore.ts        localStorage + simulated people
  src/data/supabaseStore.ts    live mode
  src/data/shareApi.ts         the signed-out share page data path
  src/data/useStore.ts         picks a store, surfaces errors
  src/lib/coalesce.ts          collapses overlapping refreshes into one round trip
  src/lib/image.ts             shrinks a recap photo before it is stored
  public/sw.js                 offline shell
  src/components/              PlanCard, HangoutCard, FilterBar, FriendsPanel,
                               AddPlanSheet, ShareSheet, SharePage, Auth
  supabase/schema.sql          tables, RLS, triggers, RPCs
  supabase/seed.sql            the fifteen plans, so a fresh deploy is not empty
  supabase/test/               a Supabase stand-in plus 69 rule checks
  e2e/flow.mjs                 browser test of the whole loop
```

**Commands.** `npm run dev`, `npm test` (54 unit tests), `npm run test:db` (69
database checks against a throwaway Postgres), `npm run lint`, `npm run build`,
`npm run e2e` (needs the preview server running).

## 6. Rules enforced in Postgres, not the UI

A code review found five ways the first version could mislead someone. All five were
real and all five were fixed in the database so another client cannot route around them.

1. **Friendship needs consent.** Requests sit in `friend_requests` until accepted.
   Originally anyone could add anyone and immediately see their taps.
2. **RLS recursion fixed.** The hangout-members policy called a function that read
   the same table, so every hangout read recursed and failed. The membership check now
   runs `security definer`.
3. **No silent failures.** Every database call checks its error and the store is
   wrapped so a rejected write surfaces instead of looking like success.
4. **An outing settles once.** "We did it" pressed twice, or by two members, cannot
   inflate a plan's proof count.
5. **Late friends join.** Tapping a plan that already has an open hangout adds you to
   it instead of stranding you.

Plus: hangouts are members-only; a share link exposes only the outing and the first
names on that link; saves are private.

## 7. Known gaps

- **The app has never been pointed at a real Supabase project.** The SQL is tested;
  magic-link auth and realtime are not. Do that with three separate accounts.
- No push notifications, so a proposal can sit unseen.
- No calendar sync. Three fixed time choices, on purpose.
- Guest interest on a share link does not link to an account if the guest signs up later.
- All seed plans are Houston, in both demo mode and `supabase/seed.sql`.
- Recap photos are stored inline as data URLs. Will not scale.

## 8. Where the code lives

Pushed to branch `claude/startup-project-ideas-aqb67o` of
`ironman17052005/ironman17052005`, in the `imdown/` folder. Nothing was merged;
`main` is untouched.

(The push was blocked for a while because the GitHub app connected to the account
was "Claude Design Import", which is read-only. Installing the plain "Claude" app
fixed it.)

## 9. Plugin research (Claude Code)

- **Ponytail** (`DietrichGebert/ponytail`): a skill that makes the agent reuse native
  and stdlib features instead of writing new code. Claims ~54% less code. Low risk,
  worth using.
- **Graphify** (`Graphify-Labs/graphify`): turns a codebase into a queryable knowledge
  graph to avoid re-reading files. Built for 500+ file projects; imdown is ~26 files.
  There is an open issue where users report no token saving. Skip for now.
- **OmniRoute** (`diegosouzapw/OmniRoute`): a gateway routing Claude Code to 350+
  providers. Avoid. It puts your Claude credentials through third-party software and
  is likely against Anthropic's terms. Commenters also report it broken.
- Best from the official marketplace: **Context7** (current library docs),
  **Superpowers** (structured workflow), **typescript-lsp** (Claude sees type errors
  as it edits), **security-guidance**, **frontend-design**. Install with `/plugin` in
  Claude Code.

## 10. What to do next

1. Unblock GitHub and push.
2. Run `supabase/schema.sql` on a real Supabase project and test live mode with three
   separate accounts. This is the biggest untested risk.
3. Recruit three to five real friend groups. Measure taps that became a hangout that
   actually happened, and whether they return without being reminded.
4. Only after that: push notifications, calendar sync, more cities.

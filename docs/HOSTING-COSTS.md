# Hosting costs

What it costs to keep Pana MIA online, and how that changes as the community
grows.

Every figure here is derived from what `wrangler.jsonc` actually deploys and
from vendor list prices read in October 2026, not from generic "what does a
startup spend" benchmarks. Where a number is an estimate rather than a rate
card, it says so.

The headline: **a few tens of dollars a month today, and under $200/month at
200,000 members** — even assuming people use this like a social network rather
than a directory. The reasons that is true are structural and worth
understanding, because two of them are things we could accidentally give away.

---

## The short answer

Assuming social-network behaviour (see [Assumptions](#assumptions)):

| Members | Monthly actives | Daily actives | Cloudflare | Database | **Total/mo** |
| ------- | --------------- | ------------- | ---------- | -------- | ------------ |
| 1,000   | 600             | 180           | $6         | $25      | **~$31**     |
| 10,000  | 6,000           | 1,800         | $7         | $30      | **~$37**     |
| 50,000  | 30,000          | 9,000         | $14        | $75      | **~$89**     |
| 200,000 | 120,000         | 36,000        | $51        | $135     | **~$186**    |
| 500,000 | 300,000         | 90,000        | $124       | $255     | **~$379**    |

Annualised, 200,000 members is roughly **$2,200/year**.

Two things stand out. The bill is not linear in members — it is linear in
_daily actives_, which is a much smaller number. And **the database is 60–70% of
the bill at every tier above 50,000**. Everything else is close to noise.

---

## What we actually run

| Component          | What it does                                                | How it is priced                                             |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| Cloudflare Workers | The whole app — 188 API routes, 134 pages, SSR              | $5/mo min, then $0.30/M requests + $0.02/M CPU-ms            |
| Hyperdrive         | Postgres connection pooling + query cache                   | Included with Workers Paid                                   |
| R2                 | Media: profile images, post attachments, story photos/clips | $0.015/GB-mo, $4.50/M writes, $0.36/M reads, **egress free** |
| Durable Objects    | WebRTC signalling for mentoring video                       | Per-request + per-GB-second, hibernating                     |
| Workers Cache      | Regional tiered cache in front of the Worker                | Billed as requests (see below)                               |
| Cloudflare Email   | Transactional mail                                          | Native, no per-message fee                                   |
| Supabase           | Postgres                                                    | $25/mo plan + compute tier                                   |

Note there is no CDN line, no load balancer line, no object-storage-egress
line, and no video-transcoding line. Their absence is most of the story.

---

## Why it is this cheap

Four structural reasons, in descending order of how much they save us.

### 1. R2 charges nothing for egress

Cloudflare's R2 pricing page states it plainly: "There are no charges for
egress bandwidth for any storage class." Every other major provider meters
this — Azure and AWS both bill roughly $0.08–0.09/GB outbound.

For a photo-and-video product this is _the_ line item. Serving a terabyte of
story media costs us $0. On Azure the same terabyte is roughly $85/month, and
it grows every time the community gets more active. **This is the single
biggest reason our cost curve stays flat where a conventional stack's curve
bends upward.**

### 2. We transcode on the member's device, not on a server

`lib/media/transcode.ts` runs ffmpeg compiled to WebAssembly in the browser.
Video becomes H.264/AAC MP4 and audio becomes Opus _before_ it is ever
uploaded.

Most social platforms pay for this server-side — Cloudflare Stream, Mux, and
AWS MediaConvert all bill per minute of video processed, and at story volumes
that becomes one of the largest lines on the invoice. We pay nothing for it.
The cost is borne as battery and CPU on the phone that recorded the clip,
which is also where the raw file already is.

### 3. Stories are ephemeral, so media storage reaches a steady state

A story is a row in `social_statuses` with `expires_at` set 24 hours out
(`drizzle/0043_social_stories.sql`). The nightly job in
`lib/jobs/purge-expired.ts` deletes expired stories _and_ the R2 objects behind
them.

That means story storage does not accumulate — in the steady state we are
holding roughly one day of stories, not one year. At 200,000 members that is
about 11 GB instead of about 4 TB.

**This saving depends entirely on the purge keeping up. Right now it cannot.
See [Risks](#what-would-change-this-answer).**

### 4. Nothing idles

There are no VMs. Workers bill per request and per millisecond of CPU actually
burned. A quiet Tuesday at 3am costs essentially nothing, whereas a
conventionally-hosted app pays the same hourly rate at 3am as at 8pm.

---

## Where the money actually goes

### The database is the ceiling

At 200,000 members the database is about $135 of a $186 bill. It is also the
one component not covered by Cloudflare's zero-egress economics.

This is why query efficiency is a budget decision, not a micro-optimisation.
The change that cut `auth()` from three Postgres queries to one applies to
every authenticated request in the app — it roughly tripled how far a given
compute tier stretches. Work like that defers a $60/mo compute upgrade.

The Supabase compute ladder is what we are climbing:

| Tier   | RAM                    | Price | Roughly good for   |
| ------ | ---------------------- | ----- | ------------------ |
| Micro  | 1 GB                   | $10   | up to ~10k members |
| Small  | 2 GB                   | $15   | ~25k               |
| Medium | 4 GB                   | $60   | ~50k               |
| Large  | 8 GB, 2 dedicated vCPU | $110  | ~200k              |
| XL     | 16 GB, 4 vCPU          | $210  | ~500k              |

### Workers Cache makes static assets billable

Normally "requests to static assets are free and unlimited." But Cloudflare's
pricing page carries an important footnote: when Workers Caching is enabled,
requests served from the Worker's cache are billed at the same per-request
rate, **and that includes static assets**.

We have `cache.enabled: true` in `wrangler.jsonc`. So our request count
includes images, CSS, and JS, not just page loads. The figures above account
for this.

It is still clearly worth it — CPU time is only billed on a cache miss, and CPU
is the more expensive half — but it means the request line grows with page
weight. Shipping fewer, larger assets is mildly cheaper than many small ones.

### Stories are read-heavy, and reads are the cheap direction

Each story view writes one row to `social_story_views` — an idempotent upsert,
so replays do not inflate it. At 200,000 members that is roughly 10.8 million
upserts a month, which sounds alarming and is not: it is about 4 writes per
second on average. A Large instance absorbs that comfortably.

The story _media_ fetches mostly never reach R2 at all, because public R2
objects are served through Cloudflare's CDN and popular stories cache at the
edge.

---

## What would change this answer

### The story purge saturates at about 11,000 members — this needs fixing

`lib/jobs/purge-expired.ts` sets `DEFAULT_STORY_BATCH = 200`, and
`wrangler.jsonc` runs it on `"10 4 * * *"` — once a day. So the system can
delete **200 expired stories per day, total.**

The batch limit is deliberate and the reasoning in the file is sound: each
story costs an R2 round trip, the job runs inside a Worker with a wall-clock
budget, and a bounded run that drains a backlog over several nights beats an
unbounded one that times out and drains nothing.

But the ceiling is fixed while story creation scales with the community. If
roughly one in ten daily actives posts a story a day, the purge keeps up only
to about **2,000 daily actives — somewhere around 11,000 members.** Past that
point expired stories and their R2 objects accumulate permanently:

| Members | Stories/day | Purged/day | Accumulating |
| ------- | ----------- | ---------- | ------------ |
| 10,000  | 180         | 180        | —            |
| 50,000  | 900         | 200        | 700/day      |
| 200,000 | 3,600       | 200        | 3,400/day    |

At 200,000 members that is about 1.24 million undeleted stories a year. The
media alone is roughly 3.7 TB of R2 we are paying to store and are not using —
about $56/month and climbing indefinitely — plus the Postgres rows and,
because `social_story_views` only cascades away when its story is deleted,
roughly 130 million view rows a year that should not exist.

**None of the figures in this document hold past ~11,000 members until this is
addressed.** The fix is not complicated — raise the batch, run the cron more
than once a day, or both — but it should happen before the community grows
into it.

### Engagement is the assumption most likely to be wrong

The table above assumes social-network behaviour. Our own
`docs/SMS-LOGIN-ROADMAP.md` models something much lighter — roughly 1.6 visits
per member per month, people "checking in every few weeks." On that model the
200,000-member figure is closer to $150/month.

The difference between those two worlds is about 7× in traffic and roughly 1.25×
in cost, because the thing that scales hardest — media egress — is free.

### Per-user feeds are the one thing caching cannot help

Hyperdrive caches read queries and Workers Cache serves anonymous traffic, but
a personalised feed is unique per member and therefore uncacheable by
construction. If the product moves toward a feed as its centre of gravity, the
architectural question that matters is whether feeds are computed on read or
fanned out on write — that choice will affect database cost far more than
which company hosts Postgres.

### Backups are currently not configured

The production database is on Supabase's Free plan, which includes **no
automatic backups** and pauses after a week of inactivity. Pro ($25/mo) adds
daily backups retained 7 days. This is a data-loss exposure, not a performance
one, and it is the strongest single argument for the $25.

---

## Nonprofit programs

| Program                        | What it gives                                                     | Verdict                                                                  |
| ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Cloudflare Project Galileo** | Free Business plan (~$200/mo value); Workers available on request | **Apply.** Eligibility is explicitly "organizations supporting the arts" |
| **Twilio.org**                 | Nonprofit SMS rates                                               | Already modelled in the SMS roadmap: $30k/yr → $1,650/yr                 |
| **Microsoft for Nonprofits**   | $2,000/yr Azure credit + M365 grant                               | Take the M365 grant. See below on Azure                                  |
| **Google for Nonprofits**      | Ad Grants, Workspace                                              | Worth it for reach, not hosting                                          |
| **GitHub for Nonprofits**      | Free Team plan                                                    | Small, free, easy                                                        |
| Supabase / Neon / Crunchy      | —                                                                 | None publish nonprofit pricing. Worth asking; do not plan around it      |

All of these require 501(c)(3) documentation. If Pana MIA is fiscally sponsored
rather than independently incorporated, check each program individually —
some accept a sponsor's determination letter and some do not.

### Why we are not moving to Azure for the credits

The $2,000/year Azure credit is real and works out to $167/month, which looks
like it would cover the entire bill. We are not taking it, for three reasons.

**Moving the whole app is a rewrite, not a migration.** Durable Objects have no
Azure equivalent, and R2, Hyperdrive, Workers Cache, and Cloudflare Email would
all need replacing — across 188 route handlers and 134 pages.

**Moving only the database trades like for like.** Azure Database for
PostgreSQL is a first-party service, so credits do apply. But $167/month buys
roughly what Supabase charges for comparable specs, while adding metered egress
on our most latency-sensitive path and handing us backup and pooling
configuration we currently get managed.

**A capped annual credit is the wrong instrument for a growing product.** It is
fixed at $2,000 and must be re-qualified yearly. It covers us best precisely
when we need it least, and the moment we outgrow it we are on Azure retail,
which is more expensive than what we pay now.

**Better use of those credits:** off-site backup archive — which we currently do
not have at all — plus batch jobs and analytics. Real value, no entanglement
with the request path.

---

## Assumptions

Stated explicitly so they can be argued with.

| Assumption                             | Value                            | Basis                                                                 |
| -------------------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| Monthly actives                        | 60% of registered members        | Typical for an active community platform; estimate                    |
| Daily actives                          | 30% of monthly actives           | Mid-range for social; Instagram is higher, a directory much lower     |
| Sessions per daily active              | 2                                | Estimate                                                              |
| Requests per session                   | 40 total, 15 invoking the Worker | Estimate; the rest are cached assets                                  |
| CPU per dynamic request                | 20 ms                            | Estimate for SSR with database reads                                  |
| Share of daily actives posting a story | 10%, one per day                 | Estimate; consumption greatly exceeds creation on every story product |
| Story media size                       | 3 MB after client-side transcode | Estimate                                                              |
| Permanent media at 200k                | ~200 GB                          | Estimate                                                              |

The rate cards (Workers, R2, Supabase, Azure) are vendor list prices read in
October 2026 and are not estimates. The usage assumptions above are, and they
are where this model is most likely to be wrong. Real numbers from the first
few thousand members would tighten this considerably — particularly the share
of members who post stories, which drives both R2 and the purge ceiling.

---

## Summary for the panas

Running Pana MIA costs about **$30/month today** and would cost about
**$190/month at 200,000 members** — roughly $2,200 a year at a scale most
community platforms never reach.

That is unusually cheap, and it is not an accident. It comes from three
specific engineering choices: storing media somewhere that does not charge to
serve it, transcoding video on the member's phone instead of on a server, and
running code that bills per request rather than per hour.

The main cost risk is not traffic. It is the story cleanup job, which currently
has a fixed ceiling that the community would outgrow at around 11,000 members.
That is a known, fixable problem and should be dealt with before it matters.

# Events Roadmap

Community events on pana.social — in-person and online gatherings hosted by the
Pana MIA network.

## Design principle: Postgres-authoritative, Nostr as an outbound mirror

pana.social is the accessible front for most users. Unlike the `external/nostrlab`
reference (where Nostr is the source of truth and RSVPs are signed Nostr events),
this module **inverts** that:

- **Postgres is authoritative.** Events and RSVPs live in Postgres.
- **No Nostr key — and no account — is required to participate.** Anyone can
  RSVP with name + email, confirmed via a magic link.
- **Publishing mirrors the event OUTBOUND to Nostr** as a NIP-52 kind-31923
  time-based calendar event, signed by the relay key, exactly as Articles mirror
  to kind-30023. This is the same crosspost path:
  `lib/relay/crosspost-client.ts` → `external/nosflare/src/event-crosspost.ts`
  (registered in `relay-worker.ts` at `/internal/events/crosspost`).

So Pana events render natively in other Nostr calendar clients (Flockstr,
Coracle, …) while remaining fully usable by people who have never heard of Nostr.

**Guiding principle for what to crosspost:** Crosspost public, static artifacts.
Don't Nostr-ify private, interactive infrastructure unless it's end-to-end
encrypted. (Articles and events qualify; live, PII-bearing flows like mentoring
do not — see `panamia.club/docs/MENTORING-ROADMAP.md`.)

## v1 (this release)

### Data model (`lib/schema/index.ts`, migration `drizzle/0011_add_events.sql`)

- **`events`** — slug, title, description, cover image, host (profile), venue
  (nullable for online), start/end, timezone, status, visibility, mode
  (online/offline/hybrid), attendee cap + count, iCal UID, tags, `nostr_event_id`.
- **`event_attendees`** — one row per (event, attendee). `profile_id` is set for
  logged-in users, null for anonymous email RSVPs. `email_verified_at` gates
  counting: only verified, `going` RSVPs count toward capacity.
- Reuses the existing **`venues`** table (capacity enforced at
  `min(event.attendee_cap, venue.fire_capacity)`) and **`verification_tokens`**
  for the magic-link token.

### Flows

- **Create / edit / publish** — host-only. Publish calls `crosspostEvent`; the
  `nostr_event_id` is recorded only when the home relay (`NOSTR_HOME_RELAY`)
  accepts the kind-31923 event. Crosspost failure never blocks local publish.
- **RSVP** — logged-in users count immediately (auth already verified their
  email). Anonymous users submit name + email, the RSVP is held pending, and a
  magic link is emailed (`event.rsvp_confirm` template); it counts only after the
  link is clicked.
- **Attendee management** — host-only roster with confirmed / pending counts.
- **Calendar export** — `GET /api/events/[slug]/calendar.ics` (RFC 5545 VEVENT).

### UI (`app/e`, `components/events`)

`/e` (list), `/e/new`, `/e/[slug]` (detail + RSVP), `/e/[slug]/edit`,
`/e/[slug]/manage`, `/e/[slug]/manage/attendees`. Reachable from the header
navigation (Events). UX mirrors nostrlab's `EventForm` / `RsvpButtons` minus the
Nostr-signer.

## Unlisted events (Postgres-only)

The `visibility` enum is `public | unlisted`. **Unlisted** means: excluded from
the `/e` listing and never crossposted to Nostr, but still reachable by direct
link — it is **not access-controlled**. (It was briefly named `private`; renamed
in `drizzle/0013` because "private" overstated it.)

Why unlisted, not private: NIP-52 calendar events (kind 31922/31923) are
**addressable, public, world-readable events by spec** — there is no protocol
concept of a private calendar event, private RSVP, or private guest list. (The
only Nostr-native privacy primitives are general ones — NIP-44 encryption,
NIP-59 gift wrap, NIP-29 relay groups — none of which NIP-52 profiles onto
calendars; the `external/nostrlab` reference only approximates "private RSVP" by
NIP-04-encrypting the note to the organizer and keeping it off relays.) So the
only thing we can guarantee today is keeping an event **off Nostr**:

- **Publish** (`app/api/events/[slug]/publish`): a `visibility = 'unlisted'`
  event is **never crossposted**. No kind-31923 is created, `nostr_event_id`
  stays null, and the publish response reports `crosspost.status = 'unlisted'`.
- **Public → unlisted later** (`PATCH /api/events/[slug]`): if the event was
  already crossposted (`nostr_event_id` set), the PATCH **retracts** it from the
  relay via `removeRelayEvents` and clears `nostr_event_id` (fail-open; the
  response carries `retraction: 'removed' | 'failed'`).
- **Listing**: `getUpcomingEvents` already excludes non-public events from `/e`.

Caveats: the web detail page still serves a published unlisted event to anyone
with the direct URL (secret-link semantics). Retraction hard-deletes from our
home relay's storage; copies already fanned out to external mirrors
(`NOSTR_ARTICLE_CROSSPOST_LIST`) are not chased down (no NIP-09 deletion is
emitted yet), and clients may keep cached copies. Flipping back to public does
not auto-recrosspost (publish is one-shot for published events).

## True private (invitation-only) events — future phase

Deferred. Unlisted is "hidden but link-shareable"; a real private event must be
**access-controlled** to a defined audience. Planned model:

- **Invite scope**: either **invite all followers** (every account that follows
  the host) or **individual users** (a hand-picked list).
- **Enforcement**: gate the detail page (`app/e/[slug]/page.tsx`) and the RSVP
  endpoints so a private event requires host-or-invitee; exclude it from all
  public surfaces.
- **Invitation model**: an invites table (or pre-seeded `event_attendees` with an
  `invited` status) + a guest-list visibility policy (host-only vs.
  invitees-can-see-each-other).
- **Nostr**: stays off-relay like unlisted, unless we later adopt NIP-59 gift
  wrap to deliver the listing/RSVPs to specific invitee pubkeys.

## Phase 2 — inbound RSVP sync (implemented)

Changing an RSVP in a Nostr client now updates the RSVP on pana.social, using
the **same inbound pattern as NIP-56 abuse reports**: when the relay
(`external/nosflare`) ingests a kind-31925 RSVP that targets one of our own
kind-31923 listings, its Durable Object fires a detached, fail-open
`forwardRsvpToPana()` over the `env.PANAMIA` Service Binding to
`POST /api/internal/relay/rsvp`, which upserts `event_attendees`.

- **Gating** — the relay only forwards RSVPs whose `a` coordinate is
  `31923:<relayPubkey>:<slug>` (a relay-signed Pana event).
- **Identity** — the signer pubkey maps to a member via `profiles.nostr_pubkey`
  (the genuine two-way case: a member who enrolled their key updates their RSVP
  on Nostr → their existing pana RSVP row updates in place). Otherwise the
  attendee is keyed by `nostr_pubkey` with no email; the event signature is the
  verification, so it counts without a magic link.
- **Status map** — accepted→going, tentative/waitlist→maybe, declined→not_going.
- **Latest-wins** — `nostr_rsvp_at` ignores stale (out-of-order) RSVPs;
  `attendee_count` is recomputed from rows so it never drifts.
- **No loop** — pana does not publish RSVPs to Nostr (outbound RSVP mirror is
  still deferred), so ingest cannot echo. Migration `drizzle/0012`.
- **Known limitation** — external (non-member) pubkeys must have relay write
  access for their RSVP to reach us; RSVPs blocked by the membership gate never
  arrive. The primary case (enrolled members) passes the gate.

## v2 backlog (deferred — placeholder comments in code)

- **RSVP → Nostr (kind 31925) outbound.** Mirror RSVPs the other direction —
  relay-signed, or NIP-07 self-signed for enrolled users. Attendee PII is never
  published. (Inbound is done; see Phase 2 above.) Adding this needs a
  provenance guard so an outbound mirror isn't re-ingested as inbound.
- **Inbound event listings (kind 31923).** Today only RSVPs sync inbound;
  ingesting externally-authored event listings is future work.
- **NIP-09 deletion on event delete/cancel** for crossposted events (also for
  chasing down mirror copies when a public event is made unlisted).
- **True private (invitation-only) events** — see the dedicated section above.
- **Co-organizers** (`event_organizers`), **photos** (`event_photos`,
  `/e/[slug]/photos`), **organizer notes** (`event_notes`).
- **Cloudflare streaming** (`stream_status`, `cf_stream_*`) for live events.
- Richer fields deferred from panamia.club: `age_restriction`, `photo_policy`,
  `dresscode`, `panamia_co_organizer`, `tos_accepted_at`.

## Verification (run on Cloudflare after deploy)

1. The hand-written `drizzle/0011_add_events.sql` + `_journal.json` entry apply
   during the deploy/migrate step.
2. Each page renders (200, content visible): `/e`, `/e/new`, `/e/[slug]`,
   `/e/[slug]/edit`, `/e/[slug]/manage/attendees`.
3. The header navigation shows **Events**, keyboard-reachable, routing to `/e`.
4. Create → edit → publish an event; publish returns a `nostrEventId` and the
   kind-31923 event is queryable on `wss://relay.pana.social` by its `d` (slug)
   tag; the detail page shows "· on Nostr".
5. Anonymous RSVP: name + email → magic link → click → attendee verified, count
   increments, capacity blocks at `min(cap, fire_capacity)`.
6. Logged-in RSVP counts immediately; withdraw decrements.
7. `GET /api/events/[slug]/calendar.ics` opens in a calendar app.

## Related

- `lib/event.ts` — slug, publish check, queries, iCal serializer.
- `lib/relay/crosspost-client.ts` — `crosspostEvent` (outbound).
- `external/nosflare/src/event-crosspost.ts` — relay-side kind-31923 builder.
- `external/nosflare/src/relay-worker.ts` — `forwardRsvpToPana` (inbound) +
  `external/nosflare/src/durable-object.ts` kind-31925 dispatch.
- `app/api/internal/relay/rsvp/route.ts` — inbound RSVP ingest (mirrors the
  abuse-report ingest at `app/api/internal/relay/report`).
- `external/nostrlab` — NIP-52 reference implementation (Nostr-authoritative).
- [DATABASE-DESIGN.md](./DATABASE-DESIGN.md), [PANA-MODULES.md](./PANA-MODULES.md).

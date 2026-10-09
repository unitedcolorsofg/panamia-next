-- Migration: 0057_connector_events
-- Purpose: Give the Connectors programme somewhere to keep the gatherings its
--          members are supposed to turn up to.
--
--          0055 named this as the gap it was leaving open:
--
--            "The thing this deliberately does NOT model is programme-wide
--             content -- events, open asks, birthdays. [...] Until they have a
--             real home they are simply not shown to members, rather than
--             shown as fiction."
--
--          HQ has been honest and empty ever since: the events panel was
--          deleted rather than left rendering invented ones. This is the real
--          home, so the panel can come back meaning something.
--
--          ## Why not rows in the existing events table
--
--          There is an events table already (0047 and friends) and reusing it
--          was the first thing considered. It does not fit, in three ways that
--          each produce fiction rather than mere awkwardness:
--
--            Recurrence. The programme's gatherings are "Thursdays @ 5p" and
--            "first Saturday of the month". events has starts_at and ends_at
--            and no recurrence model at all, so a weekly connector meetup
--            would have to be either one row that is wrong six days a week or
--            fifty-two rows somebody maintains by hand.
--
--            Required identity. events demands a unique slug and a unique
--            ical_uid, because every row there is a public page that can be
--            subscribed to. An internal pod huddle has neither and would be
--            given invented ones.
--
--            Required host. Exactly one of host_profile_id / host_group_id
--            must be set, enforced by the events_single_host CHECK. The
--            programme is not a profile and is not a social group; the host
--            would end up being whichever admin happened to type the form,
--            and deleting that admin is blocked while they "host" upcoming
--            events they never hosted.
--
--          Add a venue FK over free-text places like "Bryant Park, north
--          side" and reusing the public table means fabricating a slug, a
--          calendar identity, a host and a venue for every entry. A small
--          table that says only what is true is the cheaper and more honest
--          thing.
--
--          These are also not the same object to a reader. events rows are
--          public listings the directory shows to strangers; these are
--          internal programme logistics shown only to accepted members. If
--          connector gatherings should ever also be public events, the right
--          move is to let one point at the other, not to have been one all
--          along.
--
--          ## Why a real timestamp and a separate cadence
--
--          The mock stored when as free text, which reads well and sorts not
--          at all -- and an "upcoming" panel is nothing but a sort and a
--          filter. starts_at is the next occurrence as an actual instant, so
--          the panel can order it and drop it once it is past. cadence
--          describes the repeat in words rather than expanding it into rows,
--          because a programme this size genuinely does know "it is weekly,
--          the next one is Thursday" and does not need a recurrence engine to
--          say so.
--
--          Rolling the next occurrence forward is a thing a human does from
--          the console today. That is a deliberate stopping point: a job that
--          advances them automatically is easy to add and impossible to
--          supervise, and an event that silently reschedules itself after
--          everyone stopped coming is worse than one that visibly lapsed.
--
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: profiles, users. Pod ids come from lib/connectors/model.ts.
-- Data Migration: None. Every event in the fixtures was invented, and the
--                 fixture roster they referenced is not real either. Importing
--                 them would put fabricated gatherings on members' dashboards
--                 with real dates attached, which is the exact failure 0055
--                 existed to stop.
--
-- Rollback:
--   DROP TABLE IF EXISTS "connector_events";
-- =============================================================================

CREATE TABLE IF NOT EXISTS "connector_events" (
  "id" text PRIMARY KEY,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "title" text NOT NULL,
  -- Optional. The title carries most gatherings; this is for the one that
  -- needs "bring your own table" said somewhere.
  "details" text,
  -- The next (or only) occurrence. Real instant so "upcoming" can be a sort.
  "starts_at" timestamp with time zone NOT NULL,
  -- The human phrasing, kept alongside the timestamp rather than instead of
  -- it. starts_at answers "which comes first"; this answers "what do I tell
  -- someone", and the two are not the same string. "4:40-8:30p" is a range
  -- and there is no ends_at; "Thursdays @ 5p" says a time-of-day that holds
  -- for every occurrence, not just the next one. Dropping it would mean
  -- re-deriving a worse version of a sentence an organiser already wrote.
  -- NULL renders as just the date.
  "when_text" text,
  -- Free text, no venue FK. See the header: these are "Bryant Park, north
  -- side" and "the back room at Lot 11", not rows in the venues table, and
  -- creating venue records for them would pollute a table the public
  -- directory reads.
  "location" text,
  "cadence" text NOT NULL DEFAULT 'once',
  -- NULL means no cap, which is the default and the common case. A number is
  -- a genuine ceiling the programme has in mind, not a target.
  "volunteers_needed" integer,
  -- NULL means programme-wide. Scoped by pod rather than by house because
  -- pods are geographic -- a Broward connector cannot drive to a Miami
  -- huddle on a Tuesday -- whereas houses describe the kind of work somebody
  -- does, and a gathering is open to whoever turns up regardless of that.
  "pod" text,
  -- Who is running it. Free text and nullable rather than a profile FK: the
  -- lead is often somebody who is not a connector and sometimes not a member
  -- at all -- a partner organisation's staffer, a venue manager -- and an FK
  -- would make those unrecordable.
  --
  -- A name only. No phone or email: the programme reaches its leads through
  -- channels it already has, and a contact column here would quietly make
  -- this a store of third parties' contact details, which is a heavier thing
  -- to own than a calendar.
  "lead" text,
  -- Kept for accountability. SET NULL rather than CASCADE: an admin leaving
  -- must not delete the programme's calendar on their way out.
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  -- Soft cancel. A cancelled gathering has to stay visible for a while --
  -- people who were coming need to find out it is off, and deleting the row
  -- tells them nothing at all.
  "cancelled_at" timestamp with time zone,
  CONSTRAINT "connector_events_cadence_check"
    CHECK ("cadence" IN ('once', 'weekly', 'weekends', 'monthly')),
  CONSTRAINT "connector_events_pod_check"
    CHECK ("pod" IS NULL OR "pod" IN ('miami', 'broward', 'palmBeach')),
  CONSTRAINT "connector_events_volunteers_check"
    CHECK ("volunteers_needed" IS NULL OR "volunteers_needed" > 0)
);

COMMENT ON TABLE "connector_events" IS
  'Gatherings run by the Community Connectors programme. Internal: shown on /connectors/hq to accepted members, created from the admin console. Deliberately not rows in the public events table -- see drizzle/0057 for the recurrence, slug, host and venue reasons.';

COMMENT ON COLUMN "connector_events"."cadence" IS
  'How often this repeats. starts_at is the next occurrence; the repeat is described rather than expanded into rows.';

-- The only read path that matters: the next few, soonest first, optionally
-- narrowed to a pod. Cancelled rows are included on purpose -- they are still
-- upcoming and people still need to be told.
CREATE INDEX IF NOT EXISTS "connector_events_starts_at_idx"
  ON "connector_events" ("starts_at");

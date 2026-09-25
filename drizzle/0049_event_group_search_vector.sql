-- Migration: 0044_event_group_search_vector
-- Purpose: Give events and groups the same quality of text matching the
--          business directory has had since 0040, so the scoped search pages
--          behave the same way whichever scope you are in.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: events, relay_groups, and everything 0040 established --
--               specifically the pana_unaccent() helper and the unaccent
--               extension behind it. 0040 must have run. This migration
--               deliberately does NOT redefine pana_unaccent: see the
--               staleness warning in that file, which applies to the vectors
--               added here too.
-- Data Migration: None required. Both columns are GENERATED ALWAYS ... STORED,
--                 so Postgres fills every existing row during the ALTER and
--                 maintains them on write. No backfill, no trigger to drift.
--
-- Note: ALTER TABLE ... ADD COLUMN ... GENERATED rewrites the table and holds
--       ACCESS EXCLUSIVE for the duration. events and relay_groups are both
--       tiny today, so this is a non-event, but it still belongs in a quiet
--       window on principle.
--
-- Rollback:
--   DROP INDEX IF EXISTS "relay_groups_search_vector_idx";
--   DROP INDEX IF EXISTS "events_search_vector_idx";
--   ALTER TABLE "relay_groups" DROP COLUMN IF EXISTS "search_vector";
--   ALTER TABLE "events" DROP COLUMN IF EXISTS "search_vector";
--   DROP FUNCTION IF EXISTS pana_text_array(text[]);
--   -- Leave pana_unaccent and the unaccent extension alone; 0040 owns them
--   -- and profiles.search_vector still depends on both.
--
-- =============================================================================
-- Rationale
-- =============================================================================
--
--          This is a match-quality change, not a performance change, and the
--          distinction matters because lib/server/suggest.ts currently says
--          the opposite in so many words:
--
--            "The events and groups tables have no such index, and deliberately
--             get none here: both are small enough that a sequential scan of a
--             name column costs less than the write amplification an index
--             would add. Revisit if either grows by an order of magnitude."
--
--          That reasoning was correct and is still correct. Neither table has
--          grown by an order of magnitude, and if speed were the only
--          consideration this migration would not exist. What changed is the
--          job the query has to do.
--
--          Those ILIKE predicates were written for a typeahead: ten rows, a
--          partial word, a person who is still typing. Substring matching is a
--          good fit for that and needs no index at this size. But pressing
--          Enter now lands on a full scoped results page, and people type
--          differently once they expect a page of results -- they type phrases.
--          Under ILIKE '%term%' the whole query is one opaque string, so
--          "farmers market saturday" matches an event titled "Saturday Farmers
--          Market" not at all, while the business scope handles the same shape
--          of query without blinking because 0040 gave it a tsvector. Same
--          search bar, same keystrokes, silently different rules depending on
--          which scope you happened to be in. That is the bug.
--
--          So events and groups get the treatment 0040 gave profiles, for the
--          reasons 0040 gave: word order stops being mandatory, words get
--          stemmed so "markets" finds "market", and accents fold so a group
--          called Reunión is reachable by typing Reunion. The GIN index is a
--          consequence of using a tsvector rather than the point of it.
--
--          Weights follow the same ladder, collapsed to the fields these
--          tables actually have:
--
--            A  title / name
--            B  tags                      (events only)
--            D  description / about
--
--          There is no C tier here on purpose. On profiles, C is category and
--          city -- facet-ish fields that sit between a tagline and prose. An
--          event's equivalent would be its venue's city, which lives across a
--          join and therefore cannot appear in a generated column at all.
--          Filtering events by place stays a job for the venue join in the
--          query, not the vector. Leaving C empty is better than promoting
--          description into a tier it hasn't earned.
--
--          As in 0040, prose is indexed under both english and spanish, and
--          titles and names additionally under simple so a proper noun always
--          matches itself rather than whatever the stemmer makes of it.
--
--          One new helper, for the same reason 0040 needed two: array_to_string
--          is STABLE, not IMMUTABLE, so it cannot appear in a generated column.
--          It is marked STABLE because it accepts anyarray and the element
--          type's output function may not be immutable -- timestamptz output
--          depends on the TimeZone setting, for instance. For text[] no such
--          hazard exists: textout is immutable, and the wrapper below is typed
--          to text[] precisely so that the IMMUTABLE declaration is honest
--          rather than merely accepted. Do not widen it to anyarray.
--
--          The staleness warning from 0040 applies here in full. Both columns
--          are STORED, so they are computed on write and never recomputed on
--          read, and CREATE OR REPLACE on pana_unaccent or pana_text_array is
--          permitted even while these columns depend on them -- old rows keep
--          old vectors, new writes use new logic, and nothing warns you.
--          Changing either helper later means forcing a rewrite:
--
--            UPDATE "events" SET "id" = "id";
--            UPDATE "relay_groups" SET "group_id" = "group_id";
-- =============================================================================

-- Flatten a text[] to whitespace-joined text. Exists only to make the events
-- vector legal; see the header for why array_to_string cannot be used directly
-- and why narrowing the signature to text[] is what makes IMMUTABLE truthful.
-- Returns '' rather than NULL so the concatenation below can never null out a
-- whole vector.
CREATE OR REPLACE FUNCTION pana_text_array(arr text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT coalesce(array_to_string(arr, ' '), '') $$;
--> statement-breakpoint

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', pana_unaccent(coalesce("title", ''))), 'A') ||
    setweight(to_tsvector('spanish', pana_unaccent(coalesce("title", ''))), 'A') ||
    setweight(to_tsvector('simple',  pana_unaccent(coalesce("title", ''))), 'A') ||
    setweight(to_tsvector('english', pana_unaccent(pana_text_array("tags"))), 'B') ||
    setweight(to_tsvector('simple',  pana_unaccent(pana_text_array("tags"))), 'B') ||
    setweight(to_tsvector('english', pana_unaccent(coalesce("description", ''))), 'D') ||
    setweight(to_tsvector('spanish', pana_unaccent(coalesce("description", ''))), 'D')
  ) STORED;
--> statement-breakpoint

ALTER TABLE "relay_groups" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', pana_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('spanish', pana_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('simple',  pana_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('english', pana_unaccent(coalesce("about", ''))), 'D') ||
    setweight(to_tsvector('spanish', pana_unaccent(coalesce("about", ''))), 'D')
  ) STORED;
--> statement-breakpoint

-- GIN for the same reason 0040 chose it on profiles: both tables are read far
-- more often than they are written, and GIN answers @@ faster than GiST at the
-- cost of slower writes.
CREATE INDEX IF NOT EXISTS "events_search_vector_idx"
  ON "events" USING GIN ("search_vector");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "relay_groups_search_vector_idx"
  ON "relay_groups" USING GIN ("search_vector");

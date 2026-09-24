-- Migration: 0044_group_search_vector
-- Purpose: Make groups findable by name, topic and summary.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: social_actors and social_groups from 0043, plus pana_unaccent()
--               and pana_jsonb_flags() from 0040. Both helpers are IMMUTABLE
--               and are reused verbatim here rather than redefined -- see the
--               staleness warning below for why that matters.
-- Data Migration: None. Both columns are GENERATED ALWAYS ... STORED, so
--                 Postgres populates every existing row during the ALTER and
--                 keeps them in step on every write afterwards. No backfill,
--                 and no trigger that can drift out of sync.
--
-- Note: ALTER TABLE ... ADD COLUMN ... GENERATED rewrites the table and holds
--       ACCESS EXCLUSIVE for the duration. social_actors is small today and
--       this is a non-event, but it grows with federation -- every remote
--       actor this instance has ever seen gets a row -- so the cost of this
--       migration only ever goes up. Running it now is deliberate.
--
-- Rollback:
--   DROP INDEX IF EXISTS "social_actors_name_trgm_idx";
--   DROP INDEX IF EXISTS "social_groups_search_vector_idx";
--   DROP INDEX IF EXISTS "social_actors_search_vector_idx";
--   ALTER TABLE "social_groups" DROP COLUMN IF EXISTS "search_vector";
--   ALTER TABLE "social_actors" DROP COLUMN IF EXISTS "search_vector";
--   -- Leave pana_unaccent/pana_jsonb_flags and the extensions in place;
--   -- profiles search (0040, 0041) still depends on all of them.
--
-- =============================================================================
-- Rationale
-- =============================================================================
--
--          Group search needs three fields, and they do not live in one table.
--          0043 put a group's name and summary on social_actors, because a
--          group IS an ActivityPub actor and those are the actor's own fields,
--          while topics -- the part that is specific to being a group -- went
--          on social_groups. That split is correct and is not being undone
--          here.
--
--          A GENERATED column can only read its own row, so one vector
--          covering all three fields is not possible without denormalising a
--          copy of the name onto social_groups. That was considered and
--          rejected: a second copy of a group's name is a second thing to keep
--          in step on rename, and when it drifts the symptom is "search finds
--          the old name" with nothing logged anywhere. Instead each table gets
--          a generated vector over the fields it actually owns:
--
--            social_actors.search_vector   A  name
--                                          C  summary
--            social_groups.search_vector   B  topics
--
--          which preserves the intended name > topics > summary ordering, and
--          keeps both vectors impossible to desynchronise.
--
--          The tradeoff to understand before tuning ranking: setweight only
--          orders terms WITHIN a single tsvector. Across two vectors the A/B/C
--          labels above are not directly comparable, because ts_rank
--          normalises per vector. The query layer therefore ranks with a
--          weighted sum of two ts_rank calls and tunes the multiplier by hand.
--          That is the honest cost of not denormalising, and it is a knob
--          rather than a bug -- but a reader who assumes the weights compose
--          across the join will tune the wrong thing.
--
--          Indexing ALL actors rather than only type = 'Group' is deliberate.
--          A partial index would need the query to repeat the whole weighted
--          expression verbatim to be used at all, and a full vector means
--          people search gets the same index for free when it is built. The
--          cost is a tsvector on remote actor rows nobody searches; a name and
--          a short summary is a cheap vector, and it is bounded by how much of
--          the fediverse this instance has met.
--
--          Group rules are intentionally NOT indexed. They are prose shown in
--          order on the group page, not facets, and matching a group because
--          somebody typed a phrase that appears in rule 4 is a worse result
--          than no result.
--
--          Staleness, same as 0040 and worth repeating because Postgres will
--          not warn you: these columns are STORED, computed on write and never
--          recomputed on read. CREATE OR REPLACE on pana_unaccent or
--          pana_jsonb_flags is permitted while a generated column depends on
--          it, and existing rows keep their old vectors while new writes use
--          the new logic -- a silently split corpus that now spans three
--          tables. Changing either helper requires forcing a rewrite of every
--          dependent table, not just replacing the function:
--
--            UPDATE "social_actors" SET "id" = "id";
--            UPDATE "social_groups" SET "id" = "id";
--            UPDATE "profiles"      SET "id" = "id";
-- =============================================================================

-- Name under simple as well as the two stemmers: stemmers mangle proper nouns,
-- and a group must always match its own name typed exactly. Summary is prose,
-- so it gets the stemmers only.
ALTER TABLE "social_actors" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', pana_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('spanish', pana_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('simple',  pana_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('english', pana_unaccent(coalesce("summary", ''))), 'C') ||
    setweight(to_tsvector('spanish', pana_unaccent(coalesce("summary", ''))), 'C')
  ) STORED;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "social_actors_search_vector_idx"
  ON "social_actors" USING GIN ("search_vector");
--> statement-breakpoint

-- topics is a {"topic": true} flag map, so it flattens through the same helper
-- profile categories already use. english as well as simple because topic keys
-- are words a pana types in plural as readily as singular -- "books" has to
-- find a group whose topic key is "book".
ALTER TABLE "social_groups" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', pana_unaccent(pana_jsonb_flags("topics"))), 'B') ||
    setweight(to_tsvector('simple',  pana_unaccent(pana_jsonb_flags("topics"))), 'B')
  ) STORED;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "social_groups_search_vector_idx"
  ON "social_groups" USING GIN ("search_vector");
--> statement-breakpoint

-- Fallback arm only, mirroring 0041: this serves the trigram query that runs
-- when full-text returns nothing at all, so a pana who misspells a group name
-- still finds it. Costs nothing on queries that already work.
--
-- As in 0040 and 0041 the extension schema is resolved rather than assumed,
-- because CREATE EXTENSION IF NOT EXISTS will not relocate an install that
-- already exists elsewhere and managed Postgres (Supabase) conventionally uses
-- an "extensions" schema. An unqualified gin_trgm_ops fails outright.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
DO $do$
DECLARE
  trgm_schema text;
BEGIN
  SELECT n.nspname INTO trgm_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm'
  LIMIT 1;

  IF trgm_schema IS NULL THEN
    RAISE EXCEPTION
      'pg_trgm is not installed. Install it before running 0044.';
  END IF;

  -- Keep this in step with the search_path set in searchGroupRanking().
  IF trgm_schema NOT IN ('public', 'extensions') THEN
    RAISE EXCEPTION
      'pg_trgm is installed in schema "%", but group search only puts '
      '"public, extensions" on search_path. Add "%" to the search_path in '
      'searchGroupRanking() (lib/server/group-search.ts) before deploying this.',
      trgm_schema, trgm_schema;
  END IF;

  -- Must index the same expression the query filters on -- pana_unaccent(name),
  -- not name -- or the index is dead weight and the fallback seq-scans.
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS social_actors_name_trgm_idx '
    'ON social_actors USING GIN (pana_unaccent(name) %I.gin_trgm_ops)',
    trgm_schema
  );
END $do$;

-- Migration: 0041_profile_name_trigram
-- Purpose: Let the directory survive a typo in a business name.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: profiles, pana_unaccent() from 0040, and the pg_trgm
--               extension. As in 0040 the extension's schema is resolved here
--               rather than assumed, because CREATE EXTENSION IF NOT EXISTS
--               will not relocate an install that already exists elsewhere and
--               managed Postgres (Supabase) conventionally uses an
--               "extensions" schema. pg_trgm is the worse of the two to get
--               wrong: an unqualified gin_trgm_ops fails outright with
--               'operator class "gin_trgm_ops" does not exist for access
--               method "gin"', and the word_similarity() function and the %>
--               operator both fail separately at runtime.
-- Data Migration: None. The index is built from existing rows.
--
-- Note: this index only serves the *fallback* arm of directory search, which
--       runs when full-text search returns nothing at all. It is not on the
--       happy path, so it costs nothing on queries that already work.
--
-- Note: the application reaches pg_trgm by putting `public, extensions` on
--       search_path for the duration of that one query (see searchRanking in
--       lib/server/directory.ts). That is an assumption about where the
--       extension lives, so this migration asserts it and fails loudly at
--       deploy time rather than letting the fallback silently 500 in
--       production. Postgres ignores schemas in search_path that do not
--       exist, so the same statement is correct on plain Postgres too.
--
-- Rollback:
--   DROP INDEX IF EXISTS "profiles_name_trgm_idx";
--   -- Leave the extension in place; dropping it is not required to revert.
--   -- DROP EXTENSION IF EXISTS pg_trgm;

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
      'pg_trgm is not installed. Install it before running 0041.';
  END IF;

  -- Keep this in step with the search_path set in searchRanking().
  IF trgm_schema NOT IN ('public', 'extensions') THEN
    RAISE EXCEPTION
      'pg_trgm is installed in schema "%", but directory search only puts '
      '"public, extensions" on search_path. Add "%" to the search_path in '
      'searchRanking() (lib/server/directory.ts) before deploying this.',
      trgm_schema, trgm_schema;
  END IF;

  -- word_similarity()/%> compare the query against the best-matching run of
  -- words inside the name, so this must index the same expression the query
  -- filters on -- pana_unaccent(name), not name -- or the index is dead weight.
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS profiles_name_trgm_idx '
    'ON profiles USING GIN (pana_unaccent(name) %I.gin_trgm_ops)',
    trgm_schema
  );
END $do$;

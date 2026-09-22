-- Migration: 0040_profile_search_vector
-- Purpose: Give the directory a real search index.
--
--          Until now "search" meant loading every active profile into Node and
--          running String.includes() of the whole query against a handful of
--          fields. That is not a search engine and it fails in ways a pana
--          notices immediately: "kitchen bohemian" found nothing while
--          "bohemian kitchen" worked, because the query was one opaque string
--          and word order was mandatory. "foods" found nothing while "food"
--          worked, because nothing was stemmed. A business named Sazon could
--          not be found by typing Sazón, or the reverse.
--
--          This adds a stored tsvector so Postgres does the matching. Weights
--          carry over the product intent the old hand-written score ladder
--          encoded -- a name match beats a tagline match beats something
--          buried in a description -- so ranking stays recognisable while the
--          matching gets dramatically better:
--
--            A  name                      (was 100/80/60)
--            B  five words, tags          (was 40)
--            C  categories, city          (was 30/25)
--            D  details, background       (was 20)
--
--          Every prose field is indexed under both english and spanish. Pana
--          Mia is a bilingual community and a single stemmer would quietly
--          serve half of it worse than the other half. Names and cities are
--          additionally indexed under simple, because stemmers mangle proper
--          nouns and an exact business name must always match itself.
--
--          Two helper functions exist only to make the generated column legal:
--
--          pana_unaccent wraps unaccent(), which is STABLE rather than
--          IMMUTABLE because it depends on a dictionary file and therefore
--          cannot appear in a generated column. Pinning the dictionary with an
--          explicit regdictionary makes the result reproducible, which is the
--          documented workaround. The tradeoff is real and worth stating: if
--          the unaccent dictionary is ever modified, every index built on this
--          function is silently stale and must be REINDEXed. We never modify
--          it.
--
--          pana_jsonb_flags flattens the category-style JSONB columns to text.
--          Those columns hold two shapes -- a {"food": true} map from the
--          listing form and a plain array on rows carried over from MongoDB --
--          and three vocabularies: canonical keys (food), display labels
--          (Food), and free text built from them (Food & Drink). Flattening to
--          text sidesteps all of it, because to_tsvector tokenizes
--          "Food & Drink" into food and drink and every vocabulary becomes
--          searchable without rewriting a single stored row. Normalising the
--          data at rest is still worth doing for exact filter-chip matching,
--          but it is explicitly not a prerequisite for search and is not done
--          here.
-- Ticket: N/A
-- Reversible: Yes
--
-- Dependencies: profiles. Requires the unaccent extension to be installable by
--               the migrating role. On managed Postgres (Supabase) extensions
--               conventionally live in an "extensions" schema rather than
--               public -- if that is the case on the target, the schema
--               qualifiers below must be changed to match, including the
--               regdictionary literal inside pana_unaccent.
-- Data Migration: None required. search_vector is GENERATED ALWAYS ... STORED,
--                 so Postgres populates every existing row during the ALTER and
--                 keeps it in step on every write afterwards. No backfill
--                 script, and no trigger that can drift out of sync.
--
-- Note: ALTER TABLE ... ADD COLUMN ... GENERATED rewrites the table and holds
--       ACCESS EXCLUSIVE for the duration. At the directory's current size this
--       is a non-event, but it should still go out during a quiet window.
--
-- Rollback:
--   DROP INDEX IF EXISTS "profiles_search_vector_idx";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "search_vector";
--   DROP FUNCTION IF EXISTS pana_jsonb_flags(jsonb);
--   DROP FUNCTION IF EXISTS pana_unaccent(text);
--   -- Leave the extension in place; dropping it is not required to revert and
--   -- other work may since depend on it.
--   -- DROP EXTENSION IF EXISTS unaccent;
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint

-- unaccent() is STABLE, so it cannot be used in a generated column or an
-- expression index. Naming the dictionary explicitly makes the call
-- reproducible and lets us declare the wrapper IMMUTABLE. See the header for
-- the REINDEX caveat this buys.
CREATE OR REPLACE FUNCTION pana_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
--> statement-breakpoint

-- Flatten a category-style JSONB column to whitespace-joined text, accepting
-- both shapes found in the wild. Returns '' rather than NULL for anything
-- unexpected so the concatenation below can never null out a whole vector.
CREATE OR REPLACE FUNCTION pana_jsonb_flags(j jsonb) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$
    SELECT coalesce(
      CASE jsonb_typeof(j)
        WHEN 'array' THEN (
          SELECT string_agg(v #>> '{}', ' ') FROM jsonb_array_elements(j) v
        )
        WHEN 'object' THEN (
          SELECT string_agg(k, ' ')
          FROM jsonb_each(j) e(k, val)
          WHERE val = 'true'::jsonb
        )
        ELSE ''
      END,
      ''
    )
  $$;
--> statement-breakpoint

ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', pana_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('spanish', pana_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('simple',  pana_unaccent(coalesce("name", ''))), 'A') ||
    setweight(to_tsvector('english', pana_unaccent(coalesce("descriptions" ->> 'fiveWords', ''))), 'B') ||
    setweight(to_tsvector('spanish', pana_unaccent(coalesce("descriptions" ->> 'fiveWords', ''))), 'B') ||
    setweight(to_tsvector('english', pana_unaccent(coalesce("descriptions" ->> 'tags', ''))), 'B') ||
    setweight(to_tsvector('simple',  pana_unaccent(coalesce("descriptions" ->> 'tags', ''))), 'B') ||
    setweight(to_tsvector('english', pana_unaccent(pana_jsonb_flags("categories"))), 'C') ||
    setweight(to_tsvector('simple',  pana_unaccent(pana_jsonb_flags("categories"))), 'C') ||
    setweight(to_tsvector('simple',  pana_unaccent(coalesce("address_locality", ''))), 'C') ||
    setweight(to_tsvector('english', pana_unaccent(coalesce("descriptions" ->> 'details', ''))), 'D') ||
    setweight(to_tsvector('spanish', pana_unaccent(coalesce("descriptions" ->> 'details', ''))), 'D') ||
    setweight(to_tsvector('english', pana_unaccent(coalesce("descriptions" ->> 'background', ''))), 'D') ||
    setweight(to_tsvector('spanish', pana_unaccent(coalesce("descriptions" ->> 'background', ''))), 'D')
  ) STORED;
--> statement-breakpoint

-- Serves the term arm of the directory search in lib/server/directory.ts.
-- GIN rather than GiST because the directory is read far more often than
-- listings are edited, and GIN answers @@ faster at the cost of slower writes.
CREATE INDEX IF NOT EXISTS "profiles_search_vector_idx"
  ON "profiles" USING GIN ("search_vector");

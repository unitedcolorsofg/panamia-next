# Directory Search — Design & Roadmap

> **STATUS**: The directory search is currently a **substring scan in Node memory**, not a search
> engine. It cannot handle word order, typos, plurals, or accents. This document specifies the
> replacement using native PostgreSQL full-text search and trigram matching.
>
> Every SQL claim below was **prototyped against the dev database** (PostgreSQL 16.10) inside a
> rolled-back transaction. Measured results are quoted inline.

## Table of Contents

- [Overview](#overview)
- [How Search Works Today](#how-search-works-today)
- [Measured Failures](#measured-failures)
- [Why It Is Like This](#why-it-is-like-this)
- [Proposed Design](#proposed-design)
- [Prototype Results](#prototype-results)
- [Roadmap](#roadmap)
- [Migration `0040`](#migration-0040)
- [Application Changes](#application-changes)
- [Risks & Open Questions](#risks--open-questions)

---

## Overview

Panas find businesses through `/directory/search`. The quality of that search is the difference
between the directory feeling like a community resource and feeling broken. Right now a pana who
types `"bohemain kitchen"`, `"kitchen bohemian"`, or `"foods"` gets **zero results** for a business
that exists and is active.

The fix is entirely inside PostgreSQL. No new service, no external index, no Algolia/Elastic bill.
The required extensions are already available on the database — they are simply not enabled.

### Goals

- Word order should not matter (`kitchen bohemian` finds **Bohemian Kitchen**)
- Plurals and word forms should match (`foods` finds **Food & Drink**)
- Typos should still find the business (`bohemain` finds **Bohemian Kitchen**)
- Accents should be optional both ways (`sazon` finds **Sazón**, and vice versa)
- Relevance ranking should keep today's product intent: name beats tagline beats description
- Stop loading every profile into Node memory on every request

### Non-Goals

- Changing any URL parameter, filter chip, sort option, or the map view
- Changing the CDN caching strategy (see [Risks](#risks--open-questions))
- Searching events, articles, or pana social posts — profiles only, for now

---

## How Search Works Today

All of it lives in `lib/server/directory.ts`. There are two hand-rolled stages and the database
does no searching at all.

### Stage 1 — Filter

`getSearch()` calls `db.query.profiles.findMany` with **no `WHERE` clause on the search term**,
pulling every active profile into Node, then loops over them doing a case-insensitive
`String.includes()` of the **entire query string** against:

| Field                  | Source               |
| ---------------------- | -------------------- |
| `name`                 | column               |
| `fiveWords`            | `descriptions` JSONB |
| `tags`                 | `descriptions` JSONB |
| `details`              | `descriptions` JSONB |
| `background`           | `descriptions` JSONB |
| category keys + labels | `categories` JSONB   |

There is no tokenizing, no stemming, and no fuzzy matching. The query is one opaque string.

### Stage 2 — Rank

`matchScore()` returns the **first** matching rung of a fixed ladder:

| Match             | Score |
| ----------------- | ----- |
| name exact        | 100   |
| name `startsWith` | 80    |
| name `includes`   | 60    |
| `fiveWords`       | 40    |
| city              | 30    |
| category          | 25    |
| `details`         | 20    |
| no match          | 0     |

Ties preserve the query's alphabetical order. This stable tiebreak matters more than it looks:
most listings score `0`, so without it the bulk of the directory would reshuffle between requests.

The `nearest`, `recommended` and `name` sorts bypass scoring entirely.

### Scale

Because filtering happens in JS, **every search reads the whole `profiles` table**. This degrades
linearly with the size of the directory and is the main reason the endpoint is CDN-cached.

---

## Measured Failures

Run against the live dev API before any changes:

| Query              | Result   | Cause                                         |
| ------------------ | -------- | --------------------------------------------- |
| `bohemian kitchen` | ✅ 1     | exact substring                               |
| `kitchen bohemian` | ❌ **0** | query is one string — word order is mandatory |
| `bohemain`         | ❌ **0** | no fuzzy matching                             |
| `foods`            | ❌ **0** | no stemming (`food` → 1)                      |
| `sazon` vs `Sazón` | ❌       | no accent folding                             |

---

## Why It Is Like This

This is not an oversight — it is migration debt, and the file says so in its own header:

> _"Converted from MongoDB Atlas Search to PostgreSQL... Geo-based scoring and fuzzy search are
> simplified in this version."_

Pana Mia **had** real search on MongoDB Atlas and lost it moving to Postgres. The score ladder in
`matchScore()` is a hand-written stand-in for Atlas Search's relevance scoring. The good news is
that the product intent it encodes maps almost perfectly onto Postgres `setweight`, so we are
restoring lost capability rather than inventing new behaviour.

---

## Proposed Design

### Verified environment

Probed directly against the dev database:

- **PostgreSQL 16.10**
- `pg_trgm 1.6`, `unaccent 1.1`, `fuzzystrmatch 1.2`, `btree_gin 1.3` — all **available, none installed**
- Both `english` and `spanish` text-search configurations present
- 15 active profiles locally

### 1. Accent folding needs an IMMUTABLE wrapper

`unaccent()` is declared **STABLE**, not IMMUTABLE, because it depends on a dictionary file. That
means it **cannot** be used directly in a generated column or an expression index. The documented
workaround is a thin wrapper that pins the dictionary explicitly:

```sql
CREATE FUNCTION pana_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
$$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
```

This matters disproportionately for Pana Mia: the directory is full of bilingual and Spanish
business names. Without it, `Sazón` and `Sazon` are different words.

> **Caveat**: marking this IMMUTABLE is a controlled lie. If the `unaccent` dictionary is ever
> modified, dependent indexes silently go stale and must be `REINDEX`ed. This is standard practice
> and safe as long as we never edit the dictionary.

### 2. Flattening the JSONB category chaos

`categories` exists in the wild in **three vocabularies** (`food`, `Food`, `Food & Drink`) and
**two shapes** (`{food: true}` maps from the account form, plain arrays from the MongoDB import —
see `scripts/migrate-from-mongodb.ts:1257`, which passes values through verbatim).

An immutable flattener handles both shapes:

```sql
CREATE FUNCTION pana_jsonb_flags(j jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(CASE jsonb_typeof(j)
    WHEN 'array'  THEN (SELECT string_agg(v #>> '{}', ' ') FROM jsonb_array_elements(j) v)
    WHEN 'object' THEN (SELECT string_agg(k, ' ') FROM jsonb_each(j) e(k,val) WHERE val = 'true'::jsonb)
    ELSE '' END, '') $$;
```

> **Key finding.** I originally assumed normalising categories at rest was a _prerequisite_ for
> this work. It is not. The flattener turns the array row into `'Food & Drink Catering'`, and
> `to_tsvector` then tokenizes that into `food`, `drink`, `catering` — so all three vocabularies
> become searchable **without** touching the stored data. Normalisation is still worth doing, but
> only for exact **filter-chip** matching, and it is no longer blocking.

### 3. The search vector

A `STORED` generated column keeps the vector in lockstep with the row automatically — no triggers,
no risk of drift. Weights map directly onto the existing score ladder:

| Weight | Fields                          | Replaces ladder rungs |
| ------ | ------------------------------- | --------------------- |
| **A**  | `name`                          | 100 / 80 / 60         |
| **B**  | `fiveWords`, `tags`             | 40                    |
| **C**  | `categories`, `addressLocality` | 30 / 25               |
| **D**  | `details`, `background`         | 20                    |

Each natural-language field is indexed under **both** `english` and `spanish`, concatenated with
`||`. `tags` and city names use `simple` (no stemming) since they are labels, not prose.

### 4. Typo tolerance: `word_similarity`, not `similarity`

The first prototype used the standard `%` operator and **failed** — `bohemain` returned nothing.

The reason is that `similarity()` compares the query against the **whole** column value. Listing
names are multi-word (`"Bohemian Kitchen"`), so a single-word query is diluted by the rest of the
string and falls under the threshold.

`word_similarity()` and its `<%` operator compare the query against the **best-matching word**
inside the value, which is exactly the semantics a search box needs. Switching operators fixed it.

This is the single most important implementation detail in this document; using `%` here looks
correct, passes review, and quietly does not work.

---

## Prototype Results

Full prototype applied and rolled back against the dev database:

**Full-text arm**

| Query              | Before | After                                          |
| ------------------ | ------ | ---------------------------------------------- |
| `food`             | ✅ 1   | ✅ Bohemian Kitchen                            |
| `foods`            | ❌ 0   | ✅ Bohemian Kitchen (stemming)                 |
| `kitchen bohemian` | ❌ 0   | ✅ Bohemian Kitchen (word order)               |
| `catering`         | ✅ 1   | ✅ Bohemian Kitchen (via flattened categories) |

**Trigram arm** (`pg_trgm.word_similarity_threshold = 0.5`)

| Query      | Match            | Score                         |
| ---------- | ---------------- | ----------------------------- |
| `bohemain` | Bohemian Kitchen | 0.56                          |
| `bohemin`  | Bohemian Kitchen | 0.75                          |
| `kitchn`   | Bohemian Kitchen | 0.71                          |
| `zzzz`     | _none_           | — correctly no false positive |

---

## Roadmap

Each phase is independently shippable and independently revertible.

### Phase 1 — Full-text search _(core value, low risk)_

- Enable `unaccent`, add `pana_unaccent` and `pana_jsonb_flags`
- Add the `search_vector` generated column and its GIN index
- In `getSearch()`, when a term is present, filter in SQL with
  `search_vector @@ websearch_to_tsquery(...)` and rank with `ts_rank_cd`
- Retire `matchScore()` for the term path; leave `nearest` / `recommended` / `name` untouched

Fixes word order, stemming and accents, and removes the full-table read from the most common path.
`websearch_to_tsquery` also gives panas quoted phrases and `-exclusion` for free.

### Phase 2 — Typo tolerance _(high perceived quality)_

- Enable `pg_trgm`, add the GIN trigram index on `pana_unaccent(name)`
- Add a fallback arm: when the FTS arm returns few or no rows, `UNION` in `<%` matches ranked
  strictly **below** every exact match, so typo results never outrank real ones

### Phase 3 — Move the remaining filters into SQL _(scale)_

- Normalise `categories` / `counties` at rest to canonical `{key: true}` maps, mirroring
  `canonical()` in `lib/server/directory.ts`
- Push category, county, certified and mentoring filters into the `WHERE` clause
- Delete the load-everything `findMany`

This is the only phase that requires a data backfill, and it is now a **scale** improvement rather
than a correctness prerequisite.

### Phase 4 — Optional polish

- `pg_trgm` on `fiveWords` as well as `name`
- Search-term analytics to find queries that return zero results
- Extend the vector to events and pana social posts

---

## Migration `0040`

Migrations here are **hand-written**, not drizzle-generated (`npm run db:generate` deliberately
errors out and says so; the drizzle-kit snapshot is intentionally stale — see `drizzle.config.ts`).
Follow `drizzle/TEMPLATE.sql` for the header block and `drizzle/0037_profile_signals.sql` for
house style: prose rationale, `--> statement-breakpoint` between statements, `IF NOT EXISTS`
everywhere, a comment above every index, and a real `Rollback:` section.

The latest migration is `0039_drop_owner_self_signals.sql`, so this becomes
`0040_profile_search_vector.sql`.

Sketch of the body (header omitted):

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION pana_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
$$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION pana_jsonb_flags(j jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(CASE jsonb_typeof(j)
    WHEN 'array'  THEN (SELECT string_agg(v #>> '{}', ' ') FROM jsonb_array_elements(j) v)
    WHEN 'object' THEN (SELECT string_agg(k, ' ') FROM jsonb_each(j) e(k,val) WHERE val = 'true'::jsonb)
    ELSE '' END, '') $$;
--> statement-breakpoint

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', pana_unaccent(coalesce(name,''))), 'A') ||
  setweight(to_tsvector('spanish', pana_unaccent(coalesce(name,''))), 'A') ||
  setweight(to_tsvector('english', pana_unaccent(coalesce(descriptions->>'fiveWords',''))), 'B') ||
  setweight(to_tsvector('simple',  pana_unaccent(coalesce(descriptions->>'tags',''))), 'B') ||
  setweight(to_tsvector('english', pana_unaccent(pana_jsonb_flags(categories))), 'C') ||
  setweight(to_tsvector('simple',  pana_unaccent(coalesce(address_locality,''))), 'C') ||
  setweight(to_tsvector('english', pana_unaccent(coalesce(descriptions->>'details',''))), 'D') ||
  setweight(to_tsvector('spanish', pana_unaccent(coalesce(descriptions->>'details',''))), 'D')
) STORED;
--> statement-breakpoint

-- Serves the directory term search in getSearch(); GIN is the right pick because
-- the vector is read far more often than profiles are edited.
CREATE INDEX IF NOT EXISTS profiles_search_vector_idx
  ON profiles USING GIN (search_vector);
```

Phase 2 adds `pg_trgm` plus:

```sql
CREATE INDEX IF NOT EXISTS profiles_name_trgm_idx
  ON profiles USING GIN (pana_unaccent(name) gin_trgm_ops);
```

**Rollback** drops the two indexes, the column, the two functions, and (optionally) the extensions,
in that order. All are additive, so rollback is clean — no data is lost.

> **Deployment note**: on managed Postgres (Supabase), extensions are conventionally installed into
> an `extensions` schema rather than `public`. Confirm the target's `search_path` before applying;
> the `regdictionary` literal inside `pana_unaccent` must be schema-qualified to match.
>
> `ALTER TABLE ... ADD COLUMN ... GENERATED ALWAYS` rewrites the table and takes an `ACCESS
EXCLUSIVE` lock. At current directory size this is a non-event, but it should still go out during
> a quiet window.

---

## Application Changes

All in `lib/server/directory.ts`:

| Today                                 | After                                              |
| ------------------------------------- | -------------------------------------------------- |
| `findMany` loads every active profile | `WHERE search_vector @@ websearch_to_tsquery(...)` |
| JS `String.includes()` term filter    | removed for the term path                          |
| `matchScore()` ladder                 | `ts_rank_cd` with the weight array `{D,C,B,A}`     |
| alphabetical tiebreak                 | keep — still needed for equal ranks                |

`canonical()`, `jsonKeys()`, `categoryKeys()` and `countyKeys()` stay exactly as they are until
Phase 3; they still drive the filter chips.

Unchanged: every URL parameter, the `nearest` / `recommended` / `name` sorts, pagination, the map
view, and the rule that **nothing viewer-specific may enter the cached response**.

---

## Risks & Open Questions

1. **Ranking changes are user-visible.** Result order will shift the moment Phase 1 ships. Worth a
   heads-up to anyone who knows the current ordering by heart.

2. **The CDN masks the rollout.** `/api/getDirectorySearch` sends
   `public, max-age=300, s-maxage=300, stale-while-revalidate=600`. The `max-age=300` is a
   **browser**-level directive, so a pana's own browser will serve stale results for five minutes
   after deploy. This already caused a working fix to look broken during directory testing.
   Recommended (**still awaiting sign-off**): `max-age=0, s-maxage=300`, which keeps the CDN win
   without the stale client.

3. **Threshold tuning is data-dependent.** `word_similarity_threshold = 0.5` scored well on the
   samples above, but the dev database has only 15 active profiles and **one** with categories.
   Re-tune against production volume before trusting Phase 2, and set it per-transaction rather
   than globally.

4. **`english` + `spanish` double-indexing inflates the vector.** Acceptable and correct for a
   bilingual community, but it roughly doubles vector size versus a single config.

5. **Stale-index hazard.** Any change to the `unaccent` dictionary requires a `REINDEX` of the
   dependent indexes, because we declared the wrapper IMMUTABLE.

6. **Latent bug, not in scope**: `listSelectedCategories` in `lib/profile.ts` iterates
   `Object.keys(categories)` without checking values, so it reports every category as selected.
   Worth fixing alongside the Phase 3 normalisation.

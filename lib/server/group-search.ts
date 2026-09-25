/**
 * Group discovery search.
 *
 * Runs against the two generated tsvectors added in migration 0044. Groups
 * are searchable by three fields that deliberately live in two tables --
 * name and summary on social_actors, topics on social_groups -- so this
 * queries both vectors and sums their ranks. See the migration header for why
 * the split exists and was not denormalised away.
 *
 * @see drizzle/0045_group_search_vector.sql
 * @see lib/server/directory.ts - the profile equivalent this mirrors
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type {
  SocialGroupJoinPolicy,
  SocialGroupVisibility,
} from '@/lib/schema';

export interface GroupSearchResult {
  id: string;
  actorId: string;
  handle: string;
  domain: string;
  name: string | null;
  summary: string | null;
  iconUrl: string | null;
  topics: Record<string, boolean>;
  visibility: SocialGroupVisibility;
  joinPolicy: SocialGroupJoinPolicy;
  memberCount: number;
}

export interface SearchGroupsOptions {
  term?: string;
  limit?: number;
  offset?: number;
}

/**
 * Column weights for ts_rank_cd, ordered {D, C, B, A}.
 *
 * Shared by both vectors on purpose, and it is what makes summing their ranks
 * produce the intended name > topics > summary ordering without a tuning
 * constant: a name hit scores at A (1.0) in the actor vector, a topic hit at
 * B (0.6) in the group vector, a summary hit at C (0.3) in the actor vector.
 *
 * Read the migration header before changing these. setweight only orders
 * terms *within* one tsvector, so these numbers are the only thing making the
 * two vectors comparable to each other. Giving the group vector its own
 * weights would silently reorder results across the join.
 */
const RANK_WEIGHTS = '{0.1,0.3,0.6,1.0}';

/**
 * Same intent as the directory's boosts: someone typing a group's name
 * exactly should get that group first, not fourth behind groups that merely
 * mention it in a summary. ts_rank_cd has no concept of "this *is* the thing
 * you named".
 */
const EXACT_NAME_BOOST = 1000;
const PREFIX_NAME_BOOST = 100;

const TRIGRAM_THRESHOLD = 0.5;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Identity fields only -- never group content.
 *
 * Private groups are intentionally included in results. The read endpoint
 * already takes this position for direct lookups ("a private group you cannot
 * identify at all is a dead end nobody would ever ask to join"), and a
 * private group with joinPolicy 'request' is unusable if nobody can find it
 * to ask. What is withheld is posts, roster and events, none of which this
 * query touches.
 *
 * If that stance ever changes, change it here and in the [handle] route
 * together -- the leak that matters is the two disagreeing.
 *
 * @see app/api/social/groups/[handle]/route.ts
 */
const GROUP_COLUMNS = sql`
  g.id              AS id,
  g.actor_id        AS "actorId",
  a.username        AS handle,
  a.domain          AS domain,
  a.name            AS name,
  a.summary         AS summary,
  a.icon_url        AS "iconUrl",
  g.topics          AS topics,
  g.visibility      AS visibility,
  g.join_policy     AS "joinPolicy",
  g.member_count    AS "memberCount"
`;

interface RawGroupRow {
  id: string;
  actorId: string;
  handle: string;
  domain: string;
  name: string | null;
  summary: string | null;
  iconUrl: string | null;
  topics: Record<string, boolean> | null;
  visibility: SocialGroupVisibility;
  joinPolicy: SocialGroupJoinPolicy;
  memberCount: number | string;
}

function toResult(row: RawGroupRow): GroupSearchResult {
  return {
    id: row.id,
    actorId: row.actorId,
    handle: row.handle,
    domain: row.domain,
    name: row.name,
    summary: row.summary,
    iconUrl: row.iconUrl,
    topics: row.topics ?? {},
    visibility: row.visibility,
    joinPolicy: row.joinPolicy,
    memberCount: Number(row.memberCount) || 0,
  };
}

function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

function clampOffset(offset: number | undefined): number {
  if (!offset || !Number.isFinite(offset) || offset < 0) return 0;
  return Math.floor(offset);
}

/**
 * What discovery shows before anyone types anything.
 *
 * Ordered by member count so the browse view opens on groups that are
 * actually alive, with created_at as a stable tiebreak -- without it, two
 * groups on the same count can swap places between pages and a paginating
 * client sees the same group twice.
 */
async function browseGroups(
  limit: number,
  offset: number
): Promise<GroupSearchResult[]> {
  const rows = (await db.execute(sql`
    SELECT ${GROUP_COLUMNS}
    FROM social_groups g
    JOIN social_actors a ON a.id = g.actor_id
    ORDER BY g.member_count DESC, g.created_at DESC, g.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `)) as unknown as RawGroupRow[];

  return rows.map(toResult);
}

/**
 * Trigram fallback, for when full-text finds nothing.
 *
 * Fires only on zero rows, exactly as the directory does, so fuzzy matches
 * never pollute a query that already works and the two result sets never need
 * their rankings reconciled. Matches on name alone: a misspelled topic is not
 * worth the false positives, because topic keys are short and a three-letter
 * overlap between unrelated topics is common.
 *
 * The details that look cosmetic but are not -- word_similarity() rather than
 * similarity(), the %> operator rather than the function form, and
 * pana_unaccent(a.name) on the left to match the indexed expression exactly --
 * are all explained in lib/server/directory.ts. Changing any of them here
 * drops the index and silently turns this into a sequential scan.
 */
async function trigramSearch(
  trimmed: string,
  limit: number,
  offset: number
): Promise<GroupSearchResult[]> {
  const rows = (await db.transaction(async (tx) => {
    // pg_trgm's operators live wherever the extension was installed --
    // "extensions" on Supabase, public on plain Postgres. Naming both covers
    // either; Postgres ignores entries that do not exist. Migration 0044
    // asserts the extension is in one of them.
    await tx.execute(
      sql`SELECT set_config('search_path', 'public, extensions', true)`
    );
    // set_config(..., true) is SET LOCAL, so this reverts with the
    // transaction. A GUC cannot be a bind parameter in SET, but it can here.
    await tx.execute(
      sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(TRIGRAM_THRESHOLD)}, true)`
    );
    return await tx.execute(sql`
      SELECT ${GROUP_COLUMNS},
             word_similarity(pana_unaccent(${trimmed}), pana_unaccent(a.name)) AS sim
      FROM social_groups g
      JOIN social_actors a ON a.id = g.actor_id
      WHERE pana_unaccent(a.name) %> ${trimmed}
      ORDER BY sim DESC, g.member_count DESC, g.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
  })) as unknown as RawGroupRow[];

  return rows.map(toResult);
}

/**
 * Search groups by name, topic and summary.
 *
 * An empty term is browse rather than an error, so one endpoint serves both
 * the discovery page and the search box.
 */
export async function searchGroups(
  options: SearchGroupsOptions = {}
): Promise<GroupSearchResult[]> {
  const limit = clampLimit(options.limit);
  const offset = clampOffset(options.offset);
  const trimmed = (options.term ?? '').trim();

  if (!trimmed) return browseGroups(limit, offset);

  // Three configurations OR'd together. english and spanish because the
  // community writes in both; simple because it is the only arm that survives
  // a query made entirely of stop words -- without it a group named "The
  // Hall" is unreachable by its own first word.
  const rows = (await db.execute(sql`
    WITH q AS (
      SELECT websearch_to_tsquery('english', pana_unaccent(${trimmed}))
          || websearch_to_tsquery('spanish', pana_unaccent(${trimmed}))
          || websearch_to_tsquery('simple',  pana_unaccent(${trimmed})) AS tsq
    )
    SELECT ${GROUP_COLUMNS},
           ts_rank_cd(${RANK_WEIGHTS}::float4[], a.search_vector, q.tsq)
         + ts_rank_cd(${RANK_WEIGHTS}::float4[], g.search_vector, q.tsq) AS rank,
           (lower(pana_unaccent(coalesce(a.name, ''))) = lower(pana_unaccent(${trimmed}))) AS exact_name,
           starts_with(lower(pana_unaccent(coalesce(a.name, ''))), lower(pana_unaccent(${trimmed}))) AS prefix_name
    FROM social_groups g
    JOIN social_actors a ON a.id = g.actor_id, q
    WHERE a.search_vector @@ q.tsq OR g.search_vector @@ q.tsq
    ORDER BY
      (
        ts_rank_cd(${RANK_WEIGHTS}::float4[], a.search_vector, q.tsq)
      + ts_rank_cd(${RANK_WEIGHTS}::float4[], g.search_vector, q.tsq)
      + CASE WHEN lower(pana_unaccent(coalesce(a.name, ''))) = lower(pana_unaccent(${trimmed}))
             THEN ${EXACT_NAME_BOOST} ELSE 0 END
      + CASE WHEN starts_with(lower(pana_unaccent(coalesce(a.name, ''))), lower(pana_unaccent(${trimmed})))
             THEN ${PREFIX_NAME_BOOST} ELSE 0 END
      ) DESC,
      g.member_count DESC,
      g.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `)) as unknown as RawGroupRow[];

  if (rows.length === 0) return trigramSearch(trimmed, limit, offset);

  return rows.map(toResult);
}

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

/**
 * The next thing a group has on its calendar, for the event line on a card.
 *
 * Deliberately four fields and not the full GroupEventSummary. A browse card
 * names an event and dates it; venue, mode, status and attendee counts are
 * the group page's job, and selecting them here would widen every row of
 * every search for data nothing on this surface renders.
 *
 * `timezone` is not optional padding. An event in Miami is on the day Miami
 * says it is regardless of where it is being browsed from, which is the same
 * position search-kinds.ts and suggest.ts already take; dropping it would
 * silently shift a Saturday event to Friday for a reader on the west coast.
 */
export interface GroupNextEvent {
  slug: string;
  title: string;
  startsAt: string;
  timezone: string;
}

export interface GroupSearchResult {
  id: string;
  actorId: string;
  handle: string;
  domain: string;
  name: string | null;
  summary: string | null;
  iconUrl: string | null;
  /** Cover photo. Actor identity, same class as iconUrl, public either way. */
  headerUrl: string | null;
  topics: Record<string, boolean>;
  visibility: SocialGroupVisibility;
  joinPolicy: SocialGroupJoinPolicy;
  memberCount: number;
  /**
   * A few member avatar URLs, for the face pile on a result card. Empty for
   * private groups -- see GROUP_COLUMNS.
   */
  faces: string[];
  /** Posts in the last seven days. Always 0 for private groups. */
  postsThisWeek: number;
  /** Next published public event. Always null for private groups. */
  nextEvent: GroupNextEvent | null;
  /** How many upcoming events in total, so a card can say "+2 more". */
  upcomingEventCount: number;
}

/**
 * What "first" means on a browse page.
 *
 * `members` was the only order until the landing page needed an "active right
 * now" shelf, and it cannot be the default for discovery: sorted by size, a
 * new group is invisible forever and a browse page that only ever shows the
 * ten biggest groups cannot grow an eleventh. `new` exists so the thing
 * somebody just created is findable the same day.
 *
 * Only applies to browsing. Once there is a term, relevance wins and a sort
 * control would be competing with the ranking rather than refining it.
 */
export type GroupSort = 'active' | 'members' | 'new';

const GROUP_SORTS: readonly GroupSort[] = ['active', 'members', 'new'];

export function parseGroupSort(value: string | null | undefined): GroupSort {
  return GROUP_SORTS.includes(value as GroupSort)
    ? (value as GroupSort)
    : 'members';
}

export interface SearchGroupsOptions {
  term?: string;
  limit?: number;
  offset?: number;
  sort?: GroupSort;
  /**
   * Exact topic key, as stored. Narrows rather than searches.
   *
   * Topics are in the search vector already, so `?q=zines` would find most of
   * these -- but it would also find groups that merely mention zines in a
   * summary, and then a chip reading "zines 4" would sit above five results.
   * A facet count and the filter behind it have to be the same question, so
   * this one is key equality.
   */
  topic?: string | null;
}

/**
 * The topic narrowing clause, or nothing.
 *
 * `jsonb_exists(topics, key)` rather than the `?` operator it is an alias
 * for. They are the same test, but a bare `?` in a SQL string is ambiguous
 * with a driver placeholder, and the function form cannot be misread by
 * anything between here and Postgres.
 */
function topicClause(topic: string | null | undefined) {
  const trimmed = (topic ?? '').trim();
  if (!trimmed) return null;
  return sql`jsonb_exists(g.topics, ${trimmed})`;
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

/**
 * Faces on a card, not a roster. Five is enough to read as a crowd; more just
 * makes a wider pile of the same signal.
 */
const MAX_FACES = 5;

/**
 * The window "active right now" actually means.
 *
 * Seven days because it has to survive a group that meets weekly. A 24-hour
 * window reports most healthy groups as dead six days out of seven, and a
 * 30-day one cannot tell a group that stopped last week from one that
 * stopped last month -- which is the single distinction this number exists
 * to draw.
 *
 * Exported because the groups rail counts the same thing for a member's own
 * groups (see listMyGroups). Two copies of this number would let a card read
 * "quiet this week" next to a rail dot saying otherwise.
 */
export const ACTIVITY_WINDOW_DAYS = 7;

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
 * `faces` is the one near-exception, and it is why the CASE below is not
 * decoration. Avatar URLs are roster data: a face pile on a private group
 * would publish "these specific people are in it" to anyone who can run a
 * search, which is everyone, since this endpoint is unauthenticated. The
 * members route draws the same line -- member *count* is public even for a
 * private group, the roster is not -- so this matches it rather than
 * inventing a second rule.
 *
 * The gate lives in SQL so a private group's avatar URLs are never selected
 * at all. Filtering in toResult() or in the card would mean the data had
 * already left the database, one careless `console.log` away from the wire.
 *
 * Expressed as a correlated ARRAY subquery rather than a LEFT JOIN LATERAL
 * for one reason: this fragment is a select list, and all three query paths
 * (browse, full-text, trigram) interpolate it. A lateral would have to be
 * repeated in three FROM clauses, and the failure mode of forgetting one is
 * faces that appear while browsing and vanish the moment you type. ARRAY()
 * preserves its subquery's ORDER BY, so the ordering below is guaranteed
 * rather than incidental.
 *
 * Ordering mirrors ROLE_THEN_SENIORITY in the roster helper -- admins, then
 * moderators, then everyone else, oldest first within a rank, id as the
 * stable tiebreak -- so the faces are the same people in the same order as
 * the top of the roster rather than an unrelated five.
 *
 * 'active' only, for the reason the roster helper spells out: a pending row
 * is somebody who asked and has not been let in, and a banned row is a
 * tombstone. Null icons are skipped because a pile of placeholders is noise,
 * not evidence that anyone is home.
 *
 * `postsThisWeek`, `nextEvent` and `upcomingEventCount` get the same CASE for
 * the same reason, and it is the reason rather than the pattern that matters:
 * what a private group is discussing and when it next meets are exactly the
 * things the visibility setting exists to protect. Leaking "14 posts this
 * week" about a tenant union tells anyone running a search that the union is
 * organising, which is most of what a hostile reader wanted to know.
 *
 * For a *public* group no further per-post gate is needed, and that is not an
 * oversight: `visibleGroupStatuses` defines a public group's posts as
 * readable by anyone including a signed-out visitor, so counting all of them
 * is the same rule rather than a looser one. Events carry their own
 * status/visibility columns, so those are filtered explicitly.
 *
 * Both counts are correlated subqueries over indexes that already exist --
 * `social_statuses_group_published_idx` on (group_id, published) and
 * `events_host_group_id_idx` -- so this costs an index range scan per row
 * rather than a sequential scan.
 *
 * @see app/api/social/groups/[handle]/route.ts
 * @see app/api/social/groups/[handle]/members/route.ts
 * @see lib/federation/wrappers/group-members.ts
 * @see lib/federation/wrappers/group-visibility.ts
 */
const GROUP_COLUMNS = sql`
  g.id              AS id,
  g.actor_id        AS "actorId",
  a.username        AS handle,
  a.domain          AS domain,
  a.name            AS name,
  a.summary         AS summary,
  a.icon_url        AS "iconUrl",
  a.header_url      AS "headerUrl",
  g.topics          AS topics,
  g.visibility      AS visibility,
  g.join_policy     AS "joinPolicy",
  g.member_count    AS "memberCount",
  CASE WHEN g.visibility = 'public' THEN ARRAY(
    SELECT fa.icon_url
    FROM social_group_members fm
    JOIN social_actors fa ON fa.id = fm.actor_id
    WHERE fm.group_id = g.id
      AND fm.status = 'active'
      AND fa.icon_url IS NOT NULL
    ORDER BY
      CASE fm.role WHEN 'admin' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END,
      fm.joined_at ASC NULLS LAST,
      fm.id ASC
    LIMIT ${MAX_FACES}
  ) ELSE ARRAY[]::text[] END AS faces,
  CASE WHEN g.visibility = 'public' THEN (
    SELECT count(*)::int
    FROM social_statuses s
    WHERE s.group_id = g.id
      AND s.published > now() - ${`${ACTIVITY_WINDOW_DAYS} days`}::interval
  ) ELSE 0 END AS "postsThisWeek",
  CASE WHEN g.visibility = 'public' THEN (
    SELECT row_to_json(e)
    FROM (
      SELECT ev.slug, ev.title, ev.starts_at AS "startsAt", ev.timezone
      FROM events ev
      WHERE ev.host_group_id = g.id
        AND ev.status = 'published'
        AND ev.visibility = 'public'
        AND ev.starts_at > now()
      ORDER BY ev.starts_at ASC
      LIMIT 1
    ) e
  ) ELSE NULL END AS "nextEvent",
  CASE WHEN g.visibility = 'public' THEN (
    SELECT count(*)::int
    FROM events ev
    WHERE ev.host_group_id = g.id
      AND ev.status = 'published'
      AND ev.visibility = 'public'
      AND ev.starts_at > now()
  ) ELSE 0 END AS "upcomingEventCount"
`;

interface RawGroupRow {
  id: string;
  actorId: string;
  handle: string;
  domain: string;
  name: string | null;
  summary: string | null;
  iconUrl: string | null;
  headerUrl: string | null;
  topics: Record<string, boolean> | null;
  visibility: SocialGroupVisibility;
  joinPolicy: SocialGroupJoinPolicy;
  memberCount: number | string;
  faces: string[] | null;
  postsThisWeek: number | string | null;
  nextEvent: {
    slug: string;
    title: string;
    startsAt: string;
    timezone: string;
  } | null;
  upcomingEventCount: number | string | null;
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
    headerUrl: row.headerUrl,
    topics: row.topics ?? {},
    visibility: row.visibility,
    joinPolicy: row.joinPolicy,
    memberCount: Number(row.memberCount) || 0,
    faces: row.faces ?? [],
    postsThisWeek: Number(row.postsThisWeek) || 0,
    nextEvent: row.nextEvent
      ? {
          slug: row.nextEvent.slug,
          title: row.nextEvent.title,
          // row_to_json renders a timestamptz as a string already; normalising
          // through Date keeps it a real ISO string whichever driver is in
          // play rather than Postgres's own ' '-separated rendering.
          startsAt: new Date(row.nextEvent.startsAt).toISOString(),
          timezone: row.nextEvent.timezone,
        }
      : null,
    upcomingEventCount: Number(row.upcomingEventCount) || 0,
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
 * Every order ends in the same two tiebreaks -- created_at then id -- and
 * that is not tidiness. Without a total order, two groups on the same count
 * can swap places between pages and a paginating client sees the same group
 * twice while never seeing another.
 *
 * `active` orders on the post count already in the select list rather than
 * recomputing it, so the number a card prints and the position it holds can
 * never disagree. Member count is its first tiebreak so a brand-new silent
 * group does not outrank a large silent one.
 */
async function browseGroups(
  limit: number,
  offset: number,
  sort: GroupSort,
  topic: string | null | undefined
): Promise<GroupSearchResult[]> {
  const order =
    sort === 'active'
      ? sql`"postsThisWeek" DESC, g.member_count DESC`
      : sort === 'new'
        ? sql`g.created_at DESC`
        : sql`g.member_count DESC`;

  const narrow = topicClause(topic);

  const rows = (await db.execute(sql`
    SELECT ${GROUP_COLUMNS}
    FROM social_groups g
    JOIN social_actors a ON a.id = g.actor_id
    ${narrow ? sql`WHERE ${narrow}` : sql``}
    ORDER BY ${order}, g.created_at DESC, g.id DESC
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
  offset: number,
  topic: string | null | undefined
): Promise<GroupSearchResult[]> {
  const narrow = topicClause(topic);

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
      ${narrow ? sql`AND ${narrow}` : sql``}
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
 * the discovery page and the search box. `sort` applies only to that browse
 * path: once there is a term, relevance decides, and letting a sort override
 * it would mean a group that matched exactly could appear below one that
 * merely mentioned the word.
 */
export async function searchGroups(
  options: SearchGroupsOptions = {}
): Promise<GroupSearchResult[]> {
  const limit = clampLimit(options.limit);
  const offset = clampOffset(options.offset);
  const trimmed = (options.term ?? '').trim();
  const topic = options.topic ?? null;

  if (!trimmed) {
    return browseGroups(limit, offset, options.sort ?? 'members', topic);
  }

  const narrow = topicClause(topic);

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
    WHERE (a.search_vector @@ q.tsq OR g.search_vector @@ q.tsq)
    ${narrow ? sql`AND ${narrow}` : sql``}
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

  if (rows.length === 0) return trigramSearch(trimmed, limit, offset, topic);

  return rows.map(toResult);
}

/**
 * The topics people have actually used, with how many groups use each.
 *
 * Topics are free text -- the create form takes a comma-separated list and
 * stores whatever was typed -- so there is no vocabulary to render a chip row
 * from. This derives one from the data instead, which has the side effect of
 * making the chips self-maintaining: a topic nobody uses stops appearing, and
 * one that catches on appears without a deploy.
 *
 * Private groups are counted, and that is deliberate rather than an
 * oversight. Search returns private groups by design, so a chip that excluded
 * them would advertise "3" above a filtered list of four -- the derived-number
 * disagreement that makes a page look broken. A topic is identity, not
 * content; it is already on the public card.
 *
 * `jsonb_each` over a flag map rather than a key list, because that is the
 * shape migration 0040 settled on and `pana_jsonb_flags` reads the same way.
 * The `= 'true'` check matters: the writer only ever sets true, but a map
 * that once held a false would otherwise count a topic a group opted out of.
 */
export interface GroupTopicFacet {
  topic: string;
  count: number;
}

const DEFAULT_TOPIC_FACETS = 18;

export async function listGroupTopics(
  limit = DEFAULT_TOPIC_FACETS
): Promise<GroupTopicFacet[]> {
  const rows = (await db.execute(sql`
    SELECT t.key AS topic, count(*)::int AS count
    FROM social_groups g,
         LATERAL jsonb_each(g.topics) AS t(key, value)
    WHERE jsonb_typeof(g.topics) = 'object'
      AND t.value = 'true'::jsonb
    GROUP BY t.key
    ORDER BY count DESC, t.key ASC
    LIMIT ${Math.max(1, Math.min(Math.floor(limit), 50))}
  `)) as unknown as { topic: string; count: number | string }[];

  return rows.map((row) => ({
    topic: row.topic,
    count: Number(row.count) || 0,
  }));
}

/**
 * What groups have coming up, across all of them.
 *
 * The argument for putting events on a groups page rather than leaving them
 * to /events is that they show what joining actually gets you, which is why
 * every row names its host group. An events list that did not would just be
 * the events page with fewer rows.
 *
 * Private groups are excluded outright here, unlike everywhere else in this
 * file. Their *existence* is public; their calendar is not, and an event row
 * names a time and a place, which is the most actionable thing a private
 * group has.
 */
export interface UpcomingGroupEvent {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  timezone: string;
  mode: string;
  attendeeCount: number;
  groupHandle: string;
  groupName: string | null;
  venue: { name: string; city: string; state: string } | null;
}

const DEFAULT_UPCOMING_EVENTS = 4;

export async function listUpcomingGroupEvents(
  limit = DEFAULT_UPCOMING_EVENTS
): Promise<UpcomingGroupEvent[]> {
  const rows = (await db.execute(sql`
    SELECT ev.id                AS id,
           ev.slug              AS slug,
           ev.title             AS title,
           ev.starts_at         AS "startsAt",
           ev.timezone          AS timezone,
           ev.mode              AS mode,
           ev.attendee_count    AS "attendeeCount",
           a.username           AS "groupHandle",
           a.name               AS "groupName",
           v.name               AS "venueName",
           v.city               AS "venueCity",
           v.state              AS "venueState"
    FROM events ev
    JOIN social_groups g ON g.id = ev.host_group_id
    JOIN social_actors a ON a.id = g.actor_id
    LEFT JOIN venues v ON v.id = ev.venue_id
    WHERE g.visibility = 'public'
      AND ev.status = 'published'
      AND ev.visibility = 'public'
      AND ev.starts_at > now()
    ORDER BY ev.starts_at ASC, ev.id ASC
    LIMIT ${Math.max(1, Math.min(Math.floor(limit), 20))}
  `)) as unknown as {
    id: string;
    slug: string;
    title: string;
    startsAt: string | Date;
    timezone: string;
    mode: string;
    attendeeCount: number | string;
    groupHandle: string;
    groupName: string | null;
    venueName: string | null;
    venueCity: string | null;
    venueState: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    startsAt: new Date(row.startsAt).toISOString(),
    timezone: row.timezone,
    mode: row.mode,
    attendeeCount: Number(row.attendeeCount) || 0,
    groupHandle: row.groupHandle,
    groupName: row.groupName,
    venue: row.venueName
      ? {
          name: row.venueName,
          city: row.venueCity ?? '',
          state: row.venueState ?? '',
        }
      : null,
  }));
}

/**
 * How many groups a term matches.
 *
 * Lives here rather than with the other directory counts because it has to
 * agree with `searchGroups` exactly, and the thing it has to agree with is not
 * just the predicate but the fallback: a term that full-text misses and
 * trigram catches would otherwise label the tab "0" above a page showing
 * three. So this repeats the same two stages in the same order, and only
 * counts the fuzzy arm when the strict one is empty.
 *
 * Unbounded on purpose — the tab says how many exist, not how many one page
 * holds.
 */
export async function countGroups(term: string): Promise<number> {
  const trimmed = term.trim();
  if (!trimmed) return 0;

  const exact = (await db.execute(sql`
    WITH q AS (
      SELECT websearch_to_tsquery('english', pana_unaccent(${trimmed}))
          || websearch_to_tsquery('spanish', pana_unaccent(${trimmed}))
          || websearch_to_tsquery('simple',  pana_unaccent(${trimmed})) AS tsq
    )
    SELECT count(*)::int AS count
    FROM social_groups g
    JOIN social_actors a ON a.id = g.actor_id, q
    WHERE a.search_vector @@ q.tsq OR g.search_vector @@ q.tsq
  `)) as unknown as { count: number }[];

  const found = exact[0]?.count ?? 0;
  if (found > 0) return found;

  const fuzzy = (await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('search_path', 'public, extensions', true)`
    );
    await tx.execute(
      sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(TRIGRAM_THRESHOLD)}, true)`
    );
    return await tx.execute(sql`
      SELECT count(*)::int AS count
      FROM social_groups g
      JOIN social_actors a ON a.id = g.actor_id
      WHERE pana_unaccent(a.name) %> ${trimmed}
    `);
  })) as unknown as { count: number }[];

  return fuzzy[0]?.count ?? 0;
}

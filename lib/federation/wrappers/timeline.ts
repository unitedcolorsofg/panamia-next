/**
 * Timeline Management
 *
 * High-level functions for querying timelines.
 *
 * IMPORTANT: Direct messages are EXCLUDED from Home and Public timelines.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import { db } from '@/lib/db';
import {
  socialStatuses,
  socialFollows,
  socialActors,
  socialLikes,
  socialGroupMembers,
  PUBLIC_ACTOR_COLUMNS,
  STATUS_TYPE_STORY,
} from '@/lib/schema';
import type {
  SocialStatus,
  PublicSocialActor,
  SocialGroupVisibility,
} from '@/lib/schema';
import { and, eq, sql, or, type SQL } from 'drizzle-orm';
import { countyShortLabel } from '@/lib/county';
import { socialConfig } from '../index';
import {
  getViewerGroupIds,
  visibleGroupStatuses,
  personalStatusesOnly,
  canViewStatusGroup,
} from './group-visibility';

const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

/**
 * Drizzle SQL condition to exclude expired statuses (soft delete).
 */
function notExpired() {
  return sql`(${socialStatuses.expiresAt} IS NULL OR ${socialStatuses.expiresAt} > NOW())`;
}

/**
 * Drizzle SQL condition to keep stories out of anything that means "posts".
 *
 * Stories live in this table too (see STATUS_TYPE_STORY) because they needed
 * expiry and attachments, which were already solved here. The cost of that
 * reuse is this guard, and it has to be applied deliberately rather than
 * inherited: the home and public timelines happen to be safe because a story
 * is addressed followers-only and those queries demand the Public URI, but
 * `getActorPosts` filters on nothing but the actor and expiry. Without this,
 * a story appears on the profile's Posts tab as an ordinary post the moment
 * it is created, and silently vanishes a day later.
 *
 * Applied everywhere regardless, including where the addressing already
 * covers it. Relying on "this query happens to require Public" means the next
 * person to relax an addressing filter also has to know they are changing
 * story visibility, and they will not.
 */
function excludeStories() {
  return sql`${socialStatuses.type} <> ${STATUS_TYPE_STORY}`;
}

/**
 * Check if a JSONB array column contains a specific string value.
 * PostgreSQL: column @> to_jsonb(value::text)
 */

function jsonbArrayContains(
  column: SQL<unknown> | { getSQL(): SQL<unknown> },
  value: string
) {
  return sql`${column} @> to_jsonb(${value}::text)`;
}

export type PublicActorWithCounty = PublicSocialActor & {
  /**
   * Where this person is, for the badge beside their name. Null for a remote
   * actor (no local profile to read) and for a member who has not set an
   * address, and both mean the same thing to a caller: render nothing.
   */
  county: string | null;
};

/**
 * Which group a post came from, for the "posted in …" line above it.
 *
 * Deliberately not the whole group row. A timeline needs to name the group and
 * link to it, and nothing more; forwarding the row would put every column
 * added to social_groups later into a feed response nobody re-reviewed.
 */
export type StatusGroupContext = {
  id: string;
  handle: string;
  name: string | null;
  visibility: SocialGroupVisibility;
};

export type StatusWithActorAndLike = SocialStatus & {
  actor: PublicActorWithCounty;
  liked: boolean;
  /** Null for an ordinary personal post, which is most of them. */
  group: StatusGroupContext | null;
};

/**
 * The actor shape every timeline returns.
 *
 * Written once and shared because seven read paths in this file select an
 * actor, and a per-call-site spelling is how a field ends up present on the
 * home feed and missing on a permalink for the same post. The directory's
 * account-type gate had to be repaired in four places for that exact reason;
 * this keeps the next field from repeating it.
 */
const ACTOR_WITH = {
  columns: PUBLIC_ACTOR_COLUMNS,
  with: { profile: { columns: { counties: true } } },
} as const;

/**
 * Flatten the joined profile into the county the client actually renders.
 *
 * The nested profile row is dropped rather than forwarded: it was selected to
 * answer one question, and passing the whole thing outward would make every
 * column added to profiles later a silent addition to a public response.
 */
function publicActor(actor: {
  profile?: { counties: unknown } | null;
}): PublicActorWithCounty {
  const { profile, ...rest } = actor;
  return {
    ...(rest as unknown as PublicSocialActor),
    county: countyShortLabel(profile?.counties),
  };
}

/**
 * The group columns every read path selects, for the same reason ACTOR_WITH
 * exists: seven call sites, one spelling.
 */
const GROUP_WITH = {
  columns: { id: true, visibility: true },
  with: { actor: { columns: { username: true, name: true } } },
} as const;

type GroupRow = {
  id: string;
  visibility: SocialGroupVisibility;
  actor: { username: string; name: string | null } | null;
};

function groupContext(group?: GroupRow | null): StatusGroupContext | null {
  if (!group?.actor) return null;
  return {
    id: group.id,
    handle: group.actor.username,
    name: group.actor.name,
    visibility: group.visibility,
  };
}

/**
 * Flatten one queried row into the shape every timeline returns.
 *
 * Written once because the seven read paths below were each mapping their own
 * rows, and the mappers had already drifted — some read `likes.length > 0`
 * directly while others guarded it. A field added to the response in six of
 * seven places is a field that is mysteriously absent on the seventh.
 */
function toStatus(row: {
  actor: { profile?: { counties: unknown } | null };
  likes?: { id: string }[];
  group?: GroupRow | null;
}): StatusWithActorAndLike {
  const { likes, actor, group, ...rest } = row;
  return {
    ...(rest as unknown as SocialStatus),
    actor: publicActor(actor),
    liked: likes ? likes.length > 0 : false,
    group: groupContext(group),
  };
}

export type TimelineResult = {
  statuses: StatusWithActorAndLike[];
  nextCursor: string | null;
};

/**
 * Get home timeline for an actor.
 *
 * DESIGN NOTE: This is a deliberate fan-out-on-READ implementation. We do
 * NOT maintain per-user `timeline_entries` rows that get written on every
 * post creation. That would mean 100+ INSERTs per post in a serverless
 * request handler, synchronous deletes on every unpost, and a write
 * amplification problem that PG + Hyperdrive is not the right tool for.
 *
 * If you're reading this and thinking "we should move to fan-out on write
 * now that we have Durable Objects" — don't. A per-user timeline DO would
 * still cold-start from storage and hit the DB on hibernation wake, so it
 * buys nothing over the query below while adding a stateful component.
 * Durable Objects are the right tool for outbound delivery fan-out and for
 * realtime push (see the DEFERRED comments in ./status.ts), NOT for
 * materializing the read path.
 */
export async function getHomeTimeline(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  // Get list of actors this user follows
  const follows = await db
    .select({ targetActorId: socialFollows.targetActorId })
    .from(socialFollows)
    .where(
      and(
        eq(socialFollows.actorId, actorId),
        eq(socialFollows.status, 'accepted')
      )
    );

  const followedActorIds = follows.map((f) => f.targetActorId);
  const timelineActorIds = [...followedActorIds, actorId];

  // Groups this person is actually in. Their posts reach the feed on
  // membership alone, with no follow and no public addressing involved.
  const memberGroupIds = await db
    .select({ groupId: socialGroupMembers.groupId })
    .from(socialGroupMembers)
    .where(
      and(
        eq(socialGroupMembers.actorId, actorId),
        eq(socialGroupMembers.status, 'active')
      )
    )
    .then((rows) => rows.map((r) => r.groupId));

  const rows = await db.query.socialStatuses.findMany({
    /**
     * Two arms, not one filter with an extra clause.
     *
     * The follow arm requires public addressing, as it always has. A private
     * group's posts are not PUBLIC-addressed — that is the entire point of
     * them — so folding `group_id` into that arm would silently drop every
     * private group post and present as "groups just don't work", with no
     * error anywhere to explain it.
     *
     * The group arm therefore carries no addressing requirement at all.
     * Membership is the authorization, which is why `memberGroupIds` is read
     * from `status = 'active'` rows and nowhere else.
     *
     * `isNull(groupId)` on the follow arm is not redundant: without it, a post
     * to a group you are in, written by someone you also follow, matches both
     * arms and renders twice.
     */
    where: (s, { and: andOp, inArray, isNotNull, isNull }) =>
      andOp(
        or(
          andOp(
            sql`${s.actorId} = ANY(ARRAY[${sql.join(
              timelineActorIds.map((id) => sql`${id}`),
              sql`, `
            )}]::text[])`,
            isNull(s.groupId),
            or(
              jsonbArrayContains(socialStatuses.recipientTo, PUBLIC),
              jsonbArrayContains(socialStatuses.recipientCc, PUBLIC)
            )
          ),
          memberGroupIds.length > 0
            ? inArray(s.groupId, memberGroupIds)
            : sql`false`
        ),
        isNotNull(s.published),
        isNull(s.inReplyToId),
        notExpired(),
        excludeStories(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      group: GROUP_WITH,
      likes: {
        where: eq(socialLikes.actorId, actorId),
        columns: { id: true },
      },
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { statuses: items.map(toStatus), nextCursor };
}

/**
 * Get posts by a specific actor.
 */
export async function getActorPosts(
  actorId: string,
  viewerActorId?: string,
  cursor?: string,
  limit: number = 20,
  includeReplies: boolean = false
): Promise<TimelineResult> {
  const viewerGroupIds = await getViewerGroupIds(viewerActorId);

  const rows = await db.query.socialStatuses.findMany({
    where: (s, { and, eq, isNotNull, isNull }) =>
      and(
        eq(s.actorId, actorId),
        isNotNull(s.published),
        includeReplies ? undefined : isNull(s.inReplyToId),
        // Without this a private group post appears on its author's profile,
        // to anyone, which is the leak the group feature is most able to cause:
        // the author is public, so nothing else here would have stopped it.
        visibleGroupStatuses(viewerGroupIds),
        notExpired(),
        excludeStories(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      group: GROUP_WITH,
      ...(viewerActorId && {
        likes: {
          where: eq(socialLikes.actorId, viewerActorId),
          columns: { id: true },
        },
      }),
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { statuses: items.map(toStatus), nextCursor };
}

/**
 * Get posts in a group.
 *
 * The visibility predicate does the authorization rather than a separate
 * `canRead` check before the call: for a public group it passes everything,
 * and for a private one it matches only when the viewer holds active
 * membership. A non-member therefore gets an empty timeline rather than an
 * error, which is also the right answer for a group they cannot see into.
 */
export async function getGroupTimeline(
  groupId: string,
  viewerActorId?: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const viewerGroupIds = await getViewerGroupIds(viewerActorId);

  const rows = await db.query.socialStatuses.findMany({
    where: (s, { and, eq: eqOp, isNotNull, isNull }) =>
      and(
        eqOp(s.groupId, groupId),
        isNotNull(s.published),
        isNull(s.inReplyToId),
        visibleGroupStatuses(viewerGroupIds),
        notExpired(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      group: GROUP_WITH,
      ...(viewerActorId && {
        likes: {
          where: eq(socialLikes.actorId, viewerActorId),
          columns: { id: true },
        },
      }),
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { statuses: items.map(toStatus), nextCursor };
}

/**
 * Get public timeline (local posts with public visibility).
 */
export async function getPublicTimeline(
  viewerActorId?: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const viewerGroupIds = await getViewerGroupIds(viewerActorId);

  const rows = await db.query.socialStatuses.findMany({
    where: (s, { and, isNotNull, isNull }) =>
      and(
        isNotNull(s.published),
        isNull(s.inReplyToId),
        jsonbArrayContains(socialStatuses.recipientTo, PUBLIC),
        // Public addressing already excludes private group posts, so this is
        // belt and braces — but the two conditions are independent, and the
        // day someone posts a PUBLIC-addressed note into a private group this
        // is the line that keeps the town square from being the leak.
        visibleGroupStatuses(viewerGroupIds),
        notExpired(),
        excludeStories(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      group: GROUP_WITH,
      ...(viewerActorId && {
        likes: {
          where: eq(socialLikes.actorId, viewerActorId),
          columns: { id: true },
        },
      }),
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
    // Filter to local actors only (domain = socialConfig.domain)
    extras: {
      domainFilter: sql<string>`1`.as('_'),
    },
  });

  // Post-filter to local actors only (Drizzle doesn't support nested where on relations in findMany)
  const localRows = rows.filter((r) => r.actor.domain === socialConfig.domain);

  const hasMore = localRows.length > limit;
  const items = hasMore ? localRows.slice(0, limit) : localRows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { statuses: items.map(toStatus), nextCursor };
}

/**
 * Get received direct messages (inbox) for an actor.
 */
export async function getReceivedDirectMessages(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const actor = await db.query.socialActors.findFirst({
    where: eq(socialActors.id, actorId),
    columns: { uri: true },
  });

  if (!actor) {
    return { statuses: [], nextCursor: null };
  }

  const rows = await db.query.socialStatuses.findMany({
    where: (s, { and, isNotNull, ne }) =>
      and(
        isNotNull(s.published),
        ne(s.actorId, actorId),
        jsonbArrayContains(socialStatuses.recipientTo, actor.uri),
        sql`NOT (${jsonbArrayContains(socialStatuses.recipientTo, PUBLIC)} OR ${jsonbArrayContains(socialStatuses.recipientCc, PUBLIC)})`,
        // "Not publicly addressed" is how this view finds DMs, and it is also
        // true of every private group post. Membership content is not mail.
        personalStatusesOnly(),
        notExpired(),
        excludeStories(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      likes: {
        where: eq(socialLikes.actorId, actorId),
        columns: { id: true },
      },
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { statuses: items.map(toStatus), nextCursor };
}

/**
 * Get sent direct messages for an actor.
 */
export async function getSentDirectMessages(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const rows = await db.query.socialStatuses.findMany({
    where: (s, { and, eq, isNotNull }) =>
      and(
        eq(s.actorId, actorId),
        isNotNull(s.published),
        sql`NOT (${jsonbArrayContains(socialStatuses.recipientTo, PUBLIC)} OR ${jsonbArrayContains(socialStatuses.recipientCc, PUBLIC)})`,
        // Same reason as the inbox, and this one bites immediately: without
        // it, every private group post you write turns up in your own Sent
        // messages, because it is by definition not publicly addressed.
        personalStatusesOnly(),
        notExpired(),
        // Load-bearing, not defensive. A story is addressed followers-only, so
        // it satisfies this query's "not public" test and would otherwise be
        // listed here as a direct message the author never sent.
        excludeStories(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      likes: {
        where: eq(socialLikes.actorId, actorId),
        columns: { id: true },
      },
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { statuses: items.map(toStatus), nextCursor };
}

/**
 * Get all posts that "@" a user (mentions + DMs).
 */
export async function getAtMeTimeline(
  actorId: string,
  cursor?: string,
  limit: number = 20
): Promise<TimelineResult> {
  const actor = await db.query.socialActors.findFirst({
    where: eq(socialActors.id, actorId),
    columns: { uri: true },
  });

  if (!actor) {
    return { statuses: [], nextCursor: null };
  }

  const viewerGroupIds = await getViewerGroupIds(actorId);

  const rows = await db.query.socialStatuses.findMany({
    where: (s, { and, isNotNull, ne }) =>
      and(
        isNotNull(s.published),
        ne(s.actorId, actorId),
        or(
          jsonbArrayContains(socialStatuses.recipientTo, actor.uri),
          sql`EXISTS (
            SELECT 1 FROM social_tags st
            WHERE st.status_id = ${socialStatuses.id}
            AND st.type = 'Mention'
            AND st.href = ${actor.uri}
          )`
        ),
        // A mention is an invitation to read the post, so without this a
        // non-member is handed private group content by being named in it.
        visibleGroupStatuses(viewerGroupIds),
        notExpired(),
        excludeStories(),
        cursor ? sql`${s.id} < ${cursor}` : undefined
      ),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      group: GROUP_WITH,
      likes: {
        where: eq(socialLikes.actorId, actorId),
        columns: { id: true },
      },
    },
    orderBy: (s, { desc }) => [desc(s.published), desc(s.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { statuses: items.map(toStatus), nextCursor };
}

/**
 * Get a single status with like status for viewer.
 *
 * Returns null for a status the viewer may not read, so a permalink to a
 * private group post is a 404 to a non-member rather than a 403 — a 403 would
 * confirm the post exists, which is half of what the group was keeping.
 */
export async function getStatusWithLikeStatus(
  statusId: string,
  viewerActorId?: string
): Promise<StatusWithActorAndLike | null> {
  const row = await db.query.socialStatuses.findFirst({
    // Expiry and the story exclusion are applied here, not just in the
    // timelines. This is the permalink read, and a status that has dropped out
    // of every feed but still answers on its own URL is only soft-deleted in
    // the feeds -- the link keeps working, and for an expired DM that is the
    // whole of the deletion. Stories are excluded on top because they have no
    // permalink by design: they are watched in the viewer or not at all.
    where: and(eq(socialStatuses.id, statusId), notExpired(), excludeStories()),
    with: {
      actor: ACTOR_WITH,
      attachments: true,
      group: GROUP_WITH,
      ...(viewerActorId && {
        likes: {
          where: eq(socialLikes.actorId, viewerActorId),
          columns: { id: true },
        },
      }),
    },
  });

  if (!row) return null;
  if (!(await canViewStatusGroup(row.groupId, viewerActorId))) return null;

  return toStatus(row);
}

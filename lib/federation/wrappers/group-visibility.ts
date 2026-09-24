/**
 * Group Visibility
 *
 * One rule, written once, for the question every path that reads
 * `social_statuses` has to ask: may this viewer see this post?
 *
 * The rule itself is small:
 *
 * - `group_id IS NULL` — an ordinary personal post. Whatever rules already
 *   governed it still govern it; groups have no opinion.
 * - the group is **public** — anyone may read it, including a signed-out
 *   visitor and a crawler.
 * - the group is **private** — only an active member may read it. Membership
 *   *is* the authorization. There is no addressing trick that substitutes for
 *   it, which is precisely why this cannot be folded into the existing
 *   public-addressing checks.
 *
 * ## Why this is a module and not three lines at each call site
 *
 * `docs/GROUPS-ROADMAP.md` calls private group leakage the highest-severity
 * risk in the feature, for a reason worth restating: the failure is silent and
 * it is unrecoverable. A private post rendered once to a non-member cannot be
 * un-rendered, and if it escaped through the federation outbox then remote
 * servers already have it and no fix here reaches them.
 *
 * There are twelve read paths across `timeline.ts`, `status.ts` and the outbox
 * route. Twelve hand-written copies of a security predicate is twelve chances
 * to write `OR` where `AND` belongs, and the eleven correct copies give no
 * warning about the twelfth. So the predicate lives here, each caller spends
 * one line on it, and a reviewer can check the rule in one place and then only
 * has to confirm the line is *present* everywhere else.
 *
 * The directory's account-type gate had to be repaired in four separate places
 * because it was written four times. This is the same shape of mistake with a
 * much worse blast radius.
 *
 * @see docs/GROUPS-ROADMAP.md — Feed Integration, Risks & Open Questions
 */

import { db } from '@/lib/db';
import { socialGroupMembers, socialStatuses } from '@/lib/schema';
import { and, eq, sql, type SQL } from 'drizzle-orm';

/**
 * Every group the viewer may read private posts from.
 *
 * `status = 'active'` is the whole gate. A `pending` request has not been let
 * in yet and a `banned` row is the record of someone being removed — treating
 * either as membership would hand the content to exactly the two people the
 * group already decided should not have it.
 *
 * Returns `[]` for a signed-out viewer, which is not a special case anywhere
 * downstream: it simply means no private group matches, leaving public groups
 * and personal posts, which is the correct answer for a stranger.
 */
export async function getViewerGroupIds(
  viewerActorId?: string | null
): Promise<string[]> {
  if (!viewerActorId) return [];

  const rows = await db
    .select({ groupId: socialGroupMembers.groupId })
    .from(socialGroupMembers)
    .where(
      and(
        eq(socialGroupMembers.actorId, viewerActorId),
        eq(socialGroupMembers.status, 'active')
      )
    );

  return rows.map((r) => r.groupId);
}

/**
 * Render a string list as a Postgres text array.
 *
 * The empty case is spelled out rather than handled by the caller because the
 * obvious construction — `sql.join` over an empty list — produces `ARRAY[]`
 * with no element type, which Postgres rejects. An empty viewer list is the
 * single most common input here (every signed-out request), so the path that
 * must not break is the one that would have broken.
 */
function textArray(values: string[]): SQL {
  if (values.length === 0) return sql`ARRAY[]::text[]`;
  return sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `
  )}]::text[]`;
}

/**
 * The predicate. Add it to the `WHERE` of anything that reads statuses.
 *
 * Written as a correlated `EXISTS` against `social_groups` rather than by
 * pre-loading every public group id, because the number of public groups is
 * unbounded and grows with the product, while this subquery is a primary-key
 * lookup on a row we already have the id for.
 *
 * Safe by construction for the default caller: pass nothing and you get
 * "personal posts and public groups", which is what an anonymous reader should
 * see. There is no argument that makes this *more* permissive than the
 * viewer's real membership.
 */
export function visibleGroupStatuses(viewerGroupIds: string[] = []): SQL {
  return sql`(
    ${socialStatuses.groupId} IS NULL
    OR EXISTS (
      SELECT 1 FROM social_groups g
      WHERE g.id = ${socialStatuses.groupId}
        AND (g.visibility = 'public' OR g.id = ANY(${textArray(viewerGroupIds)}))
    )
  )`;
}

/**
 * The stricter variant: personal posts only, no group content at all.
 *
 * Used where group posts do not belong *regardless* of who is asking — the
 * federation outbox, and the direct-message views. It is a different question
 * from `visibleGroupStatuses` ("may this viewer see it?") and conflating the
 * two is how a public group's posts end up federating before group federation
 * has been designed.
 */
export function personalStatusesOnly(): SQL {
  return sql`${socialStatuses.groupId} IS NULL`;
}

/**
 * Resolve visibility for a single status the caller already has in hand.
 *
 * The list-oriented predicate above cannot help a permalink, which reads one
 * row by id and then has to decide. Kept here so the decision is made against
 * the same rule rather than re-derived.
 */
export async function canViewStatusGroup(
  groupId: string | null,
  viewerActorId?: string | null
): Promise<boolean> {
  if (!groupId) return true;

  const group = await db.query.socialGroups.findFirst({
    where: (g, { eq: eqOp }) => eqOp(g.id, groupId),
    columns: { id: true, visibility: true },
  });

  // A status pointing at a group that no longer exists is not a status anyone
  // should be reading. The FK cascades on delete, so this is defensive only.
  if (!group) return false;
  if (group.visibility === 'public') return true;
  if (!viewerActorId) return false;

  const membership = await db.query.socialGroupMembers.findFirst({
    where: (m, { and: andOp, eq: eqOp }) =>
      andOp(
        eqOp(m.groupId, groupId),
        eqOp(m.actorId, viewerActorId),
        eqOp(m.status, 'active')
      ),
    columns: { id: true },
  });

  return Boolean(membership);
}

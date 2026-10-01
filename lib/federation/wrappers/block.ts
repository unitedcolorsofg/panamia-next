/**
 * Block and Mute
 *
 * Pana Social accepts every follow immediately â€” there is no approval step â€”
 * which is the right default for a network built on local connection but means
 * "no approval" turns into "no recourse" without an escape hatch. This is that
 * hatch, and in a geographically local network it carries more weight than in a
 * global one: the people here are the people you will run into at Calle Ocho.
 *
 * Two tools, one table, deliberately different:
 *
 *   block  severs follows in both directions, prevents re-following, and
 *          removes each actor from the other's view. Safety.
 *   mute   leaves every follow intact and changes only what the muting actor
 *          sees. Volume, not safety â€” "I like you, I cannot take your posting
 *          rate." It is the tool people reach for most, because it lets you
 *          stay connected to a neighbour you will see on Saturday.
 *
 * Neither is announced to the other party.
 *
 * Enforcement is LOCAL ONLY. ActivityPub has a Block activity, but remote
 * servers are free to ignore it and delivering one announces the block to the
 * instance you are trying to get away from. We control what this server shows
 * and delivers, and the UI says exactly that rather than implying more.
 *
 * @see docs/SOCIAL-GRAPH.md section B
 */

import { db } from '@/lib/db';
import { socialBlocks } from '@/lib/schema';
import type { SocialBlock, SocialBlockKind } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { deleteFollow } from './follow';

// The read side lives in ./block-filter so that ./follow and the timeline
// queries can filter on blocks without importing this module, which depends on
// ./follow for deleteFollow. Re-exported here so callers have one obvious
// import for "blocks".
export {
  getHiddenActorIds,
  isBlockedEitherWay,
  filterHiddenActorIds,
  getViewerBlockState,
} from './block-filter';

export type BlockedActorSummary = {
  id: string;
  username: string;
  domain: string;
  name: string | null;
  iconUrl: string | null;
};

export type BlockResult =
  { success: true; block: SocialBlock } | { success: false; error: string };

/**
 * Block or mute an actor.
 *
 * Blocking severs follows in both directions. We route that through
 * deleteFollow rather than deleting the rows here so the cached
 * followersCount / followingCount on both actors stay correct â€” those counters
 * are maintained by hand, and a direct delete would leave them overstated
 * forever with no way to tell which blocks caused the drift.
 *
 * Muting deliberately does not touch follows. If a mute severed them it would
 * be a quiet unfollow, the muted actor would see their follower count drop, and
 * the whole point of mute being invisible would be lost.
 */
export async function createBlock(
  actorId: string,
  targetActorId: string,
  kind: SocialBlockKind
): Promise<BlockResult> {
  if (actorId === targetActorId) {
    return {
      success: false,
      error:
        kind === 'block' ? 'Cannot block yourself' : 'Cannot mute yourself',
    };
  }

  const existing = await db.query.socialBlocks.findFirst({
    where: and(
      eq(socialBlocks.actorId, actorId),
      eq(socialBlocks.targetActorId, targetActorId),
      eq(socialBlocks.kind, kind)
    ),
  });

  if (existing) {
    return { success: true, block: existing };
  }

  const [block] = await db
    .insert(socialBlocks)
    .values({ actorId, targetActorId, kind })
    .returning();

  if (kind === 'block') {
    // Both directions. Blocking someone who follows you is the common case and
    // the one that actually matters.
    await Promise.all([
      deleteFollow(actorId, targetActorId),
      deleteFollow(targetActorId, actorId),
    ]);
  }

  return { success: true, block };
}

/**
 * Remove a block or a mute.
 *
 * Scoped to the kind on purpose: unblocking someone you had also muted should
 * not silently unmute them. The two rows are independent records of two
 * independent decisions.
 *
 * Severed follows are not restored. We do not keep a record of what was severed
 * and reconstructing it would re-create a relationship the blocker ended; if
 * they want it back they can follow again.
 */
export async function removeBlock(
  actorId: string,
  targetActorId: string,
  kind: SocialBlockKind
): Promise<{ success: boolean }> {
  await db
    .delete(socialBlocks)
    .where(
      and(
        eq(socialBlocks.actorId, actorId),
        eq(socialBlocks.targetActorId, targetActorId),
        eq(socialBlocks.kind, kind)
      )
    );

  return { success: true };
}

/**
 * The viewer's own block or mute list, for the settings screen.
 *
 * Only outgoing rows: you may see who you have blocked, never who has blocked
 * you. Exposing the latter would turn the block list into a notification.
 */
export async function listBlocks(
  viewerActorId: string,
  kind: SocialBlockKind
): Promise<Array<{ block: SocialBlock; actor: BlockedActorSummary }>> {
  const rows = await db.query.socialBlocks.findMany({
    where: and(
      eq(socialBlocks.actorId, viewerActorId),
      eq(socialBlocks.kind, kind)
    ),
    with: {
      targetActor: {
        columns: {
          id: true,
          username: true,
          domain: true,
          name: true,
          iconUrl: true,
        },
      },
    },
    orderBy: (blocks, { desc }) => [desc(blocks.createdAt)],
  });

  return rows.map((row) => ({
    block: {
      id: row.id,
      createdAt: row.createdAt,
      actorId: row.actorId,
      targetActorId: row.targetActorId,
      kind: row.kind,
    },
    actor: row.targetActor,
  }));
}

/**
 * Nightly sweep for data that has passed its expiry.
 *
 * Expiry in this codebase is a *read filter*, not a delete. `notExpired()` in
 * lib/federation/wrappers/timeline.ts hides rows whose `expiresAt` has passed,
 * so an expired story or DM is invisible everywhere -- but the row is still in
 * Postgres and its photo is still in R2, forever. That is the gap this closes.
 *
 * WHAT THIS DOES NOT TOUCH: expired direct messages.
 *
 * DMs use the same `expiresAt` mechanism and have exactly the same orphaned-
 * media problem, so sweeping them here would be a one-line change. It is left
 * out on purpose. A story is disposable by design and its author was told it
 * lasts a day; a DM is a conversation someone had, and status.ts calls the
 * 7-day expiry a "soft delete" deliberately. Turning that into a hard delete
 * is a product decision about someone else's messages, not a cleanup detail,
 * so it does not get made by a job whose name is "purge expired". If it is
 * wanted later it belongs behind its own explicit switch.
 */

import { db } from '@/lib/db';
import { socialStatuses, socialAttachments, STATUS_TYPE_STORY } from '@/lib/schema';
import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import { deleteFile } from '@/lib/blob/api';
import { cleanupExpiredNotifications } from '@/lib/notifications';

/**
 * Most expired stories to handle in one run.
 *
 * Bounded because this runs in a Worker with a wall-clock budget and each
 * story costs an R2 round trip. A backlog drains over successive nights
 * rather than timing out the run and draining none of it.
 */
const DEFAULT_STORY_BATCH = 200;

export interface PurgeReport {
  storiesDeleted: number;
  mediaDeleted: number;
  /** Stories left in place because their media could not be removed. */
  storiesDeferred: number;
  notificationsDeleted: number;
  errors: string[];
}

/**
 * Delete expired stories and the R2 objects behind them.
 *
 * Order matters: the attachment row is removed by the FK cascade when the
 * status goes, which means the media URL is gone too. Read the URLs and clear
 * R2 first, or the object is orphaned with nothing left pointing at it.
 *
 * A story whose media cannot be deleted is left alone rather than having its
 * row removed anyway. Deleting the row would orphan the object permanently --
 * precisely the bug this exists to fix -- whereas leaving it costs one
 * invisible row and one retry per night, and fixes itself if R2 recovers.
 */
export async function purgeExpiredStories(
  limit: number = DEFAULT_STORY_BATCH
): Promise<Pick<PurgeReport, 'storiesDeleted' | 'mediaDeleted' | 'storiesDeferred' | 'errors'>> {
  const errors: string[] = [];

  const expired = await db
    .select({
      id: socialStatuses.id,
      url: socialAttachments.url,
      previewUrl: socialAttachments.previewUrl,
    })
    .from(socialStatuses)
    .leftJoin(
      socialAttachments,
      eq(socialAttachments.statusId, socialStatuses.id)
    )
    .where(
      and(
        eq(socialStatuses.type, STATUS_TYPE_STORY),
        lt(socialStatuses.expiresAt, new Date())
      )
    )
    .orderBy(asc(socialStatuses.expiresAt))
    .limit(limit);

  if (expired.length === 0) {
    return {
      storiesDeleted: 0,
      mediaDeleted: 0,
      storiesDeferred: 0,
      errors,
    };
  }

  // The join yields one row per attachment, so a story with several collapses
  // into one entry holding all of its URLs.
  const byStatus = new Map<string, string[]>();
  for (const row of expired) {
    const urls = byStatus.get(row.id) ?? [];
    // `remoteUrl` is deliberately absent: it points at another server's copy,
    // which is not ours to delete. deleteFile() would skip it anyway.
    if (row.url) urls.push(row.url);
    if (row.previewUrl) urls.push(row.previewUrl);
    byStatus.set(row.id, urls);
  }

  const deletable: string[] = [];
  let mediaDeleted = 0;
  let storiesDeferred = 0;

  for (const [statusId, urls] of byStatus) {
    let allCleared = true;

    for (const url of urls) {
      // Returns true for a URL outside our bucket, which is the right answer:
      // there is nothing to reclaim and nothing to retry.
      const ok = await deleteFile(url);
      if (ok) {
        mediaDeleted += 1;
      } else {
        allCleared = false;
        errors.push(`R2 delete failed for story ${statusId}: ${url}`);
      }
    }

    if (allCleared) {
      deletable.push(statusId);
    } else {
      storiesDeferred += 1;
    }
  }

  let storiesDeleted = 0;
  if (deletable.length > 0) {
    // Attachments and story-view rows both cascade from the status.
    //
    // The type and expiry predicates are re-asserted rather than trusting the
    // id list alone. They were true when these rows were selected and they
    // cost nothing to repeat; if a bug ever let a non-story id into that
    // list, this is what stops the delete from landing on a real post.
    const deleted = await db
      .delete(socialStatuses)
      .where(
        and(
          eq(socialStatuses.type, STATUS_TYPE_STORY),
          lt(socialStatuses.expiresAt, new Date()),
          inArray(socialStatuses.id, deletable)
        )
      )
      .returning({ id: socialStatuses.id });
    storiesDeleted = deleted.length;
  }

  return { storiesDeleted, mediaDeleted, storiesDeferred, errors };
}

/**
 * Run the whole sweep. Safe to call repeatedly; every step is idempotent.
 */
export async function runExpiryPurge(
  options: { storyBatch?: number } = {}
): Promise<PurgeReport> {
  const stories = await purgeExpiredStories(options.storyBatch);

  let notificationsDeleted = 0;
  const errors = [...stories.errors];

  try {
    notificationsDeleted = await cleanupExpiredNotifications();
  } catch (err) {
    // A notifications failure must not discard the story results already
    // committed above.
    errors.push(
      `notification cleanup failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return {
    storiesDeleted: stories.storiesDeleted,
    mediaDeleted: stories.mediaDeleted,
    storiesDeferred: stories.storiesDeferred,
    notificationsDeleted,
    errors,
  };
}

/**
 * Hourly sweep for data that has passed its expiry.
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
import {
  socialStatuses,
  socialAttachments,
  STATUS_TYPE_STORY,
} from '@/lib/schema';
import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import { deleteFiles } from '@/lib/blob/api';
import { cleanupExpiredNotifications } from '@/lib/notifications';

/**
 * Most expired stories to handle in one run.
 *
 * Bounded because this runs in a Worker, not because R2 is the constraint any
 * more: a batch of this size is two delete calls (the binding carries 1000
 * keys each) plus three Postgres statements, whichever way the media falls.
 *
 * Sized against the cron, which runs hourly -- 24,000 stories a day, roughly
 * ten times what a 200,000-member community is modelled to produce. Headroom
 * is the point: a backlog has to drain faster than it fills or it never
 * drains at all, and story-view rows only cascade away once the story does.
 */
const DEFAULT_STORY_BATCH = 1000;

/**
 * Consecutive per-story failures before the retry pass gives up for this run.
 *
 * The retry pass exists to find the one bad object in a failed batch. If R2
 * is down instead, every story fails and retrying each one in turn is a few
 * thousand pointless round trips and an error list to match. Ten in a row is
 * not one stuck object, so the rest are deferred to the next run untried.
 */
const DEFER_AFTER_CONSECUTIVE_FAILURES = 10;

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
 * Read in two queries rather than one join. The limit has to bound *stories*,
 * and a join yields one row per attachment: a story straddling the boundary
 * would be read with only part of its media visible, counted as fully
 * cleared, and deleted -- orphaning whatever fell past the cut, which is the
 * exact failure this job exists to prevent.
 *
 * A story whose media cannot be deleted is left alone rather than having its
 * row removed anyway. Deleting the row would orphan the object permanently --
 * precisely the bug this exists to fix -- whereas leaving it costs one
 * invisible row and one retry per run, and fixes itself if R2 recovers.
 */
export async function purgeExpiredStories(
  limit: number = DEFAULT_STORY_BATCH
): Promise<
  Pick<
    PurgeReport,
    'storiesDeleted' | 'mediaDeleted' | 'storiesDeferred' | 'errors'
  >
> {
  const errors: string[] = [];

  const expired = await db
    .select({ id: socialStatuses.id })
    .from(socialStatuses)
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

  const storyIds = expired.map((row) => row.id);

  // Seeded with every id, so a story that never had an attachment is still a
  // candidate: there is nothing of it in R2, so there is nothing to defer.
  const byStatus = new Map<string, string[]>(storyIds.map((id) => [id, []]));

  const attachments = await db
    .select({
      statusId: socialAttachments.statusId,
      url: socialAttachments.url,
      previewUrl: socialAttachments.previewUrl,
    })
    .from(socialAttachments)
    .where(inArray(socialAttachments.statusId, storyIds));

  for (const row of attachments) {
    const urls = byStatus.get(row.statusId);
    if (!urls) continue;
    // `remoteUrl` is deliberately absent: it points at another server's copy,
    // which is not ours to delete. deleteFiles() would skip it anyway.
    if (row.url) urls.push(row.url);
    if (row.previewUrl) urls.push(row.previewUrl);
  }

  const deletable: string[] = [];
  let mediaDeleted = 0;
  let storiesDeferred = 0;

  // One call for the whole batch first. This is the normal outcome, and it is
  // the difference between two round trips per run and two per story.
  const bulk = await deleteFiles(Array.from(byStatus.values()).flat());

  if (bulk.ok) {
    deletable.push(...byStatus.keys());
    mediaDeleted = bulk.deleted;
  } else {
    // A batch delete reports no per-key outcome, so the only way to learn
    // which story is stuck is to ask again one story at a time. Re-deleting
    // keys the failed batch already removed is harmless -- deleting a key
    // that is not there succeeds -- so this costs accuracy, not correctness.
    let consecutiveFailures = 0;

    for (const [statusId, urls] of byStatus) {
      if (consecutiveFailures >= DEFER_AFTER_CONSECUTIVE_FAILURES) {
        storiesDeferred += 1;
        continue;
      }

      const result = await deleteFiles(urls);
      if (result.ok) {
        deletable.push(statusId);
        mediaDeleted += result.deleted;
        consecutiveFailures = 0;
      } else {
        storiesDeferred += 1;
        consecutiveFailures += 1;
        errors.push(`R2 delete failed for story ${statusId}`);
        if (consecutiveFailures === DEFER_AFTER_CONSECUTIVE_FAILURES) {
          errors.push(
            `R2 looks unavailable after ${DEFER_AFTER_CONSECUTIVE_FAILURES} consecutive failures; deferring the rest of this run`
          );
        }
      }
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

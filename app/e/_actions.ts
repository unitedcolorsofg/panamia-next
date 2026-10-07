'use server';

/**
 * The correction loop behind "Not for me".
 *
 * The discovery page states why each event is in front of you. A stated reason
 * has to be arguable or it is decoration, and this is the argument back.
 *
 * These are deliberately thin. All the judgement about what a dismissal *means*
 * lives in lib/events/discovery.ts, where it can be read next to the reasons it
 * answers; this file only writes the row down and tells the page to re-render.
 */

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { eventDismissals, profiles } from '@/lib/schema';

async function viewerProfileId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
    columns: { id: true },
  });
  return profile?.id ?? null;
}

/**
 * Hide an event from this pana's discovery page.
 *
 * `reasonKind` is what the page claimed when they disagreed -- see the
 * docblock on the table for why the claim is worth storing and a bare downvote
 * is not.
 *
 * Silently succeeds when signed out. The control is only rendered to signed-in
 * panas, so reaching here without a profile means a stale tab or a replayed
 * request, and neither is worth an error dialog over a preference.
 */
export async function dismissEvent(eventId: string, reasonKind: string | null) {
  const profileId = await viewerProfileId();
  if (!profileId) return;

  await db
    .insert(eventDismissals)
    .values({ profileId, eventId, reasonKind })
    .onConflictDoNothing();

  revalidatePath('/e');
}

/** Put it back. The undo in the banner; the reason the banner can promise
 *  anything at all is that this is cheap and immediate. */
export async function undismissEvent(eventId: string) {
  const profileId = await viewerProfileId();
  if (!profileId) return;

  await db
    .delete(eventDismissals)
    .where(
      and(
        eq(eventDismissals.profileId, profileId),
        eq(eventDismissals.eventId, eventId)
      )
    );

  revalidatePath('/e');
}

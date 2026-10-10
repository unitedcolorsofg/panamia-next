/**
 * GET /api/social/actors/me/calendar - What this pana has coming up
 *
 * Only ever about the caller, like /me/groups: the profile and actor ids come
 * from the session, so there is no parameter that could be pointed at somebody
 * else. That matters more here than on most routes, because the committed half
 * of this response deliberately includes unlisted events and `maybe` RSVPs —
 * rows a pana shared with an organiser, not with the public. There is no
 * version of this endpoint that takes a username, and there should not be one.
 *
 * Returns two lists rather than one merged feed. See lib/calendar.ts for why.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { getPersonalCalendar } from '@/lib/calendar';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const profile = await getActiveProfileWithActor(session.user.id);

  /* No profile is an empty calendar rather than an error, for the same reason
     /me/groups returns an empty list: the rail renders this inline, and a 403
     would turn "nothing coming up" into an error state on a working account. */
  if (!profile) {
    return NextResponse.json({
      success: true,
      data: { committed: [], suggested: [] },
    });
  }

  const calendar = await getPersonalCalendar({
    profileId: profile.id,
    actorId: profile.socialActor?.id ?? null,
  });

  return NextResponse.json({ success: true, data: calendar });
}

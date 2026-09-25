/**
 * GET /api/social/actors/[username]/events - a pana's events
 *
 * Two lists with two audiences, the same split the Panas endpoint draws:
 *
 *   hosting — public. The event page already names its host, so repeating it
 *             on the host's profile discloses nothing new.
 *   going   — the owner's own view only. See getProfileEventsFeed for why
 *             publishing someone's RSVPs is a decision that needs a visibility
 *             column and a setting, not a query change.
 *
 * `canSeeAttending` is returned so the tab can tell "this pana has nothing
 * coming up" apart from "you are not the one who gets to see that", which
 * otherwise render identically as an empty list.
 *
 * This is a route rather than a server fetch on the page because /p/[user] is
 * edge-cached for 300s and must stay session-free: anything viewer-dependent
 * rendered server-side would be handed to the next five minutes of visitors.
 *
 * @see app/api/social/groups/[handle]/events/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPublicProfile } from '@/lib/server/profile';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { getProfileEventsFeed } from '@/lib/event';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const profile = await getPublicProfile(username);

  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Profile not found' },
      { status: 404 }
    );
  }

  const session = await auth();
  const viewer = session?.user?.id
    ? await getActiveProfileWithActor(session.user.id)
    : null;
  const isSelf = viewer?.id === profile.id;

  const rows = await getProfileEventsFeed(profile.id, {
    includeAttending: isSelf,
  });

  return NextResponse.json({
    success: true,
    data: {
      canSeeAttending: isSelf,
      events: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        timezone: row.timezone,
        role: row.role,
        online: row.mode === 'online',
        visibility: row.visibility,
        attendeeCount: row.attendeeCount,
        coverImage: row.coverImage,
        coverImageAlt: row.coverImageAlt,
        venue: row.venue,
      })),
    },
  });
}

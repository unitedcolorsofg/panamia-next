/**
 * GET /api/social/groups/[handle]/events - A group's events
 *
 * The read right is the group's, not the event's: if you may not read the
 * group you get an empty list, the same answer the posts timeline gives a
 * stranger looking at a private group. Saying "0 events" rather than "403"
 * keeps the endpoint from confirming there was something to miss.
 *
 * Within a readable group, managers additionally see drafts and unlisted
 * events, because those are exactly the ones they still have work to do on.
 *
 * @see app/api/social/groups/[handle]/posts/route.ts
 * @see docs/GROUPS-ROADMAP.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { getGroupByHandle, getMembership } from '@/lib/federation';
import { getEventsForGroup } from '@/lib/event';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const found = await getGroupByHandle(handle);
  if (!found) {
    return NextResponse.json(
      { success: false, error: 'Group not found' },
      { status: 404 }
    );
  }

  const session = await auth();
  const profile = session?.user?.id
    ? await getActiveProfileWithActor(session.user.id)
    : null;
  const viewerActorId = profile?.socialActor?.id ?? null;

  const membership = viewerActorId
    ? await getMembership(found.group.id, viewerActorId)
    : null;
  const isActiveMember = membership?.status === 'active';

  // Same rule as the group endpoint's canRead, and it must stay the same rule.
  const canRead = found.group.visibility === 'public' || isActiveMember;
  if (!canRead) {
    return NextResponse.json({ success: true, data: { events: [] } });
  }

  const isManager =
    isActiveMember &&
    (membership.role === 'admin' || membership.role === 'moderator');

  const rows = await getEventsForGroup(found.group.id, {
    includeUnpublished: isManager,
  });

  return NextResponse.json({
    success: true,
    data: {
      events: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        status: row.status,
        visibility: row.visibility,
        mode: row.mode,
        attendeeCount: row.attendeeCount,
        venue: row.venue,
      })),
    },
  });
}

/**
 * /api/social/groups/events
 *
 * GET - What groups have coming up, across all of them.
 *
 * Distinct from /api/social/groups/[handle]/events, which answers "what is
 * this group doing" for a group page. This one answers "what are groups
 * doing" for the groups landing page, and every row names its host because
 * that is the entire argument for the shelf -- an events list that did not
 * name the group would just be /events with fewer rows.
 *
 * Only public groups, and only published public events. The group search
 * route deliberately lists private groups so they can be asked to join;
 * their calendar is a different matter, and an event row names a time and a
 * place.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listUpcomingGroupEvents } from '@/lib/server/group-search';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');

  // Clamped inside listUpcomingGroupEvents, same position as the sibling
  // routes: a malformed query string falls back rather than 400-ing a page.
  const limit = limitParam ? Number(limitParam) : undefined;

  const events = await listUpcomingGroupEvents(limit);

  return NextResponse.json({ success: true, data: { events } });
}

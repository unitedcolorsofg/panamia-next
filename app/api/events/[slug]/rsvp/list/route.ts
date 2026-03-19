import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  events,
  eventAttendees,
  eventOrganizers,
  profiles,
} from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const session = await auth();

    const event = await db.query.events.findFirst({
      where: eq(events.slug, slug),
    });
    if (!event)
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );

    const isPublic =
      event.status === 'published' && event.visibility === 'public';
    if (!isPublic && !session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let callerProfile = null;
    if (session?.user?.id) {
      callerProfile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, session.user.id),
      });
    }

    // Check if caller is an organizer with canSeeRsvpList
    let canSeeFullList = session?.user?.isAdmin || false;
    if (callerProfile && !canSeeFullList) {
      const org = await db.query.eventOrganizers.findFirst({
        where: and(
          eq(eventOrganizers.eventId, event.id),
          eq(eventOrganizers.profileId, callerProfile.id),
          eq(eventOrganizers.canSeeRsvpList, true)
        ),
      });
      canSeeFullList = !!org;
    }

    // Check if caller is an attendee
    const isAttendee = callerProfile
      ? !!(await db.query.eventAttendees.findFirst({
          where: and(
            eq(eventAttendees.eventId, event.id),
            eq(eventAttendees.profileId, callerProfile.id)
          ),
        }))
      : false;

    if (canSeeFullList) {
      // Full list with profile details
      const attendeeRows = await db.query.eventAttendees.findMany({
        where: eq(eventAttendees.eventId, event.id),
        with: { profile: { columns: { id: true, name: true } } },
        orderBy: (t, { desc }) => [desc(t.respondedAt)],
      });
      return NextResponse.json({
        success: true,
        data: { attendees: attendeeRows, visibility: 'full' },
      });
    } else if (isAttendee && isPublic) {
      // Names only
      const attendeeRows = await db.query.eventAttendees.findMany({
        where: eq(eventAttendees.eventId, event.id),
        with: { profile: { columns: { name: true } } },
      });
      return NextResponse.json({
        success: true,
        data: {
          attendees: attendeeRows.map((a) => ({
            status: a.status,
            name: a.profile?.name,
          })),
          visibility: 'names',
        },
      });
    } else {
      // Count only
      const [goingCount] = await db
        .select({ count: sql<string>`count(*)` })
        .from(eventAttendees)
        .where(
          and(
            eq(eventAttendees.eventId, event.id),
            eq(eventAttendees.status, 'going')
          )
        );
      const [maybeCount] = await db
        .select({ count: sql<string>`count(*)` })
        .from(eventAttendees)
        .where(
          and(
            eq(eventAttendees.eventId, event.id),
            eq(eventAttendees.status, 'maybe')
          )
        );
      return NextResponse.json({
        success: true,
        data: {
          going: Number(goingCount.count),
          maybe: Number(maybeCount.count),
          visibility: 'count',
        },
      });
    }
  } catch (error) {
    console.error('Error fetching RSVP list:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch RSVP list' },
      { status: 500 }
    );
  }
}

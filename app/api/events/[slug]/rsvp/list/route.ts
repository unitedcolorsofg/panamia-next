/**
 * Host-only attendee roster for an event. Returns verified attendees grouped by
 * status, for the manage UI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events, eventAttendees, profiles } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const [event, profile] = await Promise.all([
      db.query.events.findFirst({ where: eq(events.slug, slug) }),
      db.query.profiles.findFirst({
        where: eq(profiles.userId, session.user.id),
        columns: { id: true },
      }),
    ]);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }
    if (!profile || event.hostProfileId !== profile.id) {
      return NextResponse.json(
        { success: false, error: 'Only the host can view attendees' },
        { status: 403 }
      );
    }

    const attendees = await db.query.eventAttendees.findMany({
      where: eq(eventAttendees.eventId, event.id),
      orderBy: [desc(eventAttendees.respondedAt)],
      columns: {
        id: true,
        name: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
        respondedAt: true,
        profileId: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        attendees,
        counts: {
          going: attendees.filter(
            (a) => a.status === 'going' && a.emailVerifiedAt
          ).length,
          maybe: attendees.filter(
            (a) => a.status === 'maybe' && a.emailVerifiedAt
          ).length,
          pending: attendees.filter((a) => !a.emailVerifiedAt).length,
        },
      },
    });
  } catch (error) {
    console.error('Error listing attendees:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list attendees' },
      { status: 500 }
    );
  }
}

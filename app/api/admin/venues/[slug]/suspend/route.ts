import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { venues, events, eventAttendees } from '@/lib/schema';
import { eq, and, gt, inArray } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    if (!session.user.isAdmin)
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );

    const venue = await db.query.venues.findFirst({
      where: eq(venues.slug, slug),
    });
    if (!venue)
      return NextResponse.json(
        { success: false, error: 'Venue not found' },
        { status: 404 }
      );
    if (venue.status === 'suspended') {
      return NextResponse.json(
        { success: false, error: 'Venue is already suspended' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const suspensionReason = body.reason || 'Administrative action';
    const now = new Date();

    // Cascade: cancel all future published events at this venue
    const futureEvents = await db.query.events.findMany({
      where: and(
        eq(events.venueId, venue.id),
        eq(events.status, 'published'),
        gt(events.startsAt, now)
      ),
    });

    for (const event of futureEvents) {
      await db
        .update(events)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          cancelledBy: session.user.id,
          cancellationReason: `Venue suspended: ${suspensionReason}`,
        })
        .where(eq(events.id, event.id));

      // Notify going/maybe attendees
      const attendeeRows = await db.query.eventAttendees.findMany({
        where: and(
          eq(eventAttendees.eventId, event.id),
          inArray(eventAttendees.status, ['going', 'maybe'])
        ),
        with: { profile: { columns: { userId: true } } },
      });

      for (const a of attendeeRows) {
        if (a.profile?.userId) {
          await createNotification({
            type: 'Delete',
            actorId: session.user.id,
            targetId: a.profile.userId,
            context: 'event',
            objectId: event.id,
            objectType: 'event',
            objectTitle: event.title,
            objectUrl: `/e/${event.slug}`,
            message: `"${event.title}" has been cancelled because the venue was suspended.`,
          });
        }
      }
    }

    // Suspend the venue
    const [updated] = await db
      .update(venues)
      .set({
        status: 'suspended',
        suspendedAt: now,
        suspendedBy: session.user.id,
        suspensionReason,
      })
      .where(eq(venues.id, venue.id))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        slug: updated.slug,
        status: updated.status,
        eventsCancelled: futureEvents.length,
      },
    });
  } catch (error) {
    console.error('Error suspending venue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to suspend venue' },
      { status: 500 }
    );
  }
}

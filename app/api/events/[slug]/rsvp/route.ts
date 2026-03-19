import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events, eventAttendees, profiles } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

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
    if (!session.user.panaVerified)
      return NextResponse.json(
        { success: false, error: 'panaVerified required' },
        { status: 403 }
      );

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    });
    if (!profile)
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );

    const event = await db.query.events.findFirst({
      where: eq(events.slug, slug),
    });
    if (!event)
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    if (event.status !== 'published')
      return NextResponse.json(
        { success: false, error: 'Event is not available for RSVP' },
        { status: 400 }
      );

    const body = await request.json();
    const { status: newStatus } = body;
    if (!['going', 'maybe', 'not_going'].includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: 'status must be going, maybe, or not_going' },
        { status: 400 }
      );
    }

    const existing = await db.query.eventAttendees.findFirst({
      where: and(
        eq(eventAttendees.eventId, event.id),
        eq(eventAttendees.profileId, profile.id)
      ),
    });

    const wasGoing = existing?.status === 'going';
    const willBeGoing = newStatus === 'going';
    const now = new Date();

    await db.transaction(async (tx) => {
      // Check capacity
      if (willBeGoing && !wasGoing && event.attendeeCap !== null) {
        const currentEvent = await tx.query.events.findFirst({
          where: eq(events.id, event.id),
          columns: { attendeeCount: true, attendeeCap: true },
        });
        if (
          currentEvent &&
          currentEvent.attendeeCap !== null &&
          currentEvent.attendeeCount >= currentEvent.attendeeCap
        ) {
          throw new Error('SOLD_OUT');
        }
      }

      if (existing) {
        await tx
          .update(eventAttendees)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set({ status: newStatus as any, respondedAt: now, updatedAt: now })
          .where(eq(eventAttendees.id, existing.id));
      } else {
        await tx.insert(eventAttendees).values({
          id: createId(),
          createdAt: now,
          updatedAt: now,
          eventId: event.id,
          profileId: profile.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: newStatus as any,
          respondedAt: now,
        });
      }

      // Update attendeeCount (only 'going' counts)
      const delta = (willBeGoing ? 1 : 0) - (wasGoing ? 1 : 0);
      if (delta !== 0) {
        await tx
          .update(events)
          .set({ attendeeCount: sql`${events.attendeeCount} + ${delta}` })
          .where(eq(events.id, event.id));
      }
    });

    return NextResponse.json({ success: true, data: { status: newStatus } });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'SOLD_OUT') {
      return NextResponse.json(
        {
          success: false,
          error: 'This event is at capacity',
          code: 'SOLD_OUT',
        },
        { status: 409 }
      );
    }
    console.error('Error RSVPing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to RSVP' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    });
    if (!profile)
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );

    const event = await db.query.events.findFirst({
      where: eq(events.slug, slug),
    });
    if (!event)
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );

    const existing = await db.query.eventAttendees.findFirst({
      where: and(
        eq(eventAttendees.eventId, event.id),
        eq(eventAttendees.profileId, profile.id)
      ),
    });
    if (!existing)
      return NextResponse.json(
        { success: false, error: 'No RSVP found' },
        { status: 404 }
      );

    await db.transaction(async (tx) => {
      const wasGoing = existing.status === 'going';
      await tx.delete(eventAttendees).where(eq(eventAttendees.id, existing.id));
      if (wasGoing) {
        await tx
          .update(events)
          .set({ attendeeCount: sql`${events.attendeeCount} - 1` })
          .where(eq(events.id, event.id));
      }
    });

    return NextResponse.json({ success: true, message: 'RSVP withdrawn' });
  } catch (error) {
    console.error('Error withdrawing RSVP:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to withdraw RSVP' },
      { status: 500 }
    );
  }
}

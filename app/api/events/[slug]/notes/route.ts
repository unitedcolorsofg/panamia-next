import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  events,
  eventNotes,
  eventOrganizers,
  eventAttendees,
  profiles,
} from '@/lib/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

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

    const callerProfile = session?.user?.id
      ? await db.query.profiles.findFirst({
          where: eq(profiles.userId, session.user.id),
        })
      : null;

    // Determine caller's role
    const isOrganizer = callerProfile
      ? !!(await db.query.eventOrganizers.findFirst({
          where: and(
            eq(eventOrganizers.eventId, event.id),
            eq(eventOrganizers.profileId, callerProfile.id)
          ),
        }))
      : false;
    const isAttendee = callerProfile
      ? !!(await db.query.eventAttendees.findFirst({
          where: and(
            eq(eventAttendees.eventId, event.id),
            eq(eventAttendees.profileId, callerProfile.id),
            inArray(eventAttendees.status, ['going', 'maybe'])
          ),
        }))
      : false;

    // Filter notes by audience
    const notes = await db.query.eventNotes.findMany({
      where: eq(eventNotes.eventId, event.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      with: { author: { columns: { id: true, name: true } } },
    });

    const filtered = notes.filter((n) => {
      if (n.audience === 'organizers')
        return isOrganizer || session?.user?.isAdmin;
      if (n.audience === 'going')
        return isOrganizer || isAttendee || session?.user?.isAdmin;
      return true; // 'all'
    });

    return NextResponse.json({ success: true, data: { notes: filtered } });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
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

    const event = await db.query.events.findFirst({
      where: eq(events.slug, slug),
    });
    if (!event)
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    });
    if (!profile)
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );

    const isOrganizer = !!(await db.query.eventOrganizers.findFirst({
      where: and(
        eq(eventOrganizers.eventId, event.id),
        eq(eventOrganizers.profileId, profile.id)
      ),
    }));
    if (!isOrganizer && !session.user.isAdmin)
      return NextResponse.json(
        { success: false, error: 'Only organizers can post notes' },
        { status: 403 }
      );

    const body = await request.json();
    const { content, audience } = body;
    if (!content?.trim())
      return NextResponse.json(
        { success: false, error: 'content is required' },
        { status: 400 }
      );

    const validAudiences = ['all', 'going', 'organizers'];
    const now = new Date();
    const [newNote] = await db
      .insert(eventNotes)
      .values({
        id: createId(),
        createdAt: now,
        updatedAt: now,
        eventId: event.id,
        authorProfileId: profile.id,
        content: content.trim(),
        audience: validAudiences.includes(audience) ? audience : 'all',
      })
      .returning();

    return NextResponse.json(
      { success: true, data: { id: newNote.id, createdAt: newNote.createdAt } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error posting note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to post note' },
      { status: 500 }
    );
  }
}

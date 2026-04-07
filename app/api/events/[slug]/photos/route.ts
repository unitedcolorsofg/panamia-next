import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  events,
  eventPhotos,
  eventAttendees,
  eventOrganizers,
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
    const isAdmin = session?.user?.isAdmin || false;

    const event = await db.query.events.findFirst({
      where: eq(events.slug, slug),
    });
    if (!event)
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );

    const photos = await db.query.eventPhotos.findMany({
      where: isAdmin
        ? eq(eventPhotos.eventId, event.id)
        : and(
            eq(eventPhotos.eventId, event.id),
            eq(eventPhotos.approved, true)
          ),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      columns: {
        id: true,
        url: true,
        caption: true,
        approved: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: { photos } });
  } catch (error) {
    console.error('Error fetching photos:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}

// Phase 3 consent — archive threshold gate for event photos
// Event photos enter the community record 3 months after the event. The
// consent check should happen client-side (useModuleConsent + ConsentModal)
// before the upload is initiated. Server-side validation can additionally
// call hasConsent() from lib/consent.ts as a backstop:
//
// import { hasConsent } from '@/lib/consent';
//
// Inside POST handler, after auth check:
//   const consented = await hasConsent(session.user.id, 'terms', 'events', 0);
//   if (!consented) {
//     return NextResponse.json(
//       { success: false, error: 'Event terms consent required' },
//       { status: 403 }
//     );
//   }

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

    if (event.photoPolicy === 'prohibited') {
      return NextResponse.json(
        { success: false, error: 'Photos are not allowed for this event' },
        { status: 403 }
      );
    }

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    });
    if (!profile)
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );

    // Must be going or maybe attendee (or organizer)
    const isAttendee = !!(await db.query.eventAttendees.findFirst({
      where: and(
        eq(eventAttendees.eventId, event.id),
        eq(eventAttendees.profileId, profile.id),
        inArray(eventAttendees.status, ['going', 'maybe'])
      ),
    }));
    const isOrganizer = !!(await db.query.eventOrganizers.findFirst({
      where: and(
        eq(eventOrganizers.eventId, event.id),
        eq(eventOrganizers.profileId, profile.id)
      ),
    }));

    if (!isAttendee && !isOrganizer && !session.user.isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Must be an attendee or organizer to upload photos',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { url, caption } = body;
    if (!url)
      return NextResponse.json(
        { success: false, error: 'url is required' },
        { status: 400 }
      );

    const now = new Date();
    const [newPhoto] = await db
      .insert(eventPhotos)
      .values({
        id: createId(),
        createdAt: now,
        updatedAt: now,
        eventId: event.id,
        uploaderProfileId: profile.id,
        url,
        caption: caption || null,
        approved: false,
      })
      .returning();

    return NextResponse.json(
      { success: true, data: { id: newPhoto.id, approved: newPhoto.approved } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error uploading photo:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload photo' },
      { status: 500 }
    );
  }
}

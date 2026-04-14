import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events, venues, profiles, eventOrganizers } from '@/lib/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { generateSlug } from '@/lib/events/slug';
import { createId } from '@paralleldrive/cuid2';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const searchParams = (request.nextUrl ?? new URL(request.url)).searchParams;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let whereClause;
    if (!session?.user?.id) {
      whereClause = and(
        eq(events.status, 'published'),
        eq(events.visibility, 'public')
      );
    } else {
      whereClause = and(
        eq(events.status, 'published'),
        inArray(events.visibility, ['public', 'followers'])
      );
    }

    const [eventRows, countResult] = await Promise.all([
      db.query.events.findMany({
        where: () => whereClause,
        orderBy: (t, { asc }) => [asc(t.startsAt)],
        offset,
        limit,
        columns: {
          id: true,
          slug: true,
          title: true,
          description: true,
          coverImage: true,
          startsAt: true,
          endsAt: true,
          timezone: true,
          status: true,
          visibility: true,
          attendeeCount: true,
          attendeeCap: true,
          ageRestriction: true,
          panamiaCoOrganizer: true,
          streamEligible: true,
          streamStatus: true,
        },
        with: {
          venue: {
            columns: { slug: true, name: true, city: true, state: true },
          },
        },
      }),
      db
        .select({ count: sql<string>`count(*)` })
        .from(events)
        .where(whereClause),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        events: eventRows,
        total: Number(countResult[0].count),
        hasMore: offset + eventRows.length < Number(countResult[0].count),
      },
    });
  } catch (error) {
    console.error('Error listing events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const {
      title,
      description,
      venueId,
      startsAt,
      endsAt,
      timezone,
      visibility,
      attendeeCap,
      ageRestriction,
      photoPolicy,
      dresscode,
      coverImage,
      tos,
    } = body;

    if (!title?.trim())
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 }
      );
    if (!venueId)
      return NextResponse.json(
        { success: false, error: 'venueId is required' },
        { status: 400 }
      );
    if (!startsAt)
      return NextResponse.json(
        { success: false, error: 'startsAt is required' },
        { status: 400 }
      );
    if (!tos)
      return NextResponse.json(
        { success: false, error: 'You must accept the terms of service' },
        { status: 400 }
      );

    // Verify venue is active
    const venue = await db.query.venues.findFirst({
      where: eq(venues.id, venueId),
    });
    if (!venue || venue.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Venue not found or not active' },
        { status: 400 }
      );
    }

    // Enforce venue fire_capacity as a hard cap on attendeeCap.
    // If caller omits attendeeCap, default to the venue's fire_capacity.
    const parsedAttendeeCap =
      attendeeCap !== undefined && attendeeCap !== null && attendeeCap !== ''
        ? parseInt(attendeeCap, 10)
        : null;
    if (
      parsedAttendeeCap !== null &&
      (!Number.isFinite(parsedAttendeeCap) || parsedAttendeeCap <= 0)
    ) {
      return NextResponse.json(
        { success: false, error: 'attendeeCap must be a positive integer' },
        { status: 400 }
      );
    }
    if (
      parsedAttendeeCap !== null &&
      venue.fireCapacity > 0 &&
      parsedAttendeeCap > venue.fireCapacity
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `attendeeCap exceeds venue fire capacity (${venue.fireCapacity})`,
          code: 'EXCEEDS_FIRE_CAPACITY',
        },
        { status: 400 }
      );
    }
    const effectiveAttendeeCap =
      parsedAttendeeCap ?? (venue.fireCapacity > 0 ? venue.fireCapacity : null);

    const slug = generateSlug(title);
    const iCalUid = `${createId()}@panamia.club`;
    const now = new Date();

    const [newEvent] = await db
      .insert(events)
      .values({
        id: createId(),
        createdAt: now,
        updatedAt: now,
        slug,
        title: title.trim(),
        description: description || null,
        coverImage: coverImage || null,
        hostProfileId: profile.id,
        venueId,
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : null,
        timezone: timezone || 'America/New_York',
        status: 'draft',
        visibility: visibility || 'public',
        attendeeCap: effectiveAttendeeCap,
        ageRestriction: ageRestriction || 'all_ages',
        photoPolicy: photoPolicy || 'allowed',
        dresscode: dresscode || 'none',
        iCalUid,
        panamiaCoOrganizer: true,
        tosAcceptedAt: now,
      })
      .returning();

    // Insert caller as host organizer
    await db.insert(eventOrganizers).values({
      id: createId(),
      createdAt: now,
      updatedAt: now,
      eventId: newEvent.id,
      profileId: profile.id,
      role: 'host',
      canSeeRsvpList: true,
      invitedAt: now,
      acceptedAt: now,
    });

    return NextResponse.json(
      {
        success: true,
        data: { id: newEvent.id, slug: newEvent.slug, status: newEvent.status },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events, eventOrganizers, profiles } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

async function getHostOrganizer(eventId: string, profileId: string) {
  return db.query.eventOrganizers.findFirst({
    where: and(
      eq(eventOrganizers.eventId, eventId),
      eq(eventOrganizers.profileId, profileId),
      eq(eventOrganizers.role, 'host')
    ),
  });
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const session = await auth();

    const event = await db.query.events.findFirst({
      where: eq(events.slug, slug),
      with: {
        venue: {
          columns: {
            id: true,
            slug: true,
            name: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
            lat: true,
            lng: true,
            website: true,
          },
        },
        hostProfile: { columns: { id: true, name: true } },
        organizers: {
          with: { profile: { columns: { id: true, name: true } } },
        },
      },
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
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const isAdmin = session.user.isAdmin || false;
    const hostOrg = await getHostOrganizer(event.id, profile.id);
    if (!hostOrg && !isAdmin)
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );

    const body = await request.json();

    // Branding: panamiaCoOrganizer cannot be set to false
    if ('panamiaCoOrganizer' in body && body.panamiaCoOrganizer === false) {
      return NextResponse.json(
        { error: 'We wanna crash this party!' },
        { status: 403 }
      );
    }

    const allowedFields = [
      'title',
      'description',
      'coverImage',
      'startsAt',
      'endsAt',
      'timezone',
      'visibility',
      'attendeeCap',
      'ageRestriction',
      'photoPolicy',
      'dresscode',
    ];
    // Organizers can also toggle streamEligible
    const orgAllowedFields = [...allowedFields, 'streamEligible'];

    const updates: Record<string, unknown> = {};
    for (const field of orgAllowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    // Handle publish action
    if (body.status === 'published' && event.status === 'draft') {
      if (!session.user.isAdmin && !hostOrg) {
        return NextResponse.json(
          { success: false, error: 'Only host organizer can publish' },
          { status: 403 }
        );
      }
      updates.status = 'published';
    } else if (body.status === 'cancelled') {
      updates.status = 'cancelled';
      updates.cancelledAt = new Date();
      updates.cancelledBy = session.user.id;
      updates.cancellationReason = body.cancellationReason || null;
    } else if (body.status === 'completed') {
      updates.status = 'completed';
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const [updated] = await db
      .update(events)
      .set(updates as any)
      .where(eq(events.id, event.id))
      .returning();
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        slug: updated.slug,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update event' },
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
    const hostOrg = profile
      ? await getHostOrganizer(event.id, profile.id)
      : null;
    const isAdmin = session.user.isAdmin || false;

    if (!hostOrg && !isAdmin)
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    if (event.status !== 'draft')
      return NextResponse.json(
        { success: false, error: 'Can only delete draft events' },
        { status: 400 }
      );

    await db.delete(events).where(eq(events.id, event.id));
    return NextResponse.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}

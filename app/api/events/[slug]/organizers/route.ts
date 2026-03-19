import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events, eventOrganizers, profiles, users } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
import { createId } from '@paralleldrive/cuid2';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const event = await db.query.events.findFirst({
      where: eq(events.slug, slug),
    });
    if (!event)
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );

    const organizers = await db.query.eventOrganizers.findMany({
      where: eq(eventOrganizers.eventId, event.id),
      with: { profile: { columns: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: { organizers } });
  } catch (error) {
    console.error('Error fetching organizers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch organizers' },
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

    const callerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    });
    if (!callerProfile)
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );

    const isAdmin = session.user.isAdmin || false;
    const callerOrg = await db.query.eventOrganizers.findFirst({
      where: and(
        eq(eventOrganizers.eventId, event.id),
        eq(eventOrganizers.profileId, callerProfile.id)
      ),
    });
    if (!callerOrg && !isAdmin)
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );

    const body = await request.json();
    const { username, role, message, canSeeRsvpList } = body;
    if (!username)
      return NextResponse.json(
        { success: false, error: 'username is required' },
        { status: 400 }
      );

    const invitedUser = await db.query.users.findFirst({
      where: eq(users.screenname, username),
    });
    if (!invitedUser)
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );

    const invitedProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, invitedUser.id),
    });
    if (!invitedProfile)
      return NextResponse.json(
        { success: false, error: 'Profile not found for user' },
        { status: 404 }
      );

    const existing = await db.query.eventOrganizers.findFirst({
      where: and(
        eq(eventOrganizers.eventId, event.id),
        eq(eventOrganizers.profileId, invitedProfile.id)
      ),
    });
    if (existing)
      return NextResponse.json(
        {
          success: false,
          error: 'User is already an organizer for this event',
        },
        { status: 409 }
      );

    const now = new Date();
    const [newOrg] = await db
      .insert(eventOrganizers)
      .values({
        id: createId(),
        createdAt: now,
        updatedAt: now,
        eventId: event.id,
        profileId: invitedProfile.id,
        role: role || 'co_organizer',
        canSeeRsvpList: canSeeRsvpList || false,
        invitedBy: callerProfile.id,
        invitedAt: now,
        message: message || null,
      })
      .returning();

    // Notify invited user
    if (invitedUser.id) {
      await createNotification({
        type: 'Invite',
        actorId: session.user.id,
        targetId: invitedUser.id,
        context: 'event',
        objectId: event.id,
        objectType: 'event',
        objectTitle: event.title,
        objectUrl: `/e/${event.slug}`,
        message: message || undefined,
      });
    }

    return NextResponse.json(
      { success: true, data: { id: newOrg.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error inviting organizer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to invite organizer' },
      { status: 500 }
    );
  }
}

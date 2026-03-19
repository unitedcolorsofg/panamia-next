import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events, eventOrganizers, profiles } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
  params: Promise<{ slug: string; profileId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, profileId } = await params;
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

    // Can only respond to your own invitation
    if (callerProfile.id !== profileId && !session.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const org = await db.query.eventOrganizers.findFirst({
      where: and(
        eq(eventOrganizers.eventId, event.id),
        eq(eventOrganizers.profileId, profileId)
      ),
    });
    if (!org)
      return NextResponse.json(
        { success: false, error: 'Organizer not found' },
        { status: 404 }
      );

    const body = await request.json();
    const now = new Date();
    const updates: Record<string, unknown> = {};

    if (body.action === 'accept') {
      updates.acceptedAt = now;
      updates.declinedAt = null;
    } else if (body.action === 'decline') {
      updates.declinedAt = now;
      updates.acceptedAt = null;
    }

    if (body.canSeeRsvpList !== undefined && session.user.isAdmin) {
      updates.canSeeRsvpList = body.canSeeRsvpList;
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const [updated] = await db
      .update(eventOrganizers)
      .set(updates as any)
      .where(eq(eventOrganizers.id, org.id))
      .returning();
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Notify the event host if organizer responded
    if (body.action === 'accept' || body.action === 'decline') {
      const hostOrg = await db.query.eventOrganizers.findFirst({
        where: and(
          eq(eventOrganizers.eventId, event.id),
          eq(eventOrganizers.role, 'host')
        ),
        with: { profile: { with: { user: { columns: { id: true } } } } },
      });
      if (
        hostOrg?.profile?.user?.id &&
        hostOrg.profile.user.id !== session.user.id
      ) {
        await createNotification({
          type: body.action === 'accept' ? 'Accept' : 'Reject',
          actorId: session.user.id,
          targetId: hostOrg.profile.user.id,
          context: 'event',
          objectId: event.id,
          objectType: 'event',
          objectTitle: event.title,
          objectUrl: `/e/${event.slug}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        acceptedAt: updated.acceptedAt,
        declinedAt: updated.declinedAt,
      },
    });
  } catch (error) {
    console.error('Error updating organizer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update organizer' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, profileId } = await params;
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

    const org = await db.query.eventOrganizers.findFirst({
      where: and(
        eq(eventOrganizers.eventId, event.id),
        eq(eventOrganizers.profileId, profileId)
      ),
    });
    if (!org)
      return NextResponse.json(
        { success: false, error: 'Organizer not found' },
        { status: 404 }
      );

    // Can only remove yourself or be admin/host
    const isHostOrg = callerProfile.id === profileId;
    const callerIsHost = !!(await db.query.eventOrganizers.findFirst({
      where: and(
        eq(eventOrganizers.eventId, event.id),
        eq(eventOrganizers.profileId, callerProfile.id),
        eq(eventOrganizers.role, 'host')
      ),
    }));

    if (!isHostOrg && !callerIsHost && !session.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Cannot remove the host
    if (org.role === 'host') {
      return NextResponse.json(
        { success: false, error: 'Cannot remove the host organizer' },
        { status: 400 }
      );
    }

    await db.delete(eventOrganizers).where(eq(eventOrganizers.id, org.id));
    return NextResponse.json({ success: true, message: 'Organizer removed' });
  } catch (error) {
    console.error('Error removing organizer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove organizer' },
      { status: 500 }
    );
  }
}

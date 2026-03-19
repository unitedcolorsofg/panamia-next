import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events, eventPhotos, eventOrganizers, profiles } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ slug: string; photoId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, photoId } = await params;
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

    const photo = await db.query.eventPhotos.findFirst({
      where: and(
        eq(eventPhotos.id, photoId),
        eq(eventPhotos.eventId, event.id)
      ),
    });
    if (!photo)
      return NextResponse.json(
        { success: false, error: 'Photo not found' },
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

    // Must be organizer with canSeeRsvpList or admin
    const isAdmin = session.user.isAdmin || false;
    const org = isAdmin
      ? null
      : await db.query.eventOrganizers.findFirst({
          where: and(
            eq(eventOrganizers.eventId, event.id),
            eq(eventOrganizers.profileId, profile.id),
            eq(eventOrganizers.canSeeRsvpList, true)
          ),
        });

    if (!isAdmin && !org)
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.approved === 'boolean') {
      updates.approved = body.approved;
      if (body.approved) {
        updates.approvedBy = session.user.id;
        updates.approvedAt = new Date();
      }
    }
    if (body.caption !== undefined) updates.caption = body.caption;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const [updated] = await db
      .update(eventPhotos)
      .set(updates as any)
      .where(eq(eventPhotos.id, photo.id))
      .returning();
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return NextResponse.json({
      success: true,
      data: { id: updated.id, approved: updated.approved },
    });
  } catch (error) {
    console.error('Error updating photo:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update photo' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, photoId } = await params;
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

    const photo = await db.query.eventPhotos.findFirst({
      where: and(
        eq(eventPhotos.id, photoId),
        eq(eventPhotos.eventId, event.id)
      ),
    });
    if (!photo)
      return NextResponse.json(
        { success: false, error: 'Photo not found' },
        { status: 404 }
      );

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    });
    const isUploader = profile?.id === photo.uploaderProfileId;
    const isAdmin = session.user.isAdmin || false;

    if (!isUploader && !isAdmin) {
      const org = await db.query.eventOrganizers.findFirst({
        where: and(
          eq(eventOrganizers.eventId, event.id),
          eq(eventOrganizers.profileId, profile?.id || ''),
          eq(eventOrganizers.canSeeRsvpList, true)
        ),
      });
      if (!org)
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
    }

    await db.delete(eventPhotos).where(eq(eventPhotos.id, photo.id));
    return NextResponse.json({ success: true, message: 'Photo deleted' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete photo' },
      { status: 500 }
    );
  }
}

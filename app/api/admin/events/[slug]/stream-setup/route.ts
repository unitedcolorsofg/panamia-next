import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { createLiveInput } from '@/lib/cloudflare-stream';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
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

    const event = await db.query.events.findFirst({
      where: eq(events.slug, slug),
    });
    if (!event)
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );

    if (!event.streamEligible) {
      return NextResponse.json(
        { success: false, error: 'Event is not marked as stream-eligible' },
        { status: 400 }
      );
    }

    if (event.cfStreamId) {
      return NextResponse.json(
        { success: false, error: 'Stream live input already created' },
        { status: 409 }
      );
    }

    const { uid, srtUrl, srtStreamKey, playbackId } = await createLiveInput(
      event.slug
    );

    const [updated] = await db
      .update(events)
      .set({
        cfStreamId: uid,
        cfStreamPlaybackId: playbackId,
        cfStreamSrtUrl: srtUrl,
        cfStreamSrtKey: srtStreamKey,
        streamStatus: 'connecting',
      })
      .where(eq(events.id, event.id))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        cfStreamId: updated.cfStreamId,
        cfStreamPlaybackId: updated.cfStreamPlaybackId,
        cfStreamSrtUrl: updated.cfStreamSrtUrl,
        // Note: srtKey is returned once here but stored server-side; organizers see it in /manage
      },
    });
  } catch (error) {
    console.error('Error setting up stream:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to setup stream' },
      { status: 500 }
    );
  }
}

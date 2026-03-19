import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { verifyWebhookSignature } from '@/lib/cloudflare-stream';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const webhookSecret = process.env.CF_STREAM_WEBHOOK_SECRET || '';
    const signature = request.headers.get('webhook-secret');

    if (!verifyWebhookSignature(signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = await db.query.events.findFirst({
      where: eq(events.slug, slug),
    });
    if (!event)
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const body = await request.json();
    const { event: webhookEvent, recording } = body;
    const now = new Date();

    if (webhookEvent === 'live.stream.connected') {
      await db
        .update(events)
        .set({ streamStatus: 'live', streamLiveAt: now })
        .where(eq(events.id, event.id));
    } else if (webhookEvent === 'live.stream.disconnected') {
      await db
        .update(events)
        .set({ streamStatus: 'ended', streamEndedAt: now })
        .where(eq(events.id, event.id));
    } else if (webhookEvent === 'recording.ready') {
      const recordingUrl = recording?.playback?.hls || body.playbackUrl || null;
      if (recordingUrl) {
        await db
          .update(events)
          .set({ cfStreamRecordingUrl: recordingUrl })
          .where(eq(events.id, event.id));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling stream webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

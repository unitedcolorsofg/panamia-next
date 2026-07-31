/**
 * PATCH /api/crm/contact/dnd
 *
 * Sets DND for a single channel on the authenticated user's GHL contact.
 * Finer-grained counterpart to /subscribe and /unsubscribe, which are
 * deliberately all-or-nothing.
 *
 * The change is applied server-side by reading the contact's current per-channel
 * state and rewriting all four channels, so a stale client cannot clobber a
 * channel it did not intend to touch. Degrades gracefully if GHL is
 * unavailable.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { GhlClient, GHL_DND_CHANNELS, type GhlDndChannel } from '@/lib/ghl';
import { checkSameOrigin } from '@/lib/csrf';

function isChannel(value: unknown): value is GhlDndChannel {
  return (
    typeof value === 'string' &&
    (GHL_DND_CHANNELS as readonly string[]).includes(value)
  );
}

export async function PATCH(request: Request) {
  const origin = checkSameOrigin(request);
  if (!origin.ok) {
    console.warn(`[crm.dnd] origin check failed: ${origin.reason}`);
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let body: { channel?: unknown; suppressed?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!isChannel(body.channel) || typeof body.suppressed !== 'boolean') {
    return NextResponse.json(
      {
        success: false,
        error: `channel must be one of ${GHL_DND_CHANNELS.join(', ')} and suppressed must be a boolean`,
      },
      { status: 400 }
    );
  }
  const channel = body.channel;
  const suppressed = body.suppressed;

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
    columns: { id: true, ghlContactId: true },
  });

  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Profile not found' },
      { status: 404 }
    );
  }

  if (!profile.ghlContactId) {
    return NextResponse.json(
      { success: false, error: 'No GHL contact linked to this profile' },
      { status: 404 }
    );
  }

  const ghl = GhlClient.create();
  if (!ghl) {
    console.warn(
      '[crm.dnd] GhlClient.create() returned null — GHL_API_KEY or GHL_LOCATION_ID not set in runtime'
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Could not reach HighLevel, please try again later.',
      },
      { status: 503 }
    );
  }

  try {
    // Read first: setDndChannels writes every channel, so the untouched ones
    // have to come from GHL's current state rather than from the request.
    const contact = await ghl.getContactById(profile.ghlContactId);
    const active = Object.fromEntries(
      GHL_DND_CHANNELS.map((c) => [
        c,
        c === channel
          ? suppressed
          : contact.dndSettings?.[c]?.status === 'active',
      ])
    ) as Record<GhlDndChannel, boolean>;

    await ghl.setDndChannels(profile.ghlContactId, active);

    // Opening any channel means the user wants contact again, so ghlOptedOut
    // must not keep the CRM worker from pushing updates. Suppressing a single
    // channel is not a full opt-out and deliberately does not set it.
    if (!suppressed) {
      await db
        .update(profiles)
        .set({ ghlOptedOut: false })
        .where(eq(profiles.id, profile.id));
    }

    return NextResponse.json({ success: true, data: active });
  } catch (err) {
    console.error(
      `[crm.dnd] setDndChannels(${profile.ghlContactId}, ${channel}) failed:`,
      err
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Could not reach HighLevel, please try again later.',
      },
      { status: 503 }
    );
  }
}

/**
 * POST /api/crm/contact/unsubscribe
 *
 * Sets DND (Do Not Disturb) on all GHL channels for the authenticated user's
 * contact record — effectively unsubscribing them from all marketing communications.
 *
 * The contact record is NOT deleted. Use DELETE /api/crm/contact to delete it.
 * Degrades gracefully if GHL is unavailable.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { GhlClient } from '@/lib/ghl';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
    columns: { ghlContactId: true },
  });

  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Profile not found' },
      { status: 404 }
    );
  }

  if (!profile.ghlContactId) {
    return NextResponse.json({ success: true });
  }

  const ghl = GhlClient.create();
  if (!ghl) {
    return NextResponse.json(
      {
        success: false,
        error: 'Could not reach marketing service — try again later',
      },
      { status: 503 }
    );
  }

  try {
    await ghl.setDndAll(profile.ghlContactId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Could not reach marketing service — try again later',
      },
      { status: 503 }
    );
  }
}

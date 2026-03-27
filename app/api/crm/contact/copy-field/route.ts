/**
 * POST /api/crm/contact/copy-field
 *
 * Copies a single field from the user's GHL contact record to their Panamia profile.
 * Opt-in, per field. PDL enrichment fields are excluded.
 *
 * Body: { field: 'name' | 'phone' }
 *
 * Supported mappings:
 *   GHL firstName + lastName → profiles.name
 *   GHL phone              → profiles.phoneNumber
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { GhlClient } from '@/lib/ghl';

const ALLOWED_FIELDS = ['name', 'phone'] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const field = body?.field as string | undefined;

  if (!field || !ALLOWED_FIELDS.includes(field as AllowedField)) {
    return NextResponse.json(
      {
        success: false,
        error: `field must be one of: ${ALLOWED_FIELDS.join(', ')}`,
      },
      { status: 400 }
    );
  }

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
    return NextResponse.json(
      {
        success: false,
        error: 'Could not reach HighLevel, please try again later.',
      },
      { status: 503 }
    );
  }

  let contact;
  try {
    contact = await ghl.getContactById(profile.ghlContactId);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Could not reach HighLevel, please try again later.',
      },
      { status: 503 }
    );
  }

  const updates: Partial<typeof profiles.$inferInsert> = {};

  if (field === 'name') {
    const parts = [contact.firstName, contact.lastName].filter(Boolean);
    if (parts.length > 0) {
      updates.name = parts.join(' ');
    }
  }

  if (field === 'phone') {
    if (contact.phone) {
      updates.phoneNumber = contact.phone;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: 'No value to copy for that field' },
      { status: 422 }
    );
  }

  await db.update(profiles).set(updates).where(eq(profiles.id, profile.id));

  return NextResponse.json({
    success: true,
    field,
    value: Object.values(updates)[0],
  });
}

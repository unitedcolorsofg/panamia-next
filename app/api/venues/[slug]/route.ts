import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { venues, profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const session = await auth();
    const isAdmin = session?.user?.isAdmin || false;

    const venue = await db.query.venues.findFirst({
      where: eq(venues.slug, slug),
    });
    if (!venue)
      return NextResponse.json(
        { success: false, error: 'Venue not found' },
        { status: 404 }
      );

    // Non-admins can only see active venues
    if (venue.status !== 'active' && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Venue not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: venue });
  } catch (error) {
    console.error('Error fetching venue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch venue' },
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

    const venue = await db.query.venues.findFirst({
      where: eq(venues.slug, slug),
    });
    if (!venue)
      return NextResponse.json(
        { success: false, error: 'Venue not found' },
        { status: 404 }
      );

    const isAdmin = session.user.isAdmin || false;
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    });
    const isOperator = profile?.id === venue.operatorProfileId;

    if (!isAdmin && !isOperator) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      'name',
      'address',
      'city',
      'state',
      'country',
      'postalCode',
      'capacity',
      'parkingOptions',
      'safetyContact',
      'accessibilityNotes',
      'website',
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const [updated] = await db
      .update(venues)
      .set(updates as any)
      .where(eq(venues.id, venue.id))
      .returning();
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        slug: updated.slug,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating venue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update venue' },
      { status: 500 }
    );
  }
}

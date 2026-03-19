import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { venues, profiles } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { generateSlug } from '@/lib/events/slug';
import { createId } from '@paralleldrive/cuid2';

export async function GET(request: NextRequest) {
  try {
    const searchParams = (request.nextUrl ?? new URL(request.url)).searchParams;
    const city = searchParams.get('city');
    const status = searchParams.get('status') || 'active';
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const session = await auth();
    const isAdmin = session?.user?.isAdmin || false;

    // Non-admins can only see active venues
    const effectiveStatus = isAdmin ? status : 'active';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions = [eq(venues.status, effectiveStatus as any)];
    if (city) conditions.push(eq(venues.city, city));

    const whereClause =
      conditions.length > 1 ? and(...conditions) : conditions[0];

    const [venueRows, countResult] = await Promise.all([
      db.query.venues.findMany({
        where: () => whereClause,
        orderBy: (t, { asc }) => [asc(t.city), asc(t.name)],
        offset,
        limit,
        columns: {
          id: true,
          slug: true,
          name: true,
          address: true,
          city: true,
          state: true,
          country: true,
          capacity: true,
          status: true,
          website: true,
        },
      }),
      db
        .select({ count: sql<string>`count(*)` })
        .from(venues)
        .where(whereClause),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        venues: venueRows,
        total: Number(countResult[0].count),
        hasMore: offset + venueRows.length < Number(countResult[0].count),
      },
    });
  } catch (error) {
    console.error('Error listing venues:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list venues' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!session.user.panaVerified) {
      return NextResponse.json(
        { success: false, error: 'panaVerified required' },
        { status: 403 }
      );
    }

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      address,
      city,
      state,
      country,
      postalCode,
      capacity,
      parkingOptions,
      safetyContact,
      accessibilityNotes,
      website,
    } = body;

    if (!name?.trim() || !address?.trim() || !city?.trim() || !state?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'name, address, city, and state are required',
        },
        { status: 400 }
      );
    }

    const slug = generateSlug(name);
    const now = new Date();

    const [newVenue] = await db
      .insert(venues)
      .values({
        id: createId(),
        createdAt: now,
        updatedAt: now,
        slug,
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        country: country || 'US',
        postalCode: postalCode || null,
        capacity: capacity ? parseInt(capacity, 10) : null,
        parkingOptions: parkingOptions || 'none',
        operatorProfileId: profile.id,
        status: 'pending_review',
        safetyContact: safetyContact || null,
        accessibilityNotes: accessibilityNotes || null,
        photos: [],
        website: website || null,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: { id: newVenue.id, slug: newVenue.slug, status: newVenue.status },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating venue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create venue' },
      { status: 500 }
    );
  }
}

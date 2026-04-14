import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { venues } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';

// GET /api/venues/check-parcel?pcn=...&unit=...
// Pre-submission dedup check used by the /form/submit-venue wizard.
// Returns { exists: boolean, existing?: { slug, name, status } }.

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = (request.nextUrl ?? new URL(request.url)).searchParams;
    const pcn = (searchParams.get('pcn') || '').trim();
    const unit = (searchParams.get('unit') || '').trim();

    if (!pcn) {
      return NextResponse.json({ success: true, data: { exists: false } });
    }

    const existing = await db.query.venues.findFirst({
      where: and(
        eq(venues.parcelControlNumber, pcn),
        unit ? eq(venues.parcelUnit, unit) : sql`${venues.parcelUnit} IS NULL`
      ),
      columns: { slug: true, name: true, status: true },
    });

    return NextResponse.json({
      success: true,
      data: existing ? { exists: true, existing } : { exists: false },
    });
  } catch (error) {
    console.error('Error checking parcel:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check parcel' },
      { status: 500 }
    );
  }
}

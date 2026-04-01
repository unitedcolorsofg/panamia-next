import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { venues } from '@/lib/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(_: unknown, { params }: RouteParams) {
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

    const venue = await db.query.venues.findFirst({
      where: eq(venues.slug, slug),
    });
    if (!venue)
      return NextResponse.json(
        { success: false, error: 'Venue not found' },
        { status: 404 }
      );
    if (venue.status !== 'pending_review') {
      return NextResponse.json(
        { success: false, error: 'Venue is not pending review' },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(venues)
      .set({
        status: 'active',
        approvedAt: new Date(),
        approvedBy: session.user.id,
      })
      .where(eq(venues.id, venue.id))
      .returning();

    return NextResponse.json({
      success: true,
      data: { id: updated.id, slug: updated.slug, status: updated.status },
    });
  } catch (error) {
    console.error('Error approving venue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve venue' },
      { status: 500 }
    );
  }
}

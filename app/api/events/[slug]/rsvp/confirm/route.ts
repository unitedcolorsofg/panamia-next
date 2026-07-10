/**
 * Magic-link RSVP confirmation. GET ?token=… — validates and consumes a
 * single-use token from verification_tokens, stamps emailVerifiedAt on the
 * pending attendee, counts it toward capacity if 'going', and redirects to the
 * event page with a status banner.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events, eventAttendees, verification } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

function redirectTo(slug: string, status: string): NextResponse {
  const host = (process.env.NEXT_PUBLIC_HOST_URL ?? '').replace(/\/$/, '');
  const url = host
    ? `${host}/e/${slug}?rsvp=${status}`
    : `/e/${slug}?rsvp=${status}`;
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const token = (request.nextUrl ?? new URL(request.url)).searchParams.get(
      'token'
    );
    if (!token) return redirectTo(slug, 'invalid');

    const row = await db.query.verification.findFirst({
      where: eq(verification.value, token),
    });
    if (!row || !row.identifier.startsWith('event-rsvp:')) {
      return redirectTo(slug, 'invalid');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      await db.delete(verification).where(eq(verification.id, row.id));
      return redirectTo(slug, 'expired');
    }

    const attendeeId = row.identifier.slice('event-rsvp:'.length);
    const attendee = await db.query.eventAttendees.findFirst({
      where: eq(eventAttendees.id, attendeeId),
    });
    if (!attendee) {
      await db.delete(verification).where(eq(verification.id, row.id));
      return redirectTo(slug, 'invalid');
    }

    const alreadyVerified = !!attendee.emailVerifiedAt;
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(eventAttendees)
        .set({ emailVerifiedAt: now, respondedAt: attendee.respondedAt ?? now })
        .where(eq(eventAttendees.id, attendee.id));
      // First-time verification of a 'going' RSVP counts toward capacity.
      if (!alreadyVerified && attendee.status === 'going') {
        await tx
          .update(events)
          .set({ attendeeCount: sql`${events.attendeeCount} + 1` })
          .where(eq(events.id, attendee.eventId));
      }
      // Single-use: consume the token.
      await tx.delete(verification).where(eq(verification.id, row.id));
    });

    return redirectTo(slug, 'confirmed');
  } catch (error) {
    console.error('Error confirming RSVP:', error);
    const { slug } = await params;
    return redirectTo(slug, 'error');
  }
}

/**
 * Single-event API.
 *   GET    — fetch an event by slug (with venue + host).
 *   PATCH  — host-only edit.
 *   DELETE — host-only delete.
 *
 * Note: editing a published event does NOT re-crosspost here; republish via
 * POST /api/events/[slug]/publish to push the updated kind-31923 mirror (the
 * `d` tag is the slug, so the relay replaces the prior event in place).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events, profiles, venues } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { removeRelayEvents } from '@/lib/relay/crosspost-client';
import type { EventMode } from '@/lib/schema';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

const MODES: EventMode[] = ['online', 'offline', 'hybrid'];

// Resolve the caller's profile and confirm it hosts the event. Returns the
// event + profile on success, or a NextResponse to return on failure.
async function requireHost(slug: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }
  const [event, profile] = await Promise.all([
    db.query.events.findFirst({ where: eq(events.slug, slug) }),
    db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    }),
  ]);
  if (!event) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      ),
    };
  }
  if (!profile || event.hostProfileId !== profile.id) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Only the host can modify this event' },
        { status: 403 }
      ),
    };
  }
  return { event, profile };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const event = await db.query.events.findFirst({
      where: eq(events.slug, slug),
      with: { venue: true, host: { columns: { id: true, name: true } } },
    });
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const guard = await requireHost(slug);
    if ('error' in guard) return guard.error;

    const body = await request.json();
    const updates: Partial<typeof events.$inferInsert> = {};

    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim();
    }
    if ('description' in body) updates.description = body.description || null;
    if ('coverImage' in body) updates.coverImage = body.coverImage || null;
    if ('coverImageAlt' in body) {
      updates.coverImageAlt = body.coverImageAlt || null;
    }
    if (body.startsAt) updates.startsAt = new Date(body.startsAt);
    if ('endsAt' in body) {
      updates.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    }
    if (typeof body.timezone === 'string') updates.timezone = body.timezone;
    if (MODES.includes(body.mode)) updates.mode = body.mode;
    if (body.visibility === 'public' || body.visibility === 'unlisted') {
      updates.visibility = body.visibility;
    }
    if ('attendeeCap' in body) {
      updates.attendeeCap =
        typeof body.attendeeCap === 'number' && body.attendeeCap > 0
          ? body.attendeeCap
          : null;
    }
    if (Array.isArray(body.tags)) updates.tags = body.tags;
    if ('venueId' in body) {
      if (body.venueId) {
        const venue = await db.query.venues.findFirst({
          where: eq(venues.id, body.venueId),
          columns: { id: true },
        });
        if (!venue) {
          return NextResponse.json(
            { success: false, error: 'Venue not found' },
            { status: 400 }
          );
        }
        updates.venueId = venue.id;
      } else {
        updates.venueId = null;
      }
    }

    // Flipping a previously-crossposted event to unlisted: retract the public
    // kind-31923 from the relay so "unlisted" actually means off-Nostr. Unlisted
    // events are never crossposted in the first place (see publish route), so
    // this only matters when a public event is later made unlisted.
    let retraction: 'removed' | 'failed' | null = null;
    if (updates.visibility === 'unlisted' && guard.event.nostrEventId) {
      try {
        await removeRelayEvents([guard.event.nostrEventId]);
        updates.nostrEventId = null;
        retraction = 'removed';
      } catch (err) {
        // Fail-open: still apply the visibility change locally. The stale
        // listing can be retried; surface the outcome to the caller.
        console.error('Failed to retract event from relay:', err);
        retraction = 'failed';
      }
    }

    const [updated] = await db
      .update(events)
      .set(updates)
      .where(eq(events.id, guard.event.id))
      .returning();

    return NextResponse.json({
      success: true,
      data: { slug: updated.slug, status: updated.status, retraction },
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const guard = await requireHost(slug);
    if ('error' in guard) return guard.error;

    // NOTE (v2): if the event was crossposted (nostrEventId set), also publish a
    // NIP-09 deletion (kind 5) for the kind-31923 coordinate via the relay. For
    // v1 we only remove the authoritative Postgres row.
    await db.delete(events).where(eq(events.id, guard.event.id));

    return NextResponse.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}

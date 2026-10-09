import { NextRequest, NextResponse } from 'next/server';

import { checkAdminAuth } from '@/lib/server/admin-auth';
import {
  createEvent,
  deleteEvent,
  isCadence,
  isPod,
  rescheduleEvent,
  setEventCancelled,
  DETAILS_MAX,
  LOCATION_MAX,
  TITLE_MAX,
} from '@/lib/connectors/events';

/**
 * Put a gathering on the Connectors calendar, move it, call it off, or
 * remove it.
 *
 * ## Why cancel and delete are both here
 *
 * They are not the same action and collapsing them loses the one that
 * matters. Cancelling is a message: somebody was planning to come and needs
 * to find out it is off, so the row stays and HQ renders it struck through.
 * Deleting is for the event that should never have been posted — a typo, a
 * duplicate, a date nobody ever saw. Deleting a real cancellation would tell
 * the people who were coming nothing at all.
 *
 * ## Why rolling a recurring event forward is a button and not a job
 *
 * `startsAt` holds the next occurrence, so a weekly gathering has to be moved
 * on after it happens. That could be a cron. It is a human action on purpose:
 * a job that advances dates by itself will keep a cancelled series alive, or
 * quietly roll past a week the organisers skipped, and nobody finds out until
 * somebody turns up to an empty park. The admin console surfaces the stale
 * ones instead and asks.
 */

function parseStartsAt(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  /* `new Date('tuesday')` is `Invalid Date`, which is a Date and silently
   * stores as null-ish nonsense. Checked rather than trusted. */
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function POST(request: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Could not read that request.' },
        { status: 400 }
      );
    }

    const payload = (body ?? {}) as Record<string, unknown>;

    const title = text(payload.title, TITLE_MAX);
    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Give it a title.' },
        { status: 400 }
      );
    }

    const startsAt = parseStartsAt(payload.startsAt);
    if (!startsAt) {
      return NextResponse.json(
        { success: false, error: 'That is not a date and time.' },
        { status: 400 }
      );
    }

    const cadence = isCadence(payload.cadence) ? payload.cadence : 'once';

    /* `null` is programme-wide, which is a real and common answer — the
     * all-hands is not a Miami event. So an unrecognised pod becomes "all"
     * rather than an error. */
    const pod = isPod(payload.pod) ? payload.pod : null;

    /* `volunteersNeeded` has three states and they are all meaningful: a
     * number is a target, `null` is "no cap, bring whoever", and a negative
     * or fractional value is a mistake that should not be stored. */
    let volunteersNeeded: number | null = null;
    if (payload.volunteersNeeded !== null && payload.volunteersNeeded !== '') {
      const parsed = Number(payload.volunteersNeeded);
      if (Number.isInteger(parsed) && parsed > 0 && parsed <= 9999) {
        volunteersNeeded = parsed;
      } else if (payload.volunteersNeeded !== undefined) {
        return NextResponse.json(
          {
            success: false,
            error: 'Volunteers needed has to be a whole number, or blank.',
          },
          { status: 400 }
        );
      }
    }

    const event = await createEvent({
      title,
      details: text(payload.details, DETAILS_MAX),
      startsAt,
      when: text(payload.when, 120),
      location: text(payload.location, LOCATION_MAX),
      cadence,
      volunteersNeeded,
      pod,
      lead: text(payload.lead, 120),
      createdBy: admin.id,
    });

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    console.error('Error creating connector event:', error);
    return NextResponse.json(
      { success: false, error: 'Could not save that. Try again.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Could not read that request.' },
        { status: 400 }
      );
    }

    const payload = (body ?? {}) as Record<string, unknown>;
    const id = typeof payload.id === 'string' ? payload.id : '';
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Which event?' },
        { status: 400 }
      );
    }

    /* Two separate edits behind one verb, branched explicitly rather than by
     * "whichever field happens to be present" — a reschedule that silently
     * un-cancelled an event because the body carried a stale `cancelled:
     * false` would be a bad afternoon for whoever came. */
    if (typeof payload.cancelled === 'boolean') {
      const ok = await setEventCancelled(id, payload.cancelled);
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'Could not find that event.' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true });
    }

    const startsAt = parseStartsAt(payload.startsAt);
    if (!startsAt) {
      return NextResponse.json(
        { success: false, error: 'That is not a date and time.' },
        { status: 400 }
      );
    }

    const ok = await rescheduleEvent(id, startsAt);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Could not find that event.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating connector event:', error);
    return NextResponse.json(
      { success: false, error: 'Could not save that. Try again.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Which event?' },
        { status: 400 }
      );
    }

    const removed = await deleteEvent(id);
    if (!removed) {
      return NextResponse.json(
        { success: false, error: 'Could not find that event.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting connector event:', error);
    return NextResponse.json(
      { success: false, error: 'Could not remove that. Try again.' },
      { status: 500 }
    );
  }
}

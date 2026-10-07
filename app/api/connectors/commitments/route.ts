import { NextRequest, NextResponse } from 'next/server';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { HOUSES } from '@/lib/connectors/model';
import {
  parseConnector,
  type ConnectorCommitment,
  type ProfileConnector,
} from '@/lib/connectors/membership';

/**
 * Say you will do something, or mark it done.
 *
 * Commitments live inside the membership blob rather than in their own table
 * because they are only ever read as part of "my membership" and are only
 * ever written by their owner. See drizzle/0055_profile_connector.sql.
 *
 * ## The read-modify-write, and why it is safe here
 *
 * POST appends and PATCH updates progress, both by reading the blob and
 * writing it back. That is a race in general — two concurrent writes and the
 * later one wins, losing the earlier. It is acceptable here and nowhere near
 * the hazard that kept `pending_owner_email` out of a JSONB column (0053),
 * for one specific reason: every writer of this blob is the same single
 * human acting on their own record, from one page, seconds apart. There is no
 * second actor — no admin path rewrites it, no background job touches it.
 *
 * If a second writer ever appears, this needs to move to its own table rather
 * than grow a lock.
 */

const HOUSE_IDS = new Set<string>(HOUSES.map((h) => h.id));
const WHAT_MAX = 500;
const WHEN_MAX = 120;
/** A guard against the blob growing without bound, not a product rule. */
const MAX_COMMITMENTS = 200;

async function loadMembership(userId: string) {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { id: true, connector: true },
  });
  if (!profile) return null;

  const membership = parseConnector(profile.connector);
  if (!membership) return null;

  return { profileId: profile.id, membership };
}

async function save(profileId: string, membership: ProfileConnector) {
  await db
    .update(profiles)
    .set({ connector: membership })
    .where(eq(profiles.id, profileId));
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'You need to be signed in.' },
      { status: 401 }
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

  const what =
    typeof payload.what === 'string' ? payload.what.trim().slice(0, WHAT_MAX) : '';
  if (!what) {
    return NextResponse.json(
      { success: false, error: 'Say what you will do.' },
      { status: 400 }
    );
  }

  const house = payload.house;
  if (typeof house !== 'string' || !HOUSE_IDS.has(house)) {
    return NextResponse.json(
      { success: false, error: 'Pick which house this is for.' },
      { status: 400 }
    );
  }

  const when =
    typeof payload.when === 'string' && payload.when.trim()
      ? payload.when.trim().slice(0, WHEN_MAX)
      : null;

  const found = await loadMembership(session.user.id);
  if (!found) {
    return NextResponse.json(
      { success: false, error: 'You are not a connector yet.' },
      { status: 403 }
    );
  }

  if (found.membership.commitments.length >= MAX_COMMITMENTS) {
    return NextResponse.json(
      {
        success: false,
        error: 'That is a lot of commitments. Close some out first.',
      },
      { status: 409 }
    );
  }

  const commitment: ConnectorCommitment = {
    id: createId(),
    what,
    when,
    house: house as ConnectorCommitment['house'],
    progress: 'notSet',
    createdAt: new Date().toISOString(),
  };

  const next: ProfileConnector = {
    ...found.membership,
    commitments: [...found.membership.commitments, commitment],
  };

  try {
    await save(found.profileId, next);
    return NextResponse.json(
      { success: true, data: commitment },
      { status: 200 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('connectors/commitments POST failed', message);
    return NextResponse.json(
      { success: false, error: 'Could not save that. Try again.' },
      { status: 500 }
    );
  }
}

/** Move a commitment along, or drop it. */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'You need to be signed in.' },
      { status: 401 }
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
      { success: false, error: 'Which commitment?' },
      { status: 400 }
    );
  }

  const remove = payload.remove === true;
  const progress = payload.progress;
  if (
    !remove &&
    progress !== 'notSet' &&
    progress !== 'inProgress' &&
    progress !== 'done'
  ) {
    return NextResponse.json(
      { success: false, error: 'That is not a progress value.' },
      { status: 400 }
    );
  }

  const found = await loadMembership(session.user.id);
  if (!found) {
    return NextResponse.json(
      { success: false, error: 'You are not a connector yet.' },
      { status: 403 }
    );
  }

  const exists = found.membership.commitments.some((c) => c.id === id);
  if (!exists) {
    return NextResponse.json(
      { success: false, error: 'Could not find that commitment.' },
      { status: 404 }
    );
  }

  const next: ProfileConnector = {
    ...found.membership,
    commitments: remove
      ? found.membership.commitments.filter((c) => c.id !== id)
      : found.membership.commitments.map((c) =>
          c.id === id
            ? { ...c, progress: progress as ConnectorCommitment['progress'] }
            : c
        ),
  };

  try {
    await save(found.profileId, next);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('connectors/commitments PATCH failed', message);
    return NextResponse.json(
      { success: false, error: 'Could not save that. Try again.' },
      { status: 500 }
    );
  }
}

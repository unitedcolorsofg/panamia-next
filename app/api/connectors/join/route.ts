import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { HOUSES, PODS } from '@/lib/connectors/model';
import { parseConnector, type ProfileConnector } from '@/lib/connectors/membership';

/**
 * Join the Connectors programme, or change what you picked.
 *
 * Self-serve by design. There is no pending/approved state because there is
 * no approval step to model: the programme recruits by asking people to show
 * up, everybody starts at Tier 1, and putting a gate on the first rung would
 * contradict what the tiers are for.
 *
 * Writes `profiles.connector` on the signed-in human's OWN profile — matched
 * on `profiles.userId`, not through `getActiveProfile`. That helper resolves
 * the profile somebody is acting as, which may be a business listing they
 * administer, and membership belongs to the person rather than their shop.
 *
 * Re-posting is an edit, not a second membership: `joinedAt` and any existing
 * commitments are carried over from the current record, so changing your
 * houses later does not quietly reset how long you have been here or throw
 * away what you already said you would do.
 */

const POD_IDS = new Set<string>(PODS.map((p) => p.id));
const HOUSE_IDS = new Set<string>(HOUSES.map((h) => h.id));

/** Long enough for a real answer, short enough not to be a storage endpoint. */
const BRING_MAX = 2000;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'You need to be signed in to join.' },
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

  const pod = payload.pod;
  if (typeof pod !== 'string' || !POD_IDS.has(pod)) {
    return NextResponse.json(
      { success: false, error: 'Pick the pod you can actually get to.' },
      { status: 400 }
    );
  }

  const houses = Array.isArray(payload.houses)
    ? [
        ...new Set(
          payload.houses.filter(
            (h): h is string => typeof h === 'string' && HOUSE_IDS.has(h)
          )
        ),
      ]
    : [];
  if (houses.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Pick at least one house.' },
      { status: 400 }
    );
  }

  const bring =
    typeof payload.bring === 'string'
      ? payload.bring.trim().slice(0, BRING_MAX)
      : '';

  // The identity profile, not the one they may be acting as.
  const existing = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
    columns: { id: true, connector: true },
  });

  if (!existing) {
    return NextResponse.json(
      { success: false, error: 'Your account does not have a profile yet.' },
      { status: 404 }
    );
  }

  const current = parseConnector(existing.connector);

  const membership: ProfileConnector = {
    pod: pod as ProfileConnector['pod'],
    houses: houses as ProfileConnector['houses'],
    // Tier is never taken from the request. It is not a thing you ask for.
    tier: current?.tier ?? 1,
    bring,
    joinedAt: current?.joinedAt ?? new Date().toISOString(),
    commitments: current?.commitments ?? [],
  };

  try {
    await db
      .update(profiles)
      .set({ connector: membership })
      .where(eq(profiles.id, existing.id));

    return NextResponse.json(
      { success: true, data: membership },
      { status: 200 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('connectors/join failed', message);
    return NextResponse.json(
      { success: false, error: 'Could not save that. Try again.' },
      { status: 500 }
    );
  }
}

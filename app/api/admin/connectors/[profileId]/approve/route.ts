import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { decideConnectorApplication } from '@/lib/connectors/membership';

/**
 * Accept somebody into the Connectors programme.
 *
 * The other half of the gate in `app/api/connectors/join/route.ts`. That route
 * writes a `pending` record; this one is the only way it becomes `active`,
 * which is what HQ, the pod headcount and the commitments API all check.
 *
 * Shaped after `app/api/admin/venues/[slug]/approve/route.ts` — same
 * `isAdmin` check, same 401/403 split, same "not pending" 400 — so the two
 * approval queues behave identically and an admin's instinct from one
 * transfers to the other.
 *
 * `decideConnectorApplication` refuses anything that is not currently
 * pending, so a second click on a stale queue page cannot overturn a decision
 * somebody else has already made. That reads back here as a 400.
 */

interface RouteParams {
  params: Promise<{ profileId: string }>;
}

export async function POST(_: unknown, { params }: RouteParams) {
  try {
    const { profileId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!session.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const decided = await decideConnectorApplication(
      profileId,
      'active',
      session.user.id
    );

    if (!decided) {
      return NextResponse.json(
        {
          success: false,
          error: 'No pending application for that profile.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { profileId, status: decided.status },
    });
  } catch (error) {
    console.error('Error approving connector application:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve application' },
      { status: 500 }
    );
  }
}

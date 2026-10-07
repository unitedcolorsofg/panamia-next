import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { decideConnectorApplication } from '@/lib/connectors/membership';

/**
 * Turn down an application to the Connectors programme.
 *
 * The record is kept rather than deleted. Clearing the column would put the
 * person straight back on the join form with no sign anything had happened,
 * so they would apply again, and staff would work the same application twice
 * with no memory of having decided it. A `declined` record is also the only
 * way the queue can tell "not reviewed yet" from "reviewed, and the answer
 * was no".
 *
 * There is deliberately no route to un-decline. Reversing a decision is rare
 * enough, and consequential enough, that it should go through somebody with
 * database access rather than being a button that sits next to Accept.
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
      'declined',
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
    console.error('Error declining connector application:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to decline application' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crm/contact/enroll
 *
 * Enrolls the authenticated user's GHL contact into the workflow specified
 * by GHL_WORKFLOW_TEST_ID. Intended for development/staging use — leave
 * GHL_WORKFLOW_TEST_ID unset in production to disable.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { GhlClient } from '@/lib/ghl';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const workflowId = process.env.GHL_WORKFLOW_TEST_ID;
  if (!workflowId) {
    return NextResponse.json(
      { success: false, error: 'GHL_WORKFLOW_TEST_ID is not configured.' },
      { status: 503 }
    );
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
    columns: { ghlContactId: true },
  });

  if (!profile?.ghlContactId) {
    return NextResponse.json(
      { success: false, error: 'No GHL contact linked to this profile.' },
      { status: 404 }
    );
  }

  const ghl = GhlClient.create();
  if (!ghl) {
    return NextResponse.json(
      {
        success: false,
        error: 'Could not reach HighLevel, please try again later.',
      },
      { status: 503 }
    );
  }

  try {
    await ghl.enrollInWorkflow(profile.ghlContactId, workflowId);
    return NextResponse.json({ success: true, workflowId });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Could not reach HighLevel, please try again later.',
      },
      { status: 503 }
    );
  }
}

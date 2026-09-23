/**
 * GET /api/social/suggestions - Panas you might know
 *
 * Caller-scoped by construction: the actor is resolved from the session, never
 * from a query parameter, because the response describes the viewer's own
 * graph. /api/social/actors/[username]/panas can answer about a third party
 * precisely because its list half is a bilateral, already-public connection;
 * "who you might know" is an inference about the viewer and has no such cover.
 *
 * Returns mutualCount rather than a rendered reason string so the copy stays in
 * the component. When a second signal lands (shared groups, neighbourhood) this
 * should grow a discriminated reason field rather than more loose integers.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { listSuggestedActors } from '@/lib/federation';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const profile = await getActiveProfileWithActor(session.user.id);

  // No actor yet is an ordinary state for an account that has not been through
  // social onboarding, not an error -- same shape as /api/social/follows.
  if (!profile?.socialActor) {
    return NextResponse.json({ success: true, data: { actors: [] } });
  }

  const actors = await listSuggestedActors(profile.socialActor.id);

  return NextResponse.json({
    success: true,
    data: {
      actors: actors.map((a) => ({
        id: a.id,
        username: a.username,
        domain: a.domain,
        name: a.name,
        summary: a.summary,
        iconUrl: a.iconUrl,
        mutualCount: a.mutualCount,
      })),
    },
  });
}

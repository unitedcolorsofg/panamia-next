import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { checkAdminAuth } from '@/lib/server/admin-auth';

/**
 * Grant or revoke content moderator for one account.
 *
 * POST { userId: string, contentModerator: boolean }
 *
 * Gated on checkAdminAuth, not checkSuperAdminAuth — unlike the admin grant
 * next door. The difference is deliberate: this role confers the abuse-report
 * queue and nothing else, so a holder cannot grant it onward and the power
 * cannot replicate itself. Requiring a founder would put the whole moderation
 * rota behind one person, which is the bottleneck this role exists to remove.
 *
 * There is no environment tier for contentModerator, so unlike the admin grant
 * a revoke here always revokes: the column is the only source, and clearing it
 * is the whole story. No 409 guard is needed.
 *
 * The grant is written to profiles.roles.contentModerator, alongside the other
 * roles already in that column. It takes effect on the target's next request —
 * enrichUserFields re-reads `profiles` every time, so there is no sign-out step
 * and no cache to bust. It also changes who is mailed about new reports:
 * moderationTeamEmails reads these same rows.
 */
export async function POST(request: NextRequest) {
  const actor = await checkAdminAuth();
  if (!actor) {
    return NextResponse.json(
      { error: 'Not Authorized:admin' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = body as {
    userId?: unknown;
    contentModerator?: unknown;
  } | null;
  const userId =
    typeof payload?.userId === 'string' ? payload.userId.trim() : '';
  // Strict boolean rather than truthiness: a missing field must not read as a
  // revoke, and the string "false" must not read as a grant.
  if (!userId || typeof payload?.contentModerator !== 'boolean') {
    return NextResponse.json(
      { error: 'Expected { userId: string, contentModerator: boolean }' },
      { status: 400 }
    );
  }
  const contentModerator = payload.contentModerator;

  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'No such user' }, { status: 404 });
  }

  // The identity profile is 1:1 with the user (profiles.userId is UNIQUE), but
  // it is not guaranteed to exist: profiles can be created unclaimed, and an
  // account that has never been attached to one has nowhere to hold the grant.
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { id: true, roles: true },
  });
  if (!profile) {
    return NextResponse.json(
      {
        error:
          'This account has no profile yet, so there is nowhere to record ' +
          'the grant. Ask them to finish setting up their profile first.',
      },
      { status: 409 }
    );
  }

  // Merge rather than replace: this column also carries admin,
  // mentoringModerator and eventOrganizer, and a bare set would silently drop
  // whichever of those the account already held — including, at worst, admin.
  const existingRoles = (profile.roles ?? {}) as Record<string, unknown>;
  const nextRoles = { ...existingRoles, contentModerator };

  await db
    .update(profiles)
    .set({ roles: nextRoles })
    .where(eq(profiles.id, profile.id));

  // Not an audit table — a structured line so a grant is at least recoverable
  // from logs. Both sides are recorded: who did it and to whom.
  console.log('[admin] content moderator role changed', {
    actorId: actor.id,
    targetUserId: target.id,
    contentModerator,
  });

  return NextResponse.json({
    success: true,
    data: { userId, contentModerator },
  });
}

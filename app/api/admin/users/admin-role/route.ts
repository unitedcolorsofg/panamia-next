import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { checkSuperAdminAuth } from '@/lib/server/admin-auth';
import { isAdminEmail } from '@/lib/server/admin-emails';

/**
 * Grant or revoke admin for one account.
 *
 * POST { userId: string, admin: boolean }
 *
 * Gated on checkSuperAdminAuth, not checkAdminAuth: only ADMIN_EMAILS members
 * may change who is an admin. A column-granted admin can use every admin
 * screen but cannot reach this route, so the grant power cannot replicate
 * itself out of the tier that holds it. See lib/server/admin-auth.ts.
 *
 * The grant is written to profiles.roles.admin, alongside the scoped roles
 * that already live there. It takes effect on the target's next request —
 * enrichUserFields re-reads `profiles` on every request, so there is no
 * sign-out step and no cache to bust.
 */
export async function POST(request: NextRequest) {
  const actor = await checkSuperAdminAuth();
  if (!actor) {
    return NextResponse.json(
      { error: 'Not Authorized:superadmin' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = body as { userId?: unknown; admin?: unknown } | null;
  const userId =
    typeof payload?.userId === 'string' ? payload.userId.trim() : '';
  // Strict boolean rather than truthiness: a missing field must not read as a
  // revoke, and the string "false" must not read as a grant.
  if (!userId || typeof payload?.admin !== 'boolean') {
    return NextResponse.json(
      { error: 'Expected { userId: string, admin: boolean }' },
      { status: 400 }
    );
  }
  const admin = payload.admin;

  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'No such user' }, { status: 404 });
  }

  // Refuse a revoke that would not actually revoke anything. isAdmin is the
  // union of the env tier and the column, so clearing the column on an
  // ADMIN_EMAILS member leaves them an admin. Writing it anyway would return
  // success, flip the toggle in the UI, and leave the caller believing they
  // had removed an access the account still has — the worst outcome available
  // here. Removing a founder is a secret change, which is deliberately not
  // something a web session can do.
  if (!admin && isAdminEmail(target.email)) {
    return NextResponse.json(
      {
        error:
          'This account is an admin through ADMIN_EMAILS, so clearing the ' +
          'column would not remove its access. Remove the address from the ' +
          'ADMIN_EMAILS secret instead.',
      },
      { status: 409 }
    );
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

  // Merge rather than replace: this column also carries mentoringModerator,
  // eventOrganizer and contentModerator, and a bare set would silently drop
  // whichever of those the account already held.
  const existingRoles = (profile.roles ?? {}) as Record<string, unknown>;
  const nextRoles = { ...existingRoles, admin };

  await db
    .update(profiles)
    .set({ roles: nextRoles })
    .where(eq(profiles.id, profile.id));

  // Not an audit table — a structured line so a grant is at least recoverable
  // from logs. Both sides are recorded: who did it and to whom.
  console.log('[admin] admin role changed', {
    actorId: actor.id,
    targetUserId: target.id,
    admin,
  });

  return NextResponse.json({ success: true, data: { userId, admin } });
}

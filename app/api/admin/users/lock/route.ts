import { NextRequest, NextResponse } from 'next/server';

import { checkAdminAuth } from '@/lib/server/admin-auth';
import { lockUser, unlockUser } from '@/lib/admin/users';

/**
 * Lock or unlock an account.
 *
 * POST { userId, action: 'lock' | 'unlock', reason }
 *
 * ## Why admin and not founder-only
 *
 * Granting admin is gated on ADMIN_EMAILS because an admin who can mint
 * admins is self-replicating. Locking carries no such property: it takes
 * access away, it is reversible, and every use of it is recorded with a name
 * against it. Putting it behind the founder tier would mean the response to
 * somebody abusing the site at 2am is to wait for one specific person to wake
 * up, which is how a safety tool becomes decorative.
 *
 * The escalation path that *would* matter is closed in lockUser() instead: no
 * account holding admin in either tier can be locked at all. So this cannot
 * be used to remove a founder, and two admins cannot lock each other into a
 * stalemate. Demoting someone first is deliberate friction on a different
 * screen with a different permission.
 */
export async function POST(request: NextRequest) {
  const actor = await checkAdminAuth();
  if (!actor) {
    return NextResponse.json({ error: 'Not Authorized:admin' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const { userId, action, reason } = (body ?? {}) as {
    userId?: unknown;
    action?: unknown;
    reason?: unknown;
  };

  if (typeof userId !== 'string' || userId.length === 0) {
    return NextResponse.json({ error: 'Which account?' }, { status: 400 });
  }
  if (action !== 'lock' && action !== 'unlock') {
    return NextResponse.json(
      { error: "action must be 'lock' or 'unlock'." },
      { status: 400 }
    );
  }
  if (typeof reason !== 'string') {
    return NextResponse.json({ error: 'A reason is required.' }, { status: 400 });
  }

  // The acting admin may be an ADMIN_EMAILS address with no account row, in
  // which case there is no id to record and the email is the whole identity.
  const actorRef = {
    userId: typeof actor.id === 'string' ? actor.id : null,
    email: typeof actor.email === 'string' ? actor.email : 'unknown',
  };

  const result =
    action === 'lock'
      ? await lockUser(userId, reason, actorRef)
      : await unlockUser(userId, reason, actorRef);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    sessionsRevoked: result.sessionsRevoked,
  });
}

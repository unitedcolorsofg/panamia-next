import { auth } from '@/auth';

/**
 * Check if the current session user is an admin.
 *
 * Admin is the union of two tiers, resolved by enrichUserFields() in auth.ts
 * and surfaced as session.user.isAdmin:
 *
 *   - ADMIN_EMAILS membership (the founder tier), and
 *   - profiles.roles.admin, granted from /admin/users/live.
 *
 * Use this for ordinary admin gates — reading a queue, working the inbox,
 * exporting. It is the same source of truth the UI reads, so a screen and its
 * API can never disagree about who is allowed in.
 *
 * Returns the session user if admin, null otherwise.
 */
export async function checkAdminAuth() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return null;
  }
  return session.user;
}

/**
 * Check if the current session user may grant or revoke admin.
 *
 * This is the narrower, env-only tier: ADMIN_EMAILS membership, never the
 * column. Use it for anything that changes who is an admin, and nothing else.
 *
 * The split exists to bound the blast radius. If every admin could mint
 * admins, one compromised staff account would be self-replicating and
 * effectively permanent — revoking the original would not revoke what it had
 * already created, and there would be no tier left that the attacker could not
 * reach. Keeping the grant power on the env var means the recovery path lives
 * somewhere a web session cannot touch: changing it requires access to the
 * Cloudflare secret, not just a cookie.
 *
 * It also means a granted admin cannot quietly promote themselves to the tier
 * that would let them keep access after being revoked.
 *
 * Returns the session user if super admin, null otherwise.
 */
export async function checkSuperAdminAuth() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    return null;
  }
  return session.user;
}

/**
 * Check if the current session user may work the abuse-report queue.
 *
 * Admits two groups: admins (either tier), and anyone holding
 * `profiles.roles.contentModerator`. Use it for the report queue and nothing
 * else — a content moderator is deliberately not an admin, and widening this
 * to other staff tools would make it one by accident.
 *
 * ## Why this tier exists
 *
 * Abuse reports used to be mailed to every `ADMIN_EMAILS` entry, which meant
 * the only way to put somebody on the moderation rota was to add them to the
 * secret that decides who may grant admin. Moderation is a job a volunteer
 * does; granting admin is not. Tying them together made the smaller
 * responsibility impossible to hand out without the larger one, so in practice
 * neither moved.
 *
 * `contentModerator` already existed on the roles column and was read into the
 * session, but nothing checked it — this is the gate that gives it meaning.
 *
 * Admins are included rather than required to hold the role separately: they
 * can already reach every other staff tool, so excluding them here would be a
 * gate that protects nothing from anyone it does not also inconvenience.
 *
 * Returns the session user if admin or content moderator, null otherwise.
 */
export async function checkModeratorAuth() {
  const session = await auth();
  if (!session?.user?.isAdmin && !session?.user?.isContentModerator) {
    return null;
  }
  return session.user;
}

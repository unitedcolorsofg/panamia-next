/**
 * The roles a human can be given from the admin surface.
 *
 * One entry per role, read by the roles page, the roster endpoint and the
 * tests. Kept as data for the same reason `views.ts` is: the page that lists
 * roles, the endpoint that reports who holds them and the buttons that grant
 * them must not disagree about what a role is.
 *
 * ## Why this list is shorter than `profiles.roles`
 *
 * That column carries four flags. Two of them — `mentoringModerator` and
 * `eventOrganizer` — are computed into the session at auth.ts:675-676 and read
 * by nothing. No route checks them, no nav entry depends on them, no email
 * goes anywhere because of them.
 *
 * They are deliberately absent here. A permissions manager offering a toggle
 * that grants no permission is worse than one that omits it: it reports
 * success, shows a badge, and leaves both the granter and the grantee
 * believing an access exists. That is the same failure `components/Admin/
 * gate.tsx` was written to prevent, raised one level — and it is harder to
 * notice, because nothing errors.
 *
 * Making one of them real means giving it a gate first, then adding it here.
 * In that order: this file describes enforcement, it does not create it.
 */

/** The `profiles.roles` keys this surface knows how to grant. */
export type GrantableRoleId = 'admin' | 'contentModerator';

/**
 * Who may hand this role out.
 *
 * - `super-admin` — ADMIN_EMAILS membership only. Used for `admin`, so that
 *   the power to create admins cannot itself be granted through the web.
 * - `admin` — any admin. Used for roles that confer no grant power and so
 *   cannot replicate themselves.
 */
export type GrantTier = 'super-admin' | 'admin';

export interface GrantableRole {
  id: GrantableRoleId;
  /** Shown as the section heading on the roles page. */
  name: string;
  /** Singular, for a badge on one person's row. */
  badge: string;
  /** One line: what holding this actually lets someone do. */
  grants: string;
  /** Who may grant and revoke it. */
  grantedBy: GrantTier;
  /** The endpoint that writes it. */
  endpoint: string;
  /**
   * The boolean field name in that endpoint's POST body. Both routes take
   * `{ userId, <field>: boolean }` but spell the field after the role, so the
   * caller cannot send one shape for both.
   */
  field: 'admin' | 'contentModerator';
  /**
   * Whether an environment tier can also confer this role, independently of
   * the column.
   *
   * Only `admin` has one (ADMIN_EMAILS). It matters in two places: the roster
   * must union that tier in or it under-reports, and a revoke against such an
   * account has to be refused rather than silently failing to revoke.
   */
  hasEnvTier: boolean;
}

export const GRANTABLE_ROLES: readonly GrantableRole[] = [
  {
    id: 'admin',
    name: 'Admins',
    badge: 'Admin',
    grants:
      'Every tool on this surface, and the ability to put panas on the ' +
      'moderation rota.',
    grantedBy: 'super-admin',
    endpoint: '/api/admin/users/admin-role',
    field: 'admin',
    hasEnvTier: true,
  },
  {
    id: 'contentModerator',
    name: 'Moderation rota',
    badge: 'Moderation rota',
    grants:
      'The abuse-report queue, and the mail that goes out when a new report ' +
      'arrives. No other tool, and no ability to grant anything.',
    grantedBy: 'admin',
    endpoint: '/api/admin/users/content-moderator',
    field: 'contentModerator',
    hasEnvTier: false,
  },
];

export function grantableRole(id: GrantableRoleId): GrantableRole {
  const role = GRANTABLE_ROLES.find((r) => r.id === id);
  if (!role) throw new Error(`Unknown grantable role: ${id}`);
  return role;
}

/** The access-bearing half of a session, so this file need not import auth. */
export interface GrantActor {
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

/** Whether this actor may grant or revoke this role. */
export function canGrant(role: GrantableRole, actor: GrantActor): boolean {
  return role.grantedBy === 'super-admin' ? actor.isSuperAdmin : actor.isAdmin;
}

/**
 * The mock's stand-in for the admin gate.
 *
 * ## What the real gate is
 *
 * `checkAdminAuth()` in `lib/server/admin-auth.ts`. It reads the session and
 * returns whether `user.isAdmin` is set, which `enrichUserFields()` in
 * `auth.ts` derives by checking the signed-in address against the
 * `ADMIN_EMAILS` environment variable. There is no role column on the user
 * table; admin is a deploy-time list, not data.
 *
 * ## Why this exists instead
 *
 * Reviewing these screens should not require editing `ADMIN_EMAILS` and
 * restarting. So the mock defaults to showing the admin view — the whole
 * surface is admin-only, and somebody who opened it wants to see what is in
 * it — and `?as=visitor` shows what a refusal looks like.
 *
 * The default is inverted relative to how the real thing must behave, which is
 * exactly the kind of inversion that ships by accident. Hence: this module is
 * the only place the default lives, every admin route renders the preview bar
 * saying so out loud, and nothing here is imported by anything that runs
 * against real data. When the views get real writes, delete this file and the
 * bar, and call `checkAdminAuth()` — the pages already branch on a role, so
 * the branch stays and only its source changes.
 */

export type AdminViewerRole = 'admin' | 'visitor';

export const ADMIN_VIEWER_ROLES: readonly AdminViewerRole[] = [
  'admin',
  'visitor',
];

export const ADMIN_ROLE_LABEL: Record<AdminViewerRole, string> = {
  admin: 'Staff',
  visitor: 'Not staff',
};

/**
 * Read `?as=` into a role.
 *
 * Anything unrecognised — including nothing at all — is `admin`. See above for
 * why that is the safe default *here* and would be a severe bug anywhere else.
 */
export function resolveAdminRole(raw: string | undefined): AdminViewerRole {
  return raw === 'visitor' ? 'visitor' : 'admin';
}

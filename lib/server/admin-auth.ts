import { auth } from '@/auth';

/**
 * Check if the current session user is an admin.
 *
 * Admin status is derived solely from the ADMIN_EMAILS env var, surfaced as
 * session.user.isAdmin by enrichUserFields() in auth.ts. We deliberately do NOT
 * consult the database here: the users.role column is never set to 'admin'
 * anywhere, so a DB role check can never pass. This keeps the API gate on the
 * same source of truth the UI already uses.
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

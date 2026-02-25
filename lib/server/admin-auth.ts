import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

/**
 * Check if the current session user is an admin
 * Returns the user if admin, null otherwise
 */
export async function checkAdminAuth() {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, session.user.email.toLowerCase()),
    columns: { id: true, email: true, role: true },
  });

  if (!user || user.role !== 'admin') {
    return null;
  }

  return user;
}

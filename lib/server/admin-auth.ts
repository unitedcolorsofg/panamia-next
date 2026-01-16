import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

/**
 * Check if the current session user is an admin
 * Returns the user if admin, null otherwise
 */
export async function checkAdminAuth() {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  const prisma = await getPrisma();

  const user = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!user || user.role !== 'admin') {
    return null;
  }

  return user;
}

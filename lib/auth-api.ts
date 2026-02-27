// lib/auth-api.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { AppSession } from '@/auth';
import { db } from '@/lib/db';
import { sessions, users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

/**
 * Get session in Pages Router API routes
 *
 * better-auth's auth() function is designed for App Router Server Components.
 * This helper extracts the session token from cookies and validates it using
 * the sessions table directly.
 *
 * @example
 * ```ts
 * import { getApiSession } from '@/lib/auth-api'
 *
 * export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 *   const session = await getApiSession(req, res)
 *   if (!session) {
 *     return res.status(401).json({ error: 'Not authorized' })
 *   }
 *   // ... rest of your handler
 * }
 * ```
 */
export async function getApiSession(
  req: NextApiRequest,
  _res: NextApiResponse
): Promise<AppSession | null> {
  try {
    // better-auth cookie names
    const secureCookieName = '__Secure-better-auth.session_token';
    const cookieName = 'better-auth.session_token';

    const sessionToken =
      req.cookies[secureCookieName] || req.cookies[cookieName];

    if (!sessionToken) {
      return null;
    }

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.token, sessionToken),
      with: { user: true },
    });

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return null;
    }

    const user = session.user as typeof users.$inferSelect;

    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified ?? null,
        name: '',
        image: '',
        isAdmin: false,
        panaVerified: false,
        legalAgeVerified: false,
        isMentoringModerator: false,
        isEventOrganizer: false,
        isContentModerator: false,
      },
      expires: session.expiresAt.toISOString(),
    };
  } catch (error) {
    console.error('Error getting API session:', error);
    return null;
  }
}

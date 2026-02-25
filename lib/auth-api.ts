// lib/auth-api.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Session } from 'next-auth';
import { db } from '@/lib/db';
import { sessions } from '@/lib/schema';
import { eq } from 'drizzle-orm';

/**
 * Get session in Pages Router API routes
 *
 * NextAuth v5's auth() function is designed for App Router Server Components
 * and causes "headers was called outside a request scope" errors in Pages Router.
 *
 * This helper extracts the session token from cookies and validates it using
 * NextAuth's session management via Drizzle.
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
  res: NextApiResponse
): Promise<Session | null> {
  try {
    // Extract session token from cookies
    // NextAuth v5 uses "__Secure-authjs.session-token" in production (HTTPS)
    // and "authjs.session-token" in development (HTTP)
    const secureCookieName = '__Secure-authjs.session-token';
    const cookieName = 'authjs.session-token';

    const sessionToken =
      req.cookies[secureCookieName] || req.cookies[cookieName];

    if (!sessionToken) {
      return null;
    }

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.sessionToken, sessionToken),
      with: { user: true },
    });

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expires && new Date(session.expires) < new Date()) {
      return null;
    }

    // Return session in NextAuth format
    // Note: This returns a minimal session - callbacks in auth.ts add additional
    // properties like isAdmin, panaVerified, etc. when using the full auth flow.
    return {
      user: {
        id: session.user.id,
        name: '',
        email: session.user.email || '',
        image: '',
        emailVerified: session.user.emailVerified,
        // These are populated by session callback in auth.ts, but we provide defaults
        // for the API-only session lookup
        isAdmin: false,
        panaVerified: false,
        legalAgeVerified: false,
        isMentoringModerator: false,
        isEventOrganizer: false,
        isContentModerator: false,
      },
      expires: session.expires.toISOString(),
    };
  } catch (error) {
    console.error('Error getting API session:', error);
    return null;
  }
}

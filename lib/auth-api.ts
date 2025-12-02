// lib/auth-api.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import type { Session } from 'next-auth'

/**
 * Get session in Pages Router API routes
 *
 * NextAuth v5's auth() function is designed for App Router Server Components
 * and causes "headers was called outside a request scope" errors in Pages Router.
 *
 * This helper extracts the session token from cookies and validates it using
 * NextAuth's session management.
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
    const secureCookieName = '__Secure-authjs.session-token'
    const cookieName = 'authjs.session-token'

    const sessionToken = req.cookies[secureCookieName] || req.cookies[cookieName]

    if (!sessionToken) {
      return null
    }

    // Use the MongoDB adapter to get session and user
    const { MongoDBAdapter } = await import('@auth/mongodb-adapter')
    const clientPromise = (await import('@/lib/mongodb')).default

    const mongoAdapterOptions = {
      collections: {
        Accounts: 'nextauth_accounts',
        Sessions: 'nextauth_sessions',
        Users: 'nextauth_users',
        VerificationTokens: 'nextauth_verification_tokens',
      },
    }

    const adapter = MongoDBAdapter(clientPromise, mongoAdapterOptions)

    if (!adapter.getSessionAndUser) {
      return null
    }

    const sessionAndUser = await adapter.getSessionAndUser(sessionToken)

    if (!sessionAndUser) {
      return null
    }

    const { session, user } = sessionAndUser

    // Check if session is expired
    if (session.expires && new Date(session.expires) < new Date()) {
      return null
    }

    // Return session in NextAuth format
    return {
      // @ts-ignore - Type conflict between @auth/core versions
      user: {
        name: user.name || '',
        email: user.email || '',
        image: user.image || '',
      },
      expires: session.expires.toISOString(),
    }
  } catch (error) {
    console.error('Error getting API session:', error)
    return null
  }
}

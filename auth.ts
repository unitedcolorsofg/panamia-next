import NextAuth from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb';

const mongoAdapterOptions = {
  collections: {
    Accounts: 'nextauth_accounts',
    Sessions: 'nextauth_sessions',
    Users: 'nextauth_users',
    VerificationTokens: 'nextauth_verification_tokens',
  },
};

// Fix for NextAuth v5 beta useVerificationToken issue
// See: https://github.com/nextauthjs/next-auth/discussions/7363
// See: https://github.com/nextauthjs/next-auth/discussions/4585
// Note: NextAuth already hashes the token before calling this function,
// so we search for params.token directly (no additional hashing needed)
async function customUseVerificationToken(params: {
  identifier: string;
  token: string;
}) {
  const client = await clientPromise;
  const db = client.db();
  const collection = db.collection('nextauth_verification_tokens');

  // console.log('customUseVerificationToken searching for:', {
  //   identifier: params.identifier,
  //   token: params.token,
  // })

  // Check all tokens in the database
  const allTokens = await collection
    .find({ identifier: params.identifier })
    .toArray();
  // console.log('All tokens in DB for this email:', allTokens)

  const verificationToken = await collection.findOne({
    identifier: params.identifier,
    token: params.token,
  });

  // console.log('Found token:', verificationToken)

  if (!verificationToken) {
    return null;
  }

  // Delete the token after retrieving it (one-time use)
  await collection.deleteOne({
    identifier: params.identifier,
    token: params.token,
  });

  return {
    identifier: verificationToken.identifier,
    token: verificationToken.token,
    expires: verificationToken.expires,
  };
}

const baseAdapter = MongoDBAdapter(clientPromise, mongoAdapterOptions);

// WORKAROUND: Store the last updated/created user ID for createSession
// This fixes a NextAuth v5 beta bug where createSession is called without userId
// See: https://github.com/nextauthjs/next-auth/issues/13346
let lastUserIdFromUpdate: string | null = null;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: {
    ...baseAdapter,
    // @ts-ignore - Type conflict between @auth/core versions in next-auth and mongodb-adapter
    updateUser: async (user) => {
      // console.log('[DEBUG] updateUser called with:', JSON.stringify(user, null, 2))

      // WORKAROUND: Capture the user ID from the INPUT parameter (before calling base adapter)
      // See: https://github.com/nextauthjs/next-auth/issues/13346
      if (user.id) {
        lastUserIdFromUpdate = user.id;
        // console.log('[DEBUG] Captured userId from updateUser input:', lastUserIdFromUpdate)
      }

      const result = await baseAdapter.updateUser!(user);
      // console.log('[DEBUG] updateUser result:', JSON.stringify(result, null, 2))

      return result;
    },
    // @ts-ignore - Type conflict between @auth/core versions in next-auth and mongodb-adapter
    useVerificationToken: async (params) => {
      const result = await baseAdapter.useVerificationToken!(params);

      // WORKAROUND: MongoDB adapter returns operation result {value, ok, lastErrorObject}
      // Extract the actual document from .value property
      // See: https://github.com/nextauthjs/next-auth/issues/13346
      let verificationToken = result;
      if (result && typeof result === 'object' && 'value' in result) {
        verificationToken = result.value as typeof result;
      }

      if (!verificationToken) {
        return null;
      }

      // WORKAROUND: Ensure expires is a proper Date object
      // See: https://github.com/nextauthjs/next-auth/issues/13346
      if (verificationToken.expires) {
        verificationToken.expires = new Date(verificationToken.expires);
      }

      return verificationToken;
    },
    // @ts-ignore - Type conflict between @auth/core versions in next-auth and mongodb-adapter
    createSession: async (session) => {
      // console.log('[DEBUG] createSession called with:', JSON.stringify(session, null, 2))

      // WORKAROUND: If userId is missing, use the one captured from updateUser
      // This fixes a NextAuth v5 beta bug where createSession is called without userId
      // See: https://github.com/nextauthjs/next-auth/issues/13346
      if (!session.userId && lastUserIdFromUpdate) {
        // console.log('[DEBUG] Adding missing userId from updateUser:', lastUserIdFromUpdate)
        session.userId = lastUserIdFromUpdate;
        lastUserIdFromUpdate = null; // Clear it after use
      } else if (!session.userId) {
        console.error(
          '[ERROR] createSession called without userId and no cached userId available!'
        );
      }

      const result = await baseAdapter.createSession!(session);
      // console.log('[DEBUG] createSession raw result:', JSON.stringify(result, null, 2))
      return result;
    },
    // @ts-ignore - Type conflict between @auth/core versions in next-auth and mongodb-adapter
    getSessionAndUser: async (sessionToken) => {
      // console.log('[DEBUG] getSessionAndUser called with token:', sessionToken)
      const result = await baseAdapter.getSessionAndUser!(sessionToken);
      // console.log('[DEBUG] getSessionAndUser raw result:', JSON.stringify(result, null, 2))

      if (!result) {
        // console.log('[DEBUG] getSessionAndUser: result is null/undefined')
        return null;
      }

      // Check if result has the expected structure {session, user}
      if (result.session && result.user) {
        // console.log('[DEBUG] getSessionAndUser: returning valid session and user')
        // WORKAROUND: Ensure expires is a proper Date object
        // See: https://github.com/nextauthjs/next-auth/issues/13346
        if (result.session.expires) {
          result.session.expires = new Date(result.session.expires);
        }
        if (result.user.emailVerified) {
          result.user.emailVerified = new Date(result.user.emailVerified);
        }
        return result;
      }

      // console.log('[DEBUG] getSessionAndUser: unexpected result format')
      return null;
    },
  },
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url, provider }) {
        // Development: log to console
        console.log('\n===== MAGIC SIGN-IN LINK =====');
        console.log(`Email: ${identifier}`);
        console.log(`Link:  ${url}`);
        console.log('================================\n');
        return Promise.resolve();
      },
    }),
  ],
  session: {
    strategy: 'database',
  },
  callbacks: {
    async session({ session, user }) {
      // console.log('Session callback called:', { session, user })

      // Attach user data to session
      if (user) {
        session.user = {
          ...session.user,
          id: user.id,
          email: user.email || '',
          emailVerified: user.emailVerified,
          // Privacy: clear name and image
          name: '',
          image: '',
        };
      }

      // console.log('Session callback returning:', session)
      return session;
    },
  },
  theme: {
    logo: '/logos/2023_logo_pink.svg',
    brandColor: '#4ab3ea',
    buttonText: '#fff',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: false,
});

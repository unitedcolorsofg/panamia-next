import NextAuth from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';
import WikimediaProvider from 'next-auth/providers/wikimedia';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb';
import dbConnect from '@/lib/connectdb';
import profile from '@/lib/model/profile';

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
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            'openid email profile https://www.googleapis.com/auth/calendar.events',
        },
      },
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'name email',
        },
      },
    }),
    // NOTE: Wikimedia removed from trusted providers - emails are optional and may not be verified
    // Users can make emails private, so email verification is not guaranteed
    WikimediaProvider({
      clientId: process.env.WIKIMEDIA_CLIENT_ID!,
      clientSecret: process.env.WIKIMEDIA_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request email explicitly (users can make it private)
          scope: 'identify email',
        },
      },
    }),
    // Mastodon - Custom OAuth provider (users enter their own instance)
    // Only mastodon.social is trusted for auto-claim; other instances are untrusted
    {
      id: 'mastodon',
      name: 'Mastodon',
      type: 'oauth' as const,
      authorization: {
        url: process.env.MASTODON_INSTANCE
          ? `${process.env.MASTODON_INSTANCE}/oauth/authorize`
          : 'https://mastodon.social/oauth/authorize',
        params: { scope: 'read:accounts profile:email' },
      },
      token: {
        url: process.env.MASTODON_INSTANCE
          ? `${process.env.MASTODON_INSTANCE}/oauth/token`
          : 'https://mastodon.social/oauth/token',
      },
      userinfo: {
        url: process.env.MASTODON_INSTANCE
          ? `${process.env.MASTODON_INSTANCE}/api/v1/accounts/verify_credentials`
          : 'https://mastodon.social/api/v1/accounts/verify_credentials',
      },
      profile(profile) {
        return {
          id: profile.id,
          name: profile.display_name || profile.username,
          email: profile.email || null,
          image: profile.avatar,
        };
      },
      clientId: process.env.MASTODON_CLIENT_ID!,
      clientSecret: process.env.MASTODON_CLIENT_SECRET!,
    },
    // TODO: Add Bluesky OAuth provider when NextAuth support is available
    // Bluesky uses AT Protocol OAuth with email scope: transition:email
    // Requires client metadata file, DPoP, and PAR
    // Reference: https://docs.bsky.app/docs/advanced-guides/oauth-client
    // {
    //   id: 'bluesky',
    //   name: 'Bluesky',
    //   type: 'oauth' as const,
    //   // Implementation requires @atproto/oauth-client or similar
    // },
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
    }),
  ],
  session: {
    strategy: 'database',
  },
  callbacks: {
    async signIn({ user, account, profile: oauthProfile }) {
      // Require email for all sign-in methods
      if (!user.email) {
        console.error('Sign-in blocked: No email provided by OAuth provider', {
          provider: account?.provider,
          userId: user.id,
        });
        // Returning false will show an error page
        return '/signin?error=EmailRequired';
      }

      // Determine if provider is trusted for auto-claiming profiles
      // Trusted providers verify email ownership before providing email addresses
      const trustedProviders = ['google', 'apple', 'email'];

      // Trusted Mastodon instances (official and well-known instances only)
      const trustedMastodonInstances = ['mastodon.social'];

      let isTrustedProvider = false;

      if (account?.provider) {
        if (trustedProviders.includes(account.provider)) {
          isTrustedProvider = true;
        } else if (account.provider === 'mastodon') {
          // For Mastodon, check if it's a trusted instance
          const mastodonInstance =
            process.env.MASTODON_INSTANCE || 'https://mastodon.social';
          const instanceHost = new URL(mastodonInstance).hostname;
          isTrustedProvider = trustedMastodonInstances.includes(instanceHost);
        }
      }

      if (isTrustedProvider) {
        // Automatically claim any unclaimed profile with matching email
        try {
          await dbConnect();
          const unclaimedProfile = await profile.findOne({
            email: user.email.toLowerCase(),
            $or: [{ userId: { $exists: false } }, { userId: null }],
          });

          if (unclaimedProfile && user.id) {
            // Auto-claim profile from trusted provider
            console.log(
              'Auto-claiming profile for user:',
              user.email,
              'from trusted provider:',
              account.provider
            );
            unclaimedProfile.userId = user.id;
            await unclaimedProfile.save();
            console.log('Profile claimed successfully');
          }
        } catch (error) {
          console.error('Error auto-claiming profile:', error);
          // Don't block sign-in if claiming fails
        }
      } else {
        console.log(
          'Skipping auto-claim for untrusted provider:',
          account?.provider
        );
      }

      return true;
    },
    async session({ session, user }) {
      // console.log('Session callback called:', { session, user })

      // Attach user data to session
      if (user) {
        // Check admin status from environment variable
        const adminEmails =
          process.env.ADMIN_EMAILS?.split(',').map((e) =>
            e.trim().toLowerCase()
          ) || [];
        const isAdmin =
          user.email && adminEmails.includes(user.email.toLowerCase());

        // Fetch profile to get verification badges and roles
        let userProfile = null;
        try {
          await dbConnect();
          userProfile = await profile.findOne({ userId: user.id });
        } catch (error) {
          console.error('Error fetching profile in session callback:', error);
        }

        session.user = {
          ...session.user,
          id: user.id,
          email: user.email || '',
          emailVerified: user.emailVerified,
          // Privacy: clear name and image
          name: '',
          image: '',

          // Admin role (from environment variable)
          isAdmin: isAdmin || false,

          // Verification badges (from profile)
          panaVerified: userProfile?.verification?.panaVerified || false,
          legalAgeVerified:
            userProfile?.verification?.legalAgeVerified || false,

          // Scoped roles (from profile)
          isMentoringModerator: userProfile?.roles?.mentoringModerator || false,
          isEventOrganizer: userProfile?.roles?.eventOrganizer || false,
          isContentModerator: userProfile?.roles?.contentModerator || false,
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

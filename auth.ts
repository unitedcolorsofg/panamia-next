import NextAuth from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';
import WikimediaProvider from 'next-auth/providers/wikimedia';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb';
import dbConnect from '@/lib/connectdb';
import profile from '@/lib/model/profile';

// Custom email templates for magic link authentication
function html(params: { url: string; host: string; email: string }) {
  const { url, host, email } = params;
  const escapedEmail = email.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedHost = host.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const brandColor = '#4ab3ea';
  const buttonBg = '#ec4899';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 3px solid ${brandColor};">
              <h1 style="margin: 0; color: #111827; font-size: 28px; font-weight: 700;">Pana MIA</h1>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">South Florida's Creative Community</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 22px; font-weight: 600;">Sign in to your account</h2>

              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Hi there! Click the button below to securely sign in to <strong>${escapedHost}</strong>.
              </p>

              <p style="margin: 0 0 30px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                This link will expire in <strong>24 hours</strong> and can only be used once.
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${url}" style="display: inline-block; background-color: ${buttonBg}; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      Sign in to Pana MIA
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0 0; color: ${brandColor}; font-size: 13px; word-break: break-all; line-height: 1.6;">
                ${url}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                This email was sent to <strong>${escapedEmail}</strong>.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                If you didn't request this email, you can safely ignore it. The link will expire automatically.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function text(params: { url: string; host: string }) {
  const { url, host } = params;
  return `Sign in to Pana MIA\n\n${url}\n\nThis link will expire in 24 hours and can only be used once.\n\nIf you didn't request this email, you can safely ignore it.\n`;
}

// Email template for email migration verification (sent to new email)
export function emailMigrationVerificationHtml(params: {
  url: string;
  oldEmail: string;
  newEmail: string;
}) {
  const { url, oldEmail, newEmail } = params;
  const escapedOldEmail = oldEmail.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedNewEmail = newEmail.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const brandColor = '#4ab3ea';
  const buttonBg = '#ec4899';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 3px solid ${brandColor};">
              <h1 style="margin: 0; color: #111827; font-size: 28px; font-weight: 700;">Pana MIA</h1>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">South Florida's Creative Community</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 22px; font-weight: 600;">Verify Your Email Migration</h2>

              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                You requested to migrate your Pana MIA account email from <strong>${escapedOldEmail}</strong> to <strong>${escapedNewEmail}</strong>.
              </p>

              <div style="margin: 0 0 30px 0; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; color: #92400e; font-size: 14px; font-weight: 600;">Important:</p>
                <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 14px; line-height: 1.6;">
                  <li>This link expires in <strong>5 minutes</strong></li>
                  <li>You will be signed out of all devices</li>
                  <li>A confirmation will be sent to your old email</li>
                </ul>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${url}" style="display: inline-block; background-color: ${buttonBg}; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      Complete Email Migration
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0 0; color: ${brandColor}; font-size: 13px; word-break: break-all; line-height: 1.6;">
                ${url}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                If you didn't request this email migration, please ignore this email and contact us immediately.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export function emailMigrationVerificationText(params: {
  url: string;
  oldEmail: string;
  newEmail: string;
}) {
  const { url, oldEmail, newEmail } = params;
  return `Verify Your Email Migration\n\nYou requested to migrate your Pana MIA account email from ${oldEmail} to ${newEmail}.\n\nImportant:\n- This link expires in 5 minutes\n- You will be signed out of all devices\n- A confirmation will be sent to your old email\n\nClick here to complete the migration:\n${url}\n\nIf you didn't request this, please ignore this email and contact us immediately.`;
}

// Email template for migration confirmation (sent to old email)
export function emailMigrationConfirmationHtml(params: {
  oldEmail: string;
  newEmail: string;
  timestamp: string;
}) {
  const { oldEmail, newEmail, timestamp } = params;
  const escapedOldEmail = oldEmail.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedNewEmail = newEmail.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const brandColor = '#4ab3ea';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0;">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 3px solid ${brandColor};">
              <h1 style="margin: 0; color: #111827; font-size: 28px; font-weight: 700;">Pana MIA</h1>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">South Florida's Creative Community</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 22px; font-weight: 600;">Your Account Email Was Changed</h2>

              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Your Pana MIA account email was successfully migrated on <strong>${timestamp}</strong>.
              </p>

              <div style="margin: 0 0 30px 0; padding: 20px; background-color: #eff6ff; border-left: 4px solid ${brandColor}; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 14px;"><strong>Previous email:</strong> ${escapedOldEmail}</p>
                <p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>New email:</strong> ${escapedNewEmail}</p>
              </div>

              <div style="margin: 0 0 20px 0; padding: 20px; background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 14px; font-weight: 600;">If you didn't authorize this change:</p>
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
                  Please contact us immediately at <a href="mailto:hola@panamia.club" style="color: #dc2626; text-decoration: underline;">hola@panamia.club</a>. Your account security may be compromised.
                </p>
              </div>

              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                You have been signed out of all devices. Please sign in with your new email address to continue using Pana MIA.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                This is an automated security notification. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export function emailMigrationConfirmationText(params: {
  oldEmail: string;
  newEmail: string;
  timestamp: string;
}) {
  const { oldEmail, newEmail, timestamp } = params;
  return `Your Account Email Was Changed\n\nYour Pana MIA account email was successfully migrated on ${timestamp}.\n\nPrevious email: ${oldEmail}\nNew email: ${newEmail}\n\nIf you didn't authorize this change, please contact us immediately at hola@panamia.club. Your account security may be compromised.\n\nYou have been signed out of all devices. Please sign in with your new email address to continue using Pana MIA.`;
}

// Email template for OAuth email verification (sent to OAuth-provided email)
export function oauthVerificationHtml(params: {
  url: string;
  email: string;
  provider: string;
}) {
  const { url, email, provider } = params;
  const escapedEmail = email.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  const brandColor = '#4ab3ea';
  const buttonBg = '#ec4899';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 3px solid ${brandColor};">
              <h1 style="margin: 0; color: #111827; font-size: 28px; font-weight: 700;">Pana MIA</h1>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">South Florida's Creative Community</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 22px; font-weight: 600;">Verify your email address</h2>

              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                You signed in to Pana MIA using <strong>${providerName}</strong>.
                To complete your sign-in and verify email ownership, click the button below.
              </p>

              <p style="margin: 0 0 30px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                This link will expire in <strong>5 minutes</strong> for security.
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${url}" style="display: inline-block; background-color: ${buttonBg}; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      Verify Email &amp; Sign In
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0 0; color: ${brandColor}; font-size: 13px; word-break: break-all; line-height: 1.6;">
                ${url}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                This email was sent to <strong>${escapedEmail}</strong>.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                If you didn't request this, you can safely ignore it. The link will expire automatically.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export function oauthVerificationText(params: {
  url: string;
  email: string;
  provider: string;
}) {
  const { url, provider } = params;
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  return `Verify Your Email for Pana MIA\n\nYou signed in using ${providerName}. To complete sign-in and verify email ownership, click the link below:\n\n${url}\n\nThis link expires in 5 minutes for security.\n\nIf you didn't request this, you can safely ignore this email.`;
}

// Helper function to determine OAuth provider verification requirement
function getProviderVerificationConfig(
  provider?: string
): 'trusted' | 'verification-required' | 'disabled' {
  if (!provider) return 'disabled';

  // Email provider is always trusted (we send the magic link)
  if (provider === 'email') return 'trusted';

  // Check for instance-specific config (e.g., OAUTH_MASTODON_SOCIAL for mastodon.social)
  if (provider === 'mastodon') {
    const instance = process.env.MASTODON_INSTANCE || 'https://mastodon.social';
    const hostname = new URL(instance).hostname;
    // Check for explicit mastodon.social config
    if (hostname === 'mastodon.social') {
      const config = process.env.OAUTH_MASTODON_SOCIAL;
      if (config)
        return config as 'trusted' | 'verification-required' | 'disabled';
    }
    // Otherwise use generic mastodon config
    const genericConfig = process.env.OAUTH_MASTODON;
    if (genericConfig)
      return genericConfig as 'trusted' | 'verification-required' | 'disabled';
  }

  // Check provider-level config
  const envKey = `OAUTH_${provider.toUpperCase()}`;
  const config = process.env[envKey];
  if (config) return config as 'trusted' | 'verification-required' | 'disabled';

  // Default to verification-required for unknown providers
  return 'verification-required';
}

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
    // @ts-ignore - Custom OAuth provider type compatibility
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
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const { host } = new URL(url);
        const transport = await provider.server;
        // @ts-ignore - NextAuth type compatibility issue with nodemailer transport
        const result = await transport.sendMail({
          to: email,
          from: provider.from,
          subject: `Sign in to Pana MIA`,
          text: text({ url, host }),
          html: html({ url, host, email }),
        });
        const failed = result.rejected.concat(result.pending).filter(Boolean);
        if (failed.length) {
          throw new Error(`Email(s) (${failed.join(', ')}) could not be sent`);
        }
      },
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
        return '/signin?error=EmailRequired';
      }

      // Determine provider verification requirement
      const providerConfig = getProviderVerificationConfig(account?.provider);

      if (providerConfig === 'disabled') {
        console.log(
          'Sign-in blocked: Provider is disabled:',
          account?.provider
        );
        return '/signin?error=ProviderDisabled';
      }

      if (providerConfig === 'verification-required') {
        // Block sign-in and send verification email
        try {
          await dbConnect();
          const oauthVerification = (
            await import('@/lib/model/oauthVerification')
          ).default;
          const nodemailer = await import('nodemailer');
          const { nanoid } = await import('nanoid');

          // Check if verification already sent recently
          const existingVerification = await oauthVerification.findOne({
            provider: account?.provider,
            providerAccountId: account?.providerAccountId,
            expiresAt: { $gt: new Date() },
          });

          if (existingVerification) {
            console.log('Verification email already sent for:', user.email);
            return '/signin?verificationSent=true';
          }

          // Generate verification token
          const verificationToken = nanoid(32);
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

          // Create verification record
          await oauthVerification.create({
            email: user.email.toLowerCase(),
            provider: account?.provider,
            providerAccountId: account?.providerAccountId,
            verificationToken,
            expiresAt,
            oauthProfile: {
              name: user.name,
              email: user.email,
              image: user.image,
            },
          });

          // Send verification email
          const protocol = process.env.NEXTAUTH_URL?.startsWith('https')
            ? 'https'
            : 'http';
          const host =
            process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '') ||
            'localhost:3000';
          const verificationUrl = `${protocol}://${host}/verify-oauth-email?token=${verificationToken}`;

          const transport = nodemailer.createTransport({
            host: process.env.EMAIL_SERVER_HOST!,
            port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
            secure: false,
            auth: {
              user: process.env.EMAIL_SERVER_USER!,
              pass: process.env.EMAIL_SERVER_PASSWORD!,
            },
          });

          await transport.sendMail({
            from: process.env.EMAIL_FROM!,
            to: user.email,
            subject: 'Verify Your Email for Pana MIA',
            html: oauthVerificationHtml({
              url: verificationUrl,
              email: user.email,
              provider: account?.provider || 'OAuth',
            }),
            text: oauthVerificationText({
              url: verificationUrl,
              email: user.email,
              provider: account?.provider || 'OAuth',
            }),
          });

          console.log('Verification email sent to:', user.email);
          return '/signin?verificationSent=true';
        } catch (error) {
          console.error('Error sending verification email:', error);
          return '/signin?error=VerificationFailed';
        }
      }

      // Trusted provider - proceed with auto-claim
      try {
        await dbConnect();
        const unclaimedProfile = await profile.findOne({
          email: user.email.toLowerCase(),
          $or: [{ userId: { $exists: false } }, { userId: null }],
        });

        if (unclaimedProfile && user.id) {
          console.log(
            'Auto-claiming profile for user:',
            user.email,
            'from trusted provider:',
            account?.provider
          );
          unclaimedProfile.userId = user.id;
          await unclaimedProfile.save();
          console.log('Profile claimed successfully');
        }
      } catch (error) {
        console.error('Error auto-claiming profile:', error);
        // Don't block sign-in if claiming fails
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
  pages: {
    signIn: '/signin', // Use our custom sign-in page instead of /api/auth/signin
  },
  theme: {
    logo: '/logos/2023_logo_pink.svg',
    brandColor: '#4ab3ea',
    buttonText: '#fff',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: false,
});

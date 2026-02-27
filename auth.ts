import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink, genericOAuth } from 'better-auth/plugins';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import {
  users,
  sessions,
  accounts,
  verification,
  oAuthVerifications,
  profiles,
} from '@/lib/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import BrevoApi from '@/lib/brevo_api';

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

// =============================================================================
// AppSession type — shared shape for server-side session access
// =============================================================================

export type AppSession = {
  user: {
    id: string;
    email: string;
    emailVerified: Date | null;
    name?: string | null;
    image?: string | null;

    // Admin role (from environment variable)
    isAdmin: boolean;

    // Verification badges (from profile)
    panaVerified: boolean;
    legalAgeVerified: boolean;

    // Scoped roles (from profile)
    isMentoringModerator: boolean;
    isEventOrganizer: boolean;
    isContentModerator: boolean;
  };
  expires: string;
};

// =============================================================================
// Provider verification configuration
// =============================================================================

function getProviderVerificationConfig(
  provider?: string
): 'trusted' | 'verification-required' | 'disabled' {
  if (!provider) return 'disabled';

  // Magic link provider is always trusted (we send the link)
  if (provider === 'credential' || provider === 'magic-link') return 'trusted';

  // Check for instance-specific mastodon config
  if (provider === 'mastodon') {
    const instance = process.env.MASTODON_INSTANCE || 'https://mastodon.social';
    const hostname = new URL(instance).hostname;
    if (hostname === 'mastodon.social') {
      const config = process.env.OAUTH_MASTODON_SOCIAL;
      if (config)
        return config as 'trusted' | 'verification-required' | 'disabled';
    }
    const genericConfig = process.env.OAUTH_MASTODON;
    if (genericConfig)
      return genericConfig as 'trusted' | 'verification-required' | 'disabled';
  }

  const envKey = `OAUTH_${provider.toUpperCase()}`;
  const config = process.env[envKey];
  if (config) return config as 'trusted' | 'verification-required' | 'disabled';

  return 'verification-required';
}

// =============================================================================
// better-auth instance
// =============================================================================

export const betterAuthInstance = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification,
    },
    usePlural: true,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar.events',
      ],
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const { host } = new URL(url);
        await new BrevoApi().sendEmail(
          email,
          'Sign in to Pana MIA',
          html({ url, host, email }),
          text({ url, host })
        );
      },
    }),
    genericOAuth({
      config: [
        // Wikimedia — emails are optional and may not be verified
        {
          providerId: 'wikimedia',
          clientId: process.env.WIKIMEDIA_CLIENT_ID!,
          clientSecret: process.env.WIKIMEDIA_CLIENT_SECRET!,
          authorizationUrl:
            'https://meta.wikimedia.org/w/rest.php/oauth2/authorize',
          tokenUrl: 'https://meta.wikimedia.org/w/rest.php/oauth2/access_token',
          userInfoUrl:
            'https://meta.wikimedia.org/w/rest.php/oauth2/resource/profile',
          scopes: ['identify', 'email'],
          mapProfileToUser: (profile: Record<string, unknown>) => ({
            id: String(profile.sub || profile.id),
            email: (profile.email as string) || undefined,
            name: (profile.realname as string) || (profile.username as string),
            image: undefined,
          }),
        },
        // Mastodon — custom OAuth per-instance
        {
          providerId: 'mastodon',
          clientId: process.env.MASTODON_CLIENT_ID!,
          clientSecret: process.env.MASTODON_CLIENT_SECRET!,
          authorizationUrl: process.env.MASTODON_INSTANCE
            ? `${process.env.MASTODON_INSTANCE}/oauth/authorize`
            : 'https://mastodon.social/oauth/authorize',
          tokenUrl: process.env.MASTODON_INSTANCE
            ? `${process.env.MASTODON_INSTANCE}/oauth/token`
            : 'https://mastodon.social/oauth/token',
          userInfoUrl: process.env.MASTODON_INSTANCE
            ? `${process.env.MASTODON_INSTANCE}/api/v1/accounts/verify_credentials`
            : 'https://mastodon.social/api/v1/accounts/verify_credentials',
          scopes: ['read:accounts'],
          mapProfileToUser: (profile: Record<string, unknown>) => ({
            id: String(profile.id),
            email: (profile.email as string) || undefined,
            name:
              (profile.display_name as string) ||
              (profile.username as string) ||
              undefined,
            image: (profile.avatar as string) || undefined,
          }),
        },
      ],
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!user.email) {
            console.error('Sign-in blocked: No email provided', {
              userId: user.id,
            });
            return false;
          }
        },
      },
    },
    account: {
      create: {
        before: async (account) => {
          const config = getProviderVerificationConfig(account.providerId);

          if (config === 'disabled') {
            console.log(
              'Sign-in blocked: Provider is disabled:',
              account.providerId
            );
            return false;
          }

          if (config === 'verification-required') {
            // TODO(QA): send verification email via oAuthVerifications + redirect
            // to /signin?verificationSent=true. Requires an HTTP-level hook to
            // intercept the OAuth callback and redirect. For now we block the
            // account creation — the user will see a generic auth error.
            console.log(
              'Sign-in blocked: Provider requires verification:',
              account.providerId
            );
            return false;
          }
        },
        after: async (account) => {
          // Auto-claim an unclaimed profile for trusted providers
          if (!account.userId) return;
          try {
            const user = await db.query.users.findFirst({
              where: eq(users.id, account.userId),
            });
            if (!user?.email) return;

            const unclaimedProfile = await db.query.profiles.findFirst({
              where: and(
                eq(profiles.email, user.email.toLowerCase()),
                isNull(profiles.userId)
              ),
            });

            if (unclaimedProfile) {
              console.log(
                'Auto-claiming profile for user:',
                user.email,
                'from provider:',
                account.providerId
              );
              await db
                .update(profiles)
                .set({ userId: account.userId })
                .where(eq(profiles.id, unclaimedProfile.id));
              console.log('Profile claimed successfully');
            }
          } catch (error) {
            console.error('Error auto-claiming profile:', error);
          }
        },
      },
    },
  },
});

// =============================================================================
// auth() compat shim — returns AppSession shape for server components
// =============================================================================

interface ProfileVerification {
  panaVerified?: boolean;
  legalAgeVerified?: boolean;
}
interface ProfileRoles {
  mentoringModerator?: boolean;
  eventOrganizer?: boolean;
  contentModerator?: boolean;
}

export async function auth(): Promise<AppSession | null> {
  try {
    const session = await betterAuthInstance.api.getSession({
      headers: await headers(),
    });
    if (!session) return null;

    // Check admin status from environment variable
    const adminEmails =
      process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) ||
      [];
    const isAdmin = session.user.email
      ? adminEmails.includes(session.user.email.toLowerCase())
      : false;

    // Fetch profile to get verification badges and roles
    let profileVerification: ProfileVerification | null = null;
    let profileRoles: ProfileRoles | null = null;
    try {
      const userProfile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, session.user.id),
      });
      if (userProfile) {
        profileVerification =
          userProfile.verification as ProfileVerification | null;
        profileRoles = userProfile.roles as ProfileRoles | null;
      }
    } catch (error) {
      console.error('Error fetching profile in auth():', error);
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        emailVerified: session.user.emailVerified ? new Date() : null,
        // Privacy: clear name and image (use profile data instead)
        name: '',
        image: '',
        isAdmin: isAdmin || false,
        panaVerified: profileVerification?.panaVerified || false,
        legalAgeVerified: profileVerification?.legalAgeVerified || false,
        isMentoringModerator: profileRoles?.mentoringModerator || false,
        isEventOrganizer: profileRoles?.eventOrganizer || false,
        isContentModerator: profileRoles?.contentModerator || false,
      },
      expires: session.session.expiresAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export const handler = betterAuthInstance.handler;

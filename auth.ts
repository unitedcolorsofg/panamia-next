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
  profiles,
} from '@/lib/schema';
import { and, eq, isNull } from 'drizzle-orm';
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
  <title>Sign in to Pana MIA</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <!-- Preheader: visible in inbox preview, hidden in body -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Your sign-in link for Pana MIA &mdash; expires in 24 hours.</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 8px; max-width: 600px;">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 3px solid ${brandColor};">
              <h1 style="margin: 0; color: #111827; font-size: 28px; font-weight: 700;">Pana MIA</h1>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">South Florida's Creative Community</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 22px; font-weight: 600;">Sign in to your account</h2>

              <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Hi there! We received a sign-in request for your account on <strong>${escapedHost}</strong>. Click the button below to sign in.
              </p>

              <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                This is a one-time link — it can only be used once and will expire automatically after <strong>24 hours</strong>. If you need a new link after it expires, you can request one at any time from the sign-in page.
              </p>

              <p style="margin: 0 0 30px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                For your security, do not forward this email to anyone. Pana MIA staff will never ask you for this link.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${url}" style="display: inline-block; background-color: ${buttonBg}; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Sign in to Pana MIA
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 8px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Button not working? Copy and paste this link into your browser:
              </p>
              <p style="margin: 0; color: ${brandColor}; font-size: 13px; word-break: break-all; line-height: 1.6;">
                ${url}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                This email was sent to <strong>${escapedEmail}</strong> because a sign-in was requested for this address.
              </p>
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                If you did not request this, you can safely ignore this email. The link will expire on its own and your account will not be affected.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                Pana MIA &middot; <a href="https://panamia.club" style="color: #9ca3af; text-decoration: underline;">panamia.club</a> &middot; <a href="mailto:hola@panamia.club" style="color: #9ca3af; text-decoration: underline;">hola@panamia.club</a>
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
  return [
    'Sign in to Pana MIA',
    '====================',
    '',
    'Hi there!',
    '',
    `We received a sign-in request for your account on ${host}, South Florida's Creative Community.`,
    '',
    'Use the link below to sign in (or copy and paste it into your browser):',
    '',
    url,
    '',
    'This link expires in 24 hours and works only once. After it expires you can request a new link from the sign-in page.',
    '',
    'For your security, do not forward this email to anyone. Pana MIA staff will never ask you for this link.',
    '',
    "Didn't request this? You can safely ignore this email. Your account has not been accessed and no changes were made.",
    '',
    '---',
    "Pana MIA \u00b7 South Florida's Creative Community",
    'panamia.club \u00b7 hola@panamia.club',
  ].join('\n');
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
  <title>Verify your email change &mdash; Pana MIA</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <!-- Preheader: visible in inbox preview, hidden in body -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Confirm your Pana MIA email address change &mdash; link expires in 5 minutes.</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 8px; max-width: 600px;">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 3px solid ${brandColor};">
              <h1 style="margin: 0; color: #111827; font-size: 28px; font-weight: 700;">Pana MIA</h1>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">South Florida's Creative Community</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 22px; font-weight: 600;">Verify Your Email Address Change</h2>

              <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                You recently requested to change the email address on your Pana MIA account.
              </p>

              <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                Current address: <strong>${escapedOldEmail}</strong><br>
                New address: <strong>${escapedNewEmail}</strong>
              </p>

              <div style="margin: 0 0 30px 0; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; color: #92400e; font-size: 14px; font-weight: 600;">Before you confirm, please note:</p>
                <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 14px; line-height: 1.8;">
                  <li>This confirmation link expires in <strong>5 minutes</strong></li>
                  <li>You will be signed out of all active sessions</li>
                  <li>A notification will be sent to your current address (${escapedOldEmail})</li>
                </ul>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${url}" style="display: inline-block; background-color: ${buttonBg}; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Confirm Email Change
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 8px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Button not working? Copy and paste this link into your browser:
              </p>
              <p style="margin: 0; color: ${brandColor}; font-size: 13px; word-break: break-all; line-height: 1.6;">
                ${url}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                If you did not request this email change, please ignore this message. Your account will not be affected. If you believe someone else is attempting to access your account, contact us at <a href="mailto:hola@panamia.club" style="color: #9ca3af;">hola@panamia.club</a>.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                Pana MIA &middot; <a href="https://panamia.club" style="color: #9ca3af; text-decoration: underline;">panamia.club</a> &middot; <a href="mailto:hola@panamia.club" style="color: #9ca3af; text-decoration: underline;">hola@panamia.club</a>
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
  return [
    'Verify Your Email Address Change \u2014 Pana MIA',
    '==============================================',
    '',
    'You recently requested to change the email address on your Pana MIA account.',
    '',
    `  Current address: ${oldEmail}`,
    `  New address:     ${newEmail}`,
    '',
    'To confirm this change, open the link below in your browser:',
    '',
    url,
    '',
    'Before you confirm, please note:',
    '  - This link expires in 5 minutes',
    '  - You will be signed out of all active sessions',
    `  - A notification will be sent to your current address (${oldEmail})`,
    '',
    'If you did not request this change, ignore this email. Your account will not be affected.',
    'If you believe someone else is attempting to access your account, contact us at hola@panamia.club.',
    '',
    '---',
    "Pana MIA \u00b7 South Florida's Creative Community",
    'panamia.club \u00b7 hola@panamia.club',
  ].join('\n');
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Pana MIA account email was changed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <!-- Preheader: visible in inbox preview, hidden in body -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Security notice: the email address on your Pana MIA account was changed on ${timestamp}.</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 8px; max-width: 600px;">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 3px solid ${brandColor};">
              <h1 style="margin: 0; color: #111827; font-size: 28px; font-weight: 700;">Pana MIA</h1>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">South Florida's Creative Community</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 22px; font-weight: 600;">Your Account Email Was Changed</h2>

              <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                This is a security notification from Pana MIA. The email address on your account was successfully changed on <strong>${timestamp}</strong>.
              </p>

              <div style="margin: 0 0 24px 0; padding: 20px; background-color: #eff6ff; border-left: 4px solid ${brandColor}; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px;"><strong>Previous email:</strong> ${escapedOldEmail}</p>
                <p style="margin: 0; color: #1e40af; font-size: 14px;"><strong>New email:</strong> ${escapedNewEmail}</p>
              </div>

              <p style="margin: 0 0 20px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                If you made this change, no further action is needed. You have been signed out of all active sessions — sign in using your new email address to continue using Pana MIA.
              </p>

              <div style="margin: 0 0 20px 0; padding: 20px; background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #991b1b; font-size: 14px; font-weight: 600;">Did not authorize this change?</p>
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
                  Contact us immediately at <a href="mailto:hola@panamia.club" style="color: #dc2626; text-decoration: underline;">hola@panamia.club</a>. Please include the date and time shown above so we can investigate promptly.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                This automated security notification was sent to ${escapedOldEmail} because it was the address on your account at the time of the change.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                Pana MIA &middot; <a href="https://panamia.club" style="color: #9ca3af; text-decoration: underline;">panamia.club</a> &middot; <a href="mailto:hola@panamia.club" style="color: #9ca3af; text-decoration: underline;">hola@panamia.club</a>
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
  return [
    'Your Pana MIA Account Email Was Changed',
    '========================================',
    '',
    `This is a security notification. The email address on your Pana MIA account was changed on ${timestamp}.`,
    '',
    `  Previous email: ${oldEmail}`,
    `  New email:      ${newEmail}`,
    '',
    'If you authorized this change, no further action is needed. You have been signed out of all active sessions. Sign in using your new email address to continue using Pana MIA.',
    '',
    'Did not authorize this change?',
    'Contact us immediately at hola@panamia.club. Please include the date and time shown above so we can investigate promptly.',
    '',
    '---',
    "Pana MIA \u00b7 South Florida's Creative Community",
    'panamia.club \u00b7 hola@panamia.club',
  ].join('\n');
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
  <title>Verify your email &mdash; Pana MIA</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <!-- Preheader: visible in inbox preview, hidden in body -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Confirm your email address to complete sign-in to Pana MIA via ${providerName} &mdash; expires in 5 minutes.</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #ffffff; border-radius: 8px; max-width: 600px;">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 3px solid ${brandColor};">
              <h1 style="margin: 0; color: #111827; font-size: 28px; font-weight: 700;">Pana MIA</h1>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">South Florida's Creative Community</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 22px; font-weight: 600;">Verify your email address</h2>

              <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                You recently signed in to Pana MIA using <strong>${providerName}</strong>. To complete your sign-in and confirm that you own this email address, click the button below.
              </p>

              <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
                We send this verification step the first time you sign in via a new provider to make sure the email address belongs to you.
              </p>

              <p style="margin: 0 0 30px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                This verification link expires in <strong>5 minutes</strong>. If it expires, return to Pana MIA and sign in again to receive a fresh link.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${url}" style="display: inline-block; background-color: ${buttonBg}; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Verify Email &amp; Complete Sign-In
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 8px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Button not working? Copy and paste this link into your browser:
              </p>
              <p style="margin: 0; color: ${brandColor}; font-size: 13px; word-break: break-all; line-height: 1.6;">
                ${url}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                This email was sent to <strong>${escapedEmail}</strong> because it is the address associated with your ${providerName} account.
              </p>
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                If you did not attempt to sign in using ${providerName}, you can safely ignore this email. The link will expire on its own.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                Pana MIA &middot; <a href="https://panamia.club" style="color: #9ca3af; text-decoration: underline;">panamia.club</a> &middot; <a href="mailto:hola@panamia.club" style="color: #9ca3af; text-decoration: underline;">hola@panamia.club</a>
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
  const { url, email, provider } = params;
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  return [
    'Verify Your Email Address \u2014 Pana MIA',
    '=========================================',
    '',
    `Hi ${email},`,
    '',
    `You recently signed in to Pana MIA using ${providerName}. To complete your sign-in and confirm that you own this email address, open the link below:`,
    '',
    url,
    '',
    `We send this verification step the first time you sign in via a new provider. It expires in 5 minutes. If it expires, return to Pana MIA and sign in again to receive a fresh link.`,
    '',
    `If you did not attempt to sign in using ${providerName}, you can safely ignore this email. Your account has not been accessed.`,
    '',
    '---',
    "Pana MIA \u00b7 South Florida's Creative Community",
    'panamia.club \u00b7 hola@panamia.club',
  ].join('\n');
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
// better-auth instance — lazy singleton
// =============================================================================
//
// betterAuth is initialized on the first request, not at module-load time.
// The `db` proxy from @/lib/db is passed to drizzleAdapter — every property access
// on the proxy calls getDb() which returns the current request's hyperdriveInstance,
// so better-auth queries always use the fresh per-request client.

type BetterAuthInstance = ReturnType<typeof betterAuth>;
let _betterAuthInstance: BetterAuthInstance | null = null;

function getBetterAuth(): BetterAuthInstance {
  if (_betterAuthInstance) return _betterAuthInstance;

  _betterAuthInstance = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      // Singular keys required: usePlural:false means the adapter looks up models by singular
      // name (e.g. "session", "user") — matching better-auth's internal model names exactly.
      // Our Drizzle export names are plural (users, sessions, …) so we alias them here.
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification, // Drizzle export is already singular
      },
      // usePlural:false so getModelName("user") === "user" (not "users").
      // This makes experimental.joins work: the adapter builds `with: { user: true }`
      // which matches our sessionsRelations / accountsRelations relation key.
      usePlural: false,
    }),
    // Use Drizzle's relational API (single JOIN query) for session lookups.
    // Without this, the adapter falls back to two separate queries (sessions SELECT +
    // users SELECT via handleFallbackJoin) which hangs in CF Workers with max:1.
    experimental: { joins: true },
    secret: process.env.BETTER_AUTH_SECRET,
    // BETTER_AUTH_URL is CF-RUNTIME only and gets baked in as undefined by Vite.
    // NEXT_PUBLIC_HOST_URL is in CF-BUILD and is correctly baked in at build time.
    baseURL:
      process.env.NEXT_PUBLIC_HOST_URL ||
      process.env.BETTER_AUTH_URL ||
      'http://localhost:3000',
    trustedOrigins: [
      process.env.NEXT_PUBLIC_HOST_URL,
      process.env.BETTER_AUTH_URL,
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean) as string[],
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
            tokenUrl:
              'https://meta.wikimedia.org/w/rest.php/oauth2/access_token',
            userInfoUrl:
              'https://meta.wikimedia.org/w/rest.php/oauth2/resource/profile',
            scopes: ['identify', 'email'],
            mapProfileToUser: (profile: Record<string, unknown>) => ({
              id: String(profile.sub || profile.id),
              email: (profile.email as string) || undefined,
              name:
                (profile.realname as string) || (profile.username as string),
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

  return _betterAuthInstance;
}

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
    const session = await getBetterAuth().api.getSession({
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

export const handler = (request: Request) => getBetterAuth().handler(request);

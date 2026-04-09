/**
 * OAuth Token Revocation
 *
 * Best-effort revocation of Google and Apple OAuth tokens during account deletion.
 * Failures are logged but never thrown — the account deletion continues regardless.
 */

import type { Account } from '@/lib/schema';

async function revokeGoogleToken(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `token=${encodeURIComponent(accessToken)}`,
    });
    return res.ok;
  } catch (error) {
    console.error('oauth-revoke:google:error', error);
    return false;
  }
}

async function revokeAppleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<boolean> {
  try {
    const res = await fetch('https://appleid.apple.com/auth/oauth2/v2/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: refreshToken,
        token_type_hint: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
    return res.ok;
  } catch (error) {
    console.error('oauth-revoke:apple:error', error);
    return false;
  }
}

export async function revokeAllOAuthTokens(
  accountRows: Pick<Account, 'providerId' | 'accessToken' | 'refreshToken'>[]
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  for (const account of accountRows) {
    if (account.providerId === 'google' && account.accessToken) {
      results.google = await revokeGoogleToken(account.accessToken);
    } else if (account.providerId === 'apple' && account.refreshToken) {
      const clientId = process.env.APPLE_CLIENT_ID ?? '';
      const clientSecret = process.env.APPLE_CLIENT_SECRET ?? '';
      results.apple = await revokeAppleToken(
        account.refreshToken,
        clientId,
        clientSecret
      );
    }
  }

  return results;
}

/**
 * Account issuers (better-auth 1.7+).
 *
 * better-auth keys an account by (issuer, accountId), not (providerId,
 * accountId): providerId names the configured connection, issuer names the
 * identity namespace that vouched for the subject. better-auth derives the
 * value itself on the OAuth callback path — from the provider definition's
 * `accountIssuer`, falling back to a synthetic `local:oauth:<providerId>` for
 * providers that declare none.
 *
 * Code that writes an account row outside that callback path (the OAuth
 * email-verification completion route) has to produce the same value, or the
 * next sign-in creates a second account row for the same identity. This module
 * is the single place that mapping lives, and it is what drizzle/0033 backfills
 * existing rows with.
 *
 * Values mirror better-auth's own provider definitions:
 *   @better-auth/core/dist/social-providers/{google,apple}.mjs  (accountIssuer)
 *   @better-auth/core/dist/db/schema/account.mjs                (createOAuthAccountIssuer)
 */

/** Providers that declare a real protocol issuer of their own. */
const PROVIDER_ISSUERS: Record<string, string> = {
  google: 'https://accounts.google.com',
  apple: 'https://appleid.apple.com',
};

/**
 * The issuer better-auth will store for an account created through `providerId`.
 *
 * Generic-OAuth providers (wikimedia, mastodon) are configured without a
 * discoveryUrl, so better-auth has no discovered issuer for them and falls back
 * to the synthetic namespace — percent-encoded exactly as better-auth does it.
 */
export function accountIssuerFor(providerId: string): string {
  return (
    PROVIDER_ISSUERS[providerId] ??
    `local:oauth:${encodeURIComponent(providerId)}`
  );
}

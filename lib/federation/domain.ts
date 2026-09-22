/**
 * Canonical fediverse identity domain.
 *
 * Deliberately dependency-free so anything needing the stable identity domain
 * can import it without pulling in the federation barrel (db wrappers, crypto).
 */

/**
 * Used when nothing else resolves. Matches the production domain the first
 * actors were minted under, so an unconfigured environment can never silently
 * re-brand existing identities.
 */
export const DEFAULT_FEDERATION_DOMAIN = 'pana.social';

/**
 * The domain in `@user@domain` handles, and the origin of every actor, status,
 * follow, and like URI this instance mints.
 *
 * Remote servers store those URIs as permanent primary keys. Once an actor has
 * federated, changing this value orphans it: the fediverse sees a brand new
 * account, and the `Move` migration that repairs it carries followers but NOT
 * posts. Treat this as write-once per environment and pin it explicitly in
 * production.
 *
 * Intentionally independent of NEXT_PUBLIC_HOST_URL. The UI can move to a
 * dedicated social hostname without re-minting identities — which is the whole
 * reason this is a separate variable. Whatever host serves the app, the domain
 * below is the one that must answer WebFinger and serve `/p/[user]` as
 * ActivityPub JSON.
 *
 * Falls back to the UI host's hostname so deployments that predate this
 * variable keep the exact identity they already had.
 */
export function getFederationDomain(): string {
  const explicit = process.env.FEDERATION_DOMAIN?.trim();
  if (explicit) {
    // Accept either a bare hostname or a full URL, and keep any explicit port
    // (local federation testing depends on it).
    return explicit.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }

  const hostUrl = process.env.NEXT_PUBLIC_HOST_URL;
  if (!hostUrl) return DEFAULT_FEDERATION_DOMAIN;

  try {
    return new URL(hostUrl).hostname || DEFAULT_FEDERATION_DOMAIN;
  } catch {
    return DEFAULT_FEDERATION_DOMAIN;
  }
}

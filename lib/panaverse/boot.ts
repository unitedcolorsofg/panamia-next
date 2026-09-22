/**
 * Boot-time configuration guards for the panaverse.
 *
 * Separate from `surfaces.ts` on purpose. The registry is imported by the
 * Worker, auth config, and UI, and must stay dependency-free and side-effect
 * free; a guard that reads the federation domain and throws does not belong in
 * something that many modules pull in just to ask "which surface is this".
 */

import { getConfiguredFederationDomain } from '@/lib/federation/domain';
import { getRootDomain } from './surfaces';

/**
 * Whether this deployment is actually serving the panaverse to the public,
 * rather than a developer or a preview build.
 *
 * Deliberately host-based rather than `NODE_ENV`. A Worker bundle is built with
 * NODE_ENV=production for every deploy including previews, so keying off it
 * would take down *.workers.dev previews for a variable that only matters once
 * real identities are being minted.
 */
function isPublicPanaverseHost(host: string, rootDomain: string): boolean {
  const hostname = host.trim().toLowerCase().replace(/:\d+$/, '');
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
  if (hostname === '127.0.0.1' || hostname === '[::1]') return false;
  if (hostname.endsWith('.workers.dev')) return false;

  const root = rootDomain.trim().toLowerCase().replace(/:\d+$/, '');
  return hostname === root || hostname.endsWith(`.${root}`);
}

/** Cleared config is checked once per isolate; there is nothing to re-read. */
let verified = false;

/**
 * Fail loudly when a public deployment has not pinned FEDERATION_DOMAIN.
 *
 * `getFederationDomain()` falls back to the NEXT_PUBLIC_HOST_URL hostname when
 * the variable is unset. That fallback exists for deployments that predate the
 * variable and must keep the identity they already have, so it cannot simply be
 * removed — but inheriting it in production is dangerous in a way that is
 * invisible until it is far too late to fix.
 *
 * Every ActivityPub actor, status, follow, and like URI this instance mints is
 * permanent: remote servers store them as primary keys. Mint them under an
 * inferred domain, pin the real one later, and the fediverse sees a brand new
 * account — the `Move` migration that repairs it carries followers but NOT
 * posts. There is no second chance, and nothing warns you at the time.
 *
 * So this throws rather than logging. A deployment that mints orphaned
 * identities looks perfectly healthy while doing unfixable damage, and a log
 * line in that situation is indistinguishable from the silence we are trying to
 * eliminate. `wrangler.jsonc` already pins FEDERATION_DOMAIN, so today this
 * guard cannot fire in production — it exists to make removing that entry
 * impossible to do quietly.
 *
 * Intentionally NOT expressed as `required: true` in lib/env.config.ts. The
 * variable is genuinely optional for local development and previews, and that
 * file's boolean cannot say "required only when serving the public domain" —
 * marking it required would fail `env:check` for every developer.
 */
export function assertPanaverseConfigured(host: string | null | undefined) {
  if (verified || !host) return;

  const rootDomain = getRootDomain();
  if (!isPublicPanaverseHost(host, rootDomain)) return;

  if (!getConfiguredFederationDomain()) {
    throw new Error(
      [
        `FEDERATION_DOMAIN is not set, and this deployment is serving "${host}".`,
        '',
        'That host is a public panaverse hostname, so the fallback that infers',
        'the fediverse identity domain from NEXT_PUBLIC_HOST_URL is not safe',
        'here: every ActivityPub URI minted under an inferred domain is',
        'permanent, and pinning the real domain afterwards orphans each actor',
        'that has already federated. The Move migration that repairs it carries',
        'followers but NOT posts.',
        '',
        'Set FEDERATION_DOMAIN explicitly — the `vars` block in wrangler.jsonc',
        'for Worker deploys, or the process environment otherwise. It ships',
        'pinned to "pana.social"; if you are reading this, that entry was',
        'removed or is not reaching the runtime.',
        '',
        'See lib/federation/domain.ts and lib/panaverse/boot.ts.',
      ].join('\n')
    );
  }

  verified = true;
}

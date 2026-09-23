/**
 * Panaverse surface registry.
 *
 * A "surface" is one Pana Mia offering with its own front door: the main site
 * at the apex, Pana Social at social.<root>, and whatever comes next. All of
 * them share one codebase, one database, one deploy, and one account — they
 * differ only in hostname and chrome.
 *
 * This module is the single source of truth for that mapping. Adding a surface
 * should be one entry here plus a DNS record, never a second application.
 *
 * Dependency-free on purpose: the Worker entry, auth config, and UI all read it.
 */

import { getConfiguredFederationDomain } from '@/lib/federation/domain';

export type SurfaceId = 'www' | 'social';

export interface PanaverseSurface {
  id: SurfaceId;
  /** Shown in the surface switcher. */
  name: string;
  /** One line describing what this surface is for. */
  tagline: string;
  /**
   * Label under the root domain, or null for the apex.
   * `social` → social.pana.social
   */
  subdomain: string | null;
  /**
   * Where this surface's front door lives in the shared route tree. Requesting
   * the surface hostname's root serves this path.
   */
  rootPath: string;
  /**
   * Path prefixes this surface owns. Used to light up the active entry in the
   * switcher — NOT to restrict routing, since every route stays reachable from
   * every hostname.
   */
  paths: string[];
}

/**
 * The registrable domain the panaverse hangs off. Every surface is a subdomain
 * of this, which is what lets one session cookie cover all of them — cookies
 * cannot be shared across registrable domains.
 *
 * Equal to DEFAULT_FEDERATION_DOMAIN by design, not by accident: pana.social
 * both serves this app and mints @user@pana.social handles. Keeping them equal
 * is what lets a surface cookie cover the identity host, and it means the
 * federation domain survives a UI move — see lib/federation/domain.ts.
 * panamia.club is a different, older deployment; it is not this app.
 */
export const DEFAULT_ROOT_DOMAIN = 'pana.social';

export function getRootDomain(): string {
  return process.env.PANAVERSE_ROOT_DOMAIN?.trim() || DEFAULT_ROOT_DOMAIN;
}

export const SURFACES: readonly PanaverseSurface[] = [
  {
    id: 'www',
    name: 'Pana Mia',
    tagline: 'The directory, the org, and how to get involved.',
    subdomain: null,
    rootPath: '/',
    paths: ['/directory', '/directorio', '/d', '/listings', '/venues', '/a'],
  },
  {
    id: 'social',
    name: 'Pana Social',
    tagline: 'The community timeline, federated with the fediverse.',
    subdomain: 'social',
    rootPath: '/s',
    // `/p` is social's for chrome, but it does not own every page under it:
    // a business or unclaimed listing at /p/<user> is directory content and
    // says so with its own canonical. See app/p/[user]/page.tsx.
    paths: ['/s', '/p', '/timeline', '/inbox'],
  },
];

export const DEFAULT_SURFACE: PanaverseSurface = SURFACES[0];

export function getSurface(id: SurfaceId): PanaverseSurface {
  const surface = SURFACES.find((s) => s.id === id);
  if (!surface) throw new Error(`Unknown panaverse surface: ${id}`);
  return surface;
}

/** The public hostname this surface is served from. */
export function hostnameFor(
  surface: PanaverseSurface,
  rootDomain = getRootDomain()
): string {
  return surface.subdomain ? `${surface.subdomain}.${rootDomain}` : rootDomain;
}

export function originFor(
  surface: PanaverseSurface,
  rootDomain = getRootDomain()
): string {
  return `https://${hostnameFor(surface, rootDomain)}`;
}

/**
 * The origin of `target` as reached from the host currently being served.
 *
 * `originFor` always points at the configured root domain, which is right in
 * production and wrong everywhere else: on social.localhost:3002 it would send
 * a member to https://pana.social — the live site — for what should be a link
 * across the hall. This swaps the surface label on the host in hand instead,
 * keeping scheme and port, so cross-surface links behave in dev and in prod
 * without a branch at every call site.
 *
 * Hosts that are not under the root domain — *.workers.dev previews, and any
 * future alias — have no sibling to swap to, so they fall back to the
 * canonical origin. That fallback is only safe while the root domain is the
 * host that actually serves production: while it named panamia.club, every
 * link out of here pointed at a different app behind an expired certificate.
 */
export function originForFrom(
  target: PanaverseSurface,
  currentHost: string | null | undefined,
  rootDomain = getRootDomain()
): string {
  if (!currentHost) return originFor(target, rootDomain);

  const hostname = normaliseHostname(currentHost);
  const root = normaliseHostname(rootDomain);
  const port = currentHost.trim().match(/:(\d+)$/)?.[1] ?? '';

  const isLocal = hostname === 'localhost' || hostname.endsWith('.localhost');
  const isUnderRoot = hostname === root || hostname.endsWith(`.${root}`);
  if (!isLocal && !isUnderRoot) return originFor(target, rootDomain);

  // Strip the label the current surface occupies, leaving the base the
  // panaverse hangs off: "social.localhost" -> "localhost".
  const current = resolveSurface(hostname, rootDomain);
  const base =
    current.subdomain && hostname.startsWith(`${current.subdomain}.`)
      ? hostname.slice(current.subdomain.length + 1)
      : hostname;

  // `base` has to be the domain the panaverse actually hangs off. When it is
  // not, the current host is some other subdomain under the root — today
  // relay.pana.social, tomorrow an api.* — and swapping labels would invent
  // social.relay.pana.social. Those hosts have no sibling, so they take the
  // canonical origin. This only became reachable when the root domain moved to
  // pana.social and brought the relay under it.
  if (!isLocal && base !== root) return originFor(target, rootDomain);

  const host = target.subdomain ? `${target.subdomain}.${base}` : base;
  return `${isLocal ? 'http' : 'https'}://${host}${port ? `:${port}` : ''}`;
}

/**
 * Hostnames that should land on a surface without being subdomains of the root
 * domain. The fediverse identity domain is the case that matters: handles live
 * on it permanently (see lib/federation/domain.ts), so visitors who type it
 * should get Pana Social rather than the main site.
 *
 * Only a *deliberately configured* federation domain counts. When
 * FEDERATION_DOMAIN is unset the domain is inherited from the UI host, which
 * means the "alias" would be the exact hostname already serving the main site
 * — aliasing it to Pana Social strips the main site of its chrome on the apex.
 * An unconfigured environment therefore has no aliases at all.
 *
 * Note these are NOT cookie-sharing hosts. A session cookie scoped to the root
 * domain cannot cover a different registrable domain, so an alias host is for
 * federation and redirects, not for signed-in browsing.
 */
function aliasHostsFor(surface: PanaverseSurface): string[] {
  if (surface.id !== 'social') return [];
  const federation = getConfiguredFederationDomain();
  return federation ? [federation] : [];
}

/** Strip port and normalise case so callers can pass a raw Host header. */
function normaliseHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/:\d+$/, '');
}

/**
 * Resolve the surface serving a request.
 *
 * Falls back to the main site, which keeps localhost, *.workers.dev previews,
 * and any unrecognised host behaving exactly as they did before surfaces
 * existed: every route reachable from one hostname.
 *
 * `social.localhost` resolves to the social surface so the split can be
 * exercised locally — browsers route *.localhost to the loopback address.
 */
export function resolveSurface(
  hostname: string | null | undefined,
  rootDomain = getRootDomain()
): PanaverseSurface {
  if (!hostname) return DEFAULT_SURFACE;
  const host = normaliseHostname(hostname);
  const root = normaliseHostname(rootDomain);

  // A real surface hostname always wins over an alias. Otherwise pinning
  // FEDERATION_DOMAIN to the root domain would hand the apex to Pana Social.
  if (host === root) return DEFAULT_SURFACE;

  const suffix = `.${root}`;
  const label = host.endsWith(suffix)
    ? host.slice(0, -suffix.length)
    : host.endsWith('.localhost')
      ? host.slice(0, -'.localhost'.length)
      : null;

  if (label) {
    const bySubdomain = SURFACES.find((s) => s.subdomain === label);
    if (bySubdomain) return bySubdomain;
    return DEFAULT_SURFACE;
  }

  for (const surface of SURFACES) {
    if (aliasHostsFor(surface).some((a) => normaliseHostname(a) === host)) {
      return surface;
    }
  }

  return DEFAULT_SURFACE;
}

/** The surface a path belongs to, for the switcher's active state. */
export function surfaceForPath(pathname: string): PanaverseSurface {
  const match = SURFACES.filter((s) => s.id !== DEFAULT_SURFACE.id).find((s) =>
    s.paths.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  );
  return match ?? DEFAULT_SURFACE;
}

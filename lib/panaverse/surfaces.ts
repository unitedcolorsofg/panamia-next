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

import { getFederationDomain } from '@/lib/federation/domain';

export type SurfaceId = 'www' | 'social';

export interface PanaverseSurface {
  id: SurfaceId;
  /** Shown in the surface switcher. */
  name: string;
  /** One line describing what this surface is for. */
  tagline: string;
  /**
   * Label under the root domain, or null for the apex.
   * `social` → social.panamia.club
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
 */
export const DEFAULT_ROOT_DOMAIN = 'panamia.club';

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
 * Hostnames that should land on a surface without being subdomains of the root
 * domain. The fediverse identity domain is the case that matters: handles live
 * on it permanently (see lib/federation/domain.ts), so visitors who type it
 * should get Pana Social rather than the main site.
 *
 * Note these are NOT cookie-sharing hosts. A session cookie scoped to the root
 * domain cannot cover a different registrable domain, so an alias host is for
 * federation and redirects, not for signed-in browsing.
 */
function aliasHostsFor(surface: PanaverseSurface): string[] {
  if (surface.id !== 'social') return [];
  const federation = getFederationDomain();
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

  for (const surface of SURFACES) {
    if (aliasHostsFor(surface).some((a) => normaliseHostname(a) === host)) {
      return surface;
    }
  }

  if (host === root) return DEFAULT_SURFACE;

  const suffix = `.${root}`;
  const label = host.endsWith(suffix)
    ? host.slice(0, -suffix.length)
    : host.endsWith('.localhost')
      ? host.slice(0, -'.localhost'.length)
      : null;

  if (!label) return DEFAULT_SURFACE;

  return SURFACES.find((s) => s.subdomain === label) ?? DEFAULT_SURFACE;
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

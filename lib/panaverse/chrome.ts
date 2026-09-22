/**
 * Which routes bring their own chrome.
 *
 * Most pages are content inside a surface and wear that surface's header and
 * footer. A few are doorways rather than rooms — they belong to the panaverse
 * as a whole rather than to any one surface, and they carry their own framing.
 * Sign-in is the case that matters: it is reachable from every hostname, it is
 * the first thing a signed-out visitor sees, and wrapping it in a directory nav
 * they cannot use yet only buries the one control on the page.
 *
 * The root layout consults this to decide whether to render main-site chrome,
 * which is why it lives beside the surface registry rather than inside a route.
 */

import {
  DEFAULT_SURFACE,
  surfaceForPath,
  type PanaverseSurface,
} from './surfaces';

/**
 * Route prefixes that render standalone. A prefix matches the path itself and
 * anything beneath it, so `/signin` also covers a future `/signin/verify`.
 */
export const STANDALONE_ROUTES: readonly string[] = ['/signin'];

/**
 * Request header carrying the path being served.
 *
 * The runtime hands the server renderer the Host header but not the path, so
 * the root layout has no way to tell a doorway from a room. The Worker sets
 * this on every request it forwards.
 *
 * Set by the Worker and never read from the client: a spoofable value here
 * would let anyone strip the chrome off any page.
 */
export const PATHNAME_HEADER = 'x-pana-pathname';

/** Strip a trailing slash so `/signin/` matches `/signin`. */
function normalisePath(pathname: string): string {
  const path = pathname.split('?')[0].split('#')[0];
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Does this route supply its own chrome?
 *
 * Returns false for an empty path, which is what a caller sees when the
 * pathname could not be determined. Falling back to "wears the usual chrome"
 * keeps an unknown route looking like the site it is part of rather than
 * stripping it bare.
 */
export function wearsOwnChrome(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = normalisePath(pathname);
  return STANDALONE_ROUTES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

/**
 * Is this surface serving a route that belongs to a different one?
 *
 * Every route stays reachable from every hostname — that is a deliberate
 * property of the registry, not an oversight, because one deploy serves the
 * whole panaverse. The consequence is that social.panamia.club/directory/search
 * renders the main site's directory, and until now it rendered it with no
 * header, no footer and no link home: the root layout withheld main-site chrome
 * on surface hostnames, and Pana Social had none of its own to put there. A
 * member who followed a directory link out of the feed simply arrived nowhere.
 *
 * Redirecting to the main site would also have closed the hole, and is the
 * cheaper fix, but it answers a member asking to see the directory by moving
 * them to a different hostname — which is precisely the "these are two separate
 * products" message the panaverse switcher exists to dispel. So the surface
 * keeps the member and frames the borrowed page instead.
 *
 * Three exclusions, each for a different reason:
 *   - The main site already has chrome of its own; this is only for surfaces
 *     that would otherwise render bare.
 *   - Doorways (`wearsOwnChrome`) frame themselves on every surface by design.
 *   - The surface's own routes are its home turf, not a borrowed room.
 *
 * An unknown path returns false rather than true. The pathname is absent only
 * when the request did not come through the Worker, and in that case leaving
 * the page exactly as it renders today is the safer failure.
 */
export function wearsGuestChrome(
  surface: PanaverseSurface,
  pathname: string | null | undefined
): boolean {
  if (!pathname) return false;
  if (surface.id === DEFAULT_SURFACE.id) return false;
  if (wearsOwnChrome(pathname)) return false;
  return surfaceForPath(normalisePath(pathname)).id !== surface.id;
}

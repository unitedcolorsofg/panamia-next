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

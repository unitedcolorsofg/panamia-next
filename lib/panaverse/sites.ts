import {
  originForFrom,
  resolveSurface,
  surfaceForPath,
  getRootDomain,
} from '@/lib/panaverse/surfaces';

/**
 * The other Pana sites, as the masthead account menu lists them.
 *
 * Deliberately not `SHARED_ROOMS` (lib/panaverse/branding.ts): that list
 * answers "what else is on the main site" for the surface switcher, and is
 * scoped to rooms that are real and shipped. This one answers a different
 * question — "where else can I go in the Pana world" — so it leads with the
 * named offerings a member would recognise from a flyer, and is allowed to
 * name ones that are not built yet.
 *
 * A site with `href: null` is announced rather than linked. Naming an
 * unbuilt offering is a promise, so it renders as a dimmed, unclickable row
 * with a "coming soon" badge: nothing here is ever a link to a 404.
 *
 * Paths are stored relative, and resolved against the host being served by
 * `resolvePanaSites` — a server call, because `originForFrom` reads
 * PANAVERSE_ROOT_DOMAIN, which is a Worker var and not a NEXT_PUBLIC_ one. In
 * a client bundle that var is simply absent and the helper would silently fall
 * back to the compiled-in default, which is a class of bug that only appears
 * in the environment you cannot test locally. So the env read stays where the
 * env exists, and the answer travels down as data.
 *
 * A site on the surface already being served keeps its relative path and
 * navigates on the client. One belonging to another surface is made absolute,
 * because crossing surfaces really does mean crossing origins now that each
 * has a hostname of its own. Before PANAVERSE_SUBDOMAINS was turned on these
 * were relative unconditionally, which was right then and became a trap the
 * moment the flag flipped: a member on social.pana.social following `/d` got
 * the directory without ever leaving the social hostname.
 */
export interface PanaSite {
  /** Stable key for React and for tests. */
  id: string;
  /** i18n key under `common:identity.sites`. */
  labelKey: string;
  /**
   * Where it lives, or null when it is not built yet.
   *
   * Relative in this registry; `resolvePanaSites` returns an absolute URL for
   * anything that crosses a surface boundary.
   */
  href: string | null;
}

export const PANA_SITES: readonly PanaSite[] = [
  { id: 'social', labelKey: 'panaSocial', href: '/s' },
  { id: 'ink', labelKey: 'panaInk', href: null },
  { id: 'vizion', labelKey: 'panaVizion', href: '/podcasts' },
  // `/d` is the canonical directory URL — `/directory` and `/directorio`
  // redirect here, so linking it directly saves a hop.
  { id: 'directory', labelKey: 'directory', href: '/d' },
  { id: 'events', labelKey: 'events', href: '/e' },
  { id: 'getInvolved', labelKey: 'getInvolved', href: null },
];

/**
 * `PANA_SITES` with every cross-surface path resolved against the host being
 * served. Call this on the server and pass the result down.
 *
 * A site the current surface already owns is left relative, so it still
 * navigates on the client and does not reload the document for a move within
 * the same room. Everything else becomes an absolute URL on its owning
 * surface's origin — which is also what gives a member on social.pana.social a
 * route back to the main site, the thing that went missing when the masthead
 * drawer was removed and PANAVERSE_SUBDOMAINS was turned on.
 *
 * Unbuilt sites (`href: null`) pass through untouched: there is no origin to
 * resolve, and they are announced rather than linked.
 */
export function resolvePanaSites(
  host: string | null | undefined,
  rootDomain = getRootDomain()
): readonly PanaSite[] {
  /* The origin this request is already being served from. Comparing against
   * this rather than against surface ids is what keeps the fallback honest:
   * while PANAVERSE_SUBDOMAINS is off every surface shares one origin, so an
   * id comparison would have called `/d` "cross-surface" from
   * social.pana.social and handed back an absolute URL pointing at the host it
   * was already on — turning a client navigation into a full document load for
   * no crossing at all. Same origin, same relative path, whatever the flag
   * says. */
  const currentOrigin = originForFrom(
    resolveSurface(host, rootDomain),
    host,
    rootDomain
  );

  return PANA_SITES.map((site) => {
    if (!site.href) return site;

    const owner = surfaceForPath(site.href);
    const origin = originForFrom(owner, host, rootDomain);
    if (origin === currentOrigin) return site;

    /* Crossing to a surface's own origin means landing on a host where its
     * front door is "/", not its prefix — so the Pana Social tile reads
     * https://social.pana.social/ rather than .../s. Both serve the feed; only
     * one of them is the URL a member would repeat out loud. Relative links
     * above keep their prefix, because on this host that prefix is the route. */
    const path = site.href === owner.rootPath ? '/' : site.href;
    return { ...site, href: `${origin}${path}` };
  });
}

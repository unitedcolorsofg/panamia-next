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
 * Paths are relative on purpose. Pana Social has a hostname of its own, but
 * resolving it needs PANAVERSE_ROOT_DOMAIN, which is a Worker var and absent
 * from a client bundle — a link built here would silently fall back to the
 * compiled-in default and be wrong the moment the root domain is configured.
 * `/s` keeps the member on the hostname they already chose, which is the same
 * call SHARED_ROOMS makes.
 */
export interface PanaSite {
  /** Stable key for React and for tests. */
  id: string;
  /** i18n key under `common:identity.sites`. */
  labelKey: string;
  /** The route it lives at today, or null when it is not built yet. */
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

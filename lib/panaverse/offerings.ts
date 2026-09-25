/**
 * The six Pana offerings, and the front door each one has on the main site.
 *
 * `lib/panaverse/sites.ts` already names these six, but it answers a narrower
 * question — "where does this offering live once I am inside it" — so its
 * hrefs point straight at the working software (`/s` is a signed-in feed, `/d`
 * is a search form) and two of the six have no href at all because they are
 * not built.
 *
 * This list answers the question a visitor asks first: *what is this?* Every
 * offering gets a front page on the main site whether or not the software
 * behind it exists yet, which is what lets the nav drawer be a complete list
 * of what the club offers rather than a list of the parts that happen to be
 * finished. An unbuilt offering's front page says so on the page instead of
 * being a dimmed row nobody can click.
 *
 * Dependency-free, like the rest of `lib/panaverse`: the nav drawer, the front
 * pages and any future server caller all read it.
 */
export interface PanaOffering {
  /** Stable key. Also the folder under `app/` and the i18n key in `offerings`. */
  id: string;
  /** The front page this offering is introduced on. Always a real route. */
  href: string;
  /**
   * Where the offering's working software lives, or null when it is not built.
   * The front page turns this into its primary call to action; without one it
   * renders the "coming soon" note instead.
   */
  appHref: string | null;
}

export const PANA_OFFERINGS: readonly PanaOffering[] = [
  { id: 'social', href: '/social', appHref: '/s' },
  { id: 'directory', href: '/directory', appHref: '/d' },
  { id: 'events', href: '/events', appHref: '/e' },
  { id: 'vizion', href: '/vizion', appHref: '/podcasts' },
  // The only one of the six with nothing behind it yet. `PANA_SITES` says the
  // same, and its front page says so on the page.
  { id: 'ink', href: '/ink', appHref: null },
  // Null in `PANA_SITES`, which is where this list started, and wrong here:
  // that registry is asking "does this offering have its own app surface?",
  // and joining the club does not need one — the form at the other end has
  // been live for years. Left as null it made the front page apologise for
  // being unbuilt directly above two working buttons.
  { id: 'getInvolved', href: '/get-involved', appHref: '/form/become-a-pana' },
];

export function getOffering(id: string): PanaOffering {
  const offering = PANA_OFFERINGS.find((o) => o.id === id);
  if (!offering) throw new Error(`Unknown pana offering: ${id}`);
  return offering;
}

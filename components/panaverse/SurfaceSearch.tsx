import { DirectorySuggest } from '@/components/directory-suggest';

/**
 * The search field a surface carries in the middle of its masthead.
 *
 * It was a plain GET form, so that it worked before the bundle landed and on a
 * page with JavaScript off. It is now the club-wide typeahead, which keeps
 * that: `DirectorySuggest` renders a real GET to /directory/search with a real
 * `name="q"` and only preventDefaults once hydrated, so the no-JS path is the
 * same document navigation it always was. That is also why it still sidesteps
 * the stale-chrome problem `SurfaceLink` exists for — submitting reaches the
 * server, which picks the chrome again on the way in.
 *
 * The placeholder named Panas, groups and events while the destination held
 * only businesses. The dropdown is what makes most of that true: a pana, a
 * group or an event is now reachable from here in one keystroke and one click,
 * because each row links to its own page rather than to a search. Pressing
 * Enter still lands on the businesses-only results page, which is the rest of
 * the gap and not this component's to close.
 *
 * Panas and groups only come back for a signed-in visitor. The API decides
 * that, not this component, which is why the same field can sit in chrome that
 * does not know who is looking at it.
 *
 * Rendered from a server component; `DirectorySuggest` is the client boundary.
 */
export function SurfaceSearch({ surfaceName }: { surfaceName: string }) {
  // One string for the input's accessible name and the listbox's, so a screen
  // reader hears the same field named the same way twice rather than two.
  const label = `Search ${surfaceName}`;

  return (
    <DirectorySuggest
      layout="masthead"
      className="panaverse-search"
      label={label}
      ariaLabel={label}
      placeholder="Search Panas, groups, and events"
    />
  );
}

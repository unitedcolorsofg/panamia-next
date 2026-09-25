import { DirectorySuggest } from '@/components/directory-suggest';

/**
 * The search field a surface carries in the middle of its masthead.
 *
 * It was a plain GET form, so that it worked before the bundle landed and on a
 * page with JavaScript off. It is now the club-wide typeahead, which keeps
 * that: `DirectorySuggest` renders a real GET with a real `name="q"` and only
 * preventDefaults once hydrated, so the no-JS path is the same document
 * navigation it always was. That is also why it still sidesteps the
 * stale-chrome problem `SurfaceLink` exists for — submitting reaches the
 * server, which picks the chrome again on the way in.
 *
 * `scope="all"` is the whole point of the field living here. It pointed at
 * Pana Social's own `/search`, which covered Panas and groups and left the
 * events in the placeholder as a promise. The directory's Everything scope
 * covers all four kinds today, so this now sends a member to the same index
 * the rest of the club searches rather than to a second, narrower one — one
 * search, one set of results, one place to fix a ranking bug.
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
      scope="all"
      className="panaverse-search"
      label={label}
      ariaLabel={label}
      placeholder="Search Panas, groups, and events"
    />
  );
}

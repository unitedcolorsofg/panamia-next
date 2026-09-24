import { Search } from 'lucide-react';

/**
 * The search field a surface carries in the middle of its masthead.
 *
 * A plain GET form rather than a client component, so it works before the
 * bundle lands and on a page with JavaScript off. Submitting is a document
 * navigation by definition, which is also why it sidesteps the stale-chrome
 * problem `SurfaceLink` exists for — the server picks the chrome again on the
 * way in.
 *
 * It points at the directory search because that is the search that exists
 * today. The placeholder names groups and events as well, which the directory
 * does not yet cover: this is the mock stating the intent while the surface
 * has one real destination to offer. Point `action` at a social-native search
 * once there is one, and the copy stops being aspirational.
 */
export function SurfaceSearch({ surfaceName }: { surfaceName: string }) {
  return (
    <form
      role="search"
      action="/directory/search"
      method="get"
      className="panaverse-search"
    >
      <Search className="panaverse-search-icon" aria-hidden="true" />
      <input
        type="search"
        name="q"
        className="panaverse-search-input"
        placeholder="Search Panas, groups, and events"
        aria-label={`Search ${surfaceName}`}
        autoComplete="off"
      />
    </form>
  );
}

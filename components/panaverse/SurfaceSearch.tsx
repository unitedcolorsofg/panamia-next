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
 * It points at Pana Social's own search, which covers Panas and groups. The
 * placeholder still names events, which discovery does not cover yet: that
 * arrives with group-hosted events in Phase 4 of docs/GROUPS-ROADMAP.md, and
 * the copy is one word ahead of the index on purpose rather than by neglect.
 *
 * `/search` is deliberately not `/s/search` — see the note on the social
 * surface's `paths` in lib/panaverse/surfaces.ts.
 */
export function SurfaceSearch({ surfaceName }: { surfaceName: string }) {
  return (
    <form
      role="search"
      action="/search"
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

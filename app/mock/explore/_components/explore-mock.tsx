'use client';

import { useState } from 'react';
import { ArrowUpRight, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import {
  DirectoryView,
  EventsView,
  GroupsView,
  HomeView,
  PanasView,
  type ViewProps,
} from './views';
import {
  DEFAULT_EXPLORE_SCOPE,
  SCOPE_DESTINATION,
  SCOPE_LABEL,
  type ExploreScope,
} from '../_data';

/**
 * The harness: one route carrying every view the change touches.
 *
 * Six pages rather than six mock routes, because the thing under review is not
 * any one of these screens — it is the *path between them*. Pick Events in the
 * homepage pill and land on an events page; pick Panas signed-out and hit a
 * gate. Split across six URLs, a reviewer has to hold the journey in their
 * head and take the hand-off between screens on trust, which is exactly where
 * this kind of proposal hides its problems.
 *
 * So scope, query, menu state and signed-in state are all lifted here and
 * shared by every view. Changing the scope in one view changes it in all of
 * them, and the switcher follows the scope rather than fighting it.
 */

type ViewId =
  | 'home'
  | 'home-open'
  | 'directory'
  | 'events'
  | 'groups'
  | 'panas';

const VIEWS: { id: ViewId; label: string; hint: string }[] = [
  { id: 'home', label: 'Home', hint: 'The hero with the scope control in the pill' },
  { id: 'home-open', label: 'Home · menu', hint: 'The scope menu open, destinations named' },
  { id: 'directory', label: 'Directory', hint: '/directory/search — businesses only now' },
  { id: 'events', label: 'Events', hint: '/explore/events — grouped by day' },
  { id: 'groups', label: 'Groups', hint: '/explore/groups — public, with a joined shelf' },
  { id: 'panas', label: 'Panas', hint: '/explore/panas — members only' },
];

/** Which view a scope lands on when someone presses Enter. */
const SCOPE_VIEW: Record<ExploreScope, ViewId> = {
  business: 'directory',
  event: 'events',
  group: 'groups',
  pana: 'panas',
};

export function ExploreMock() {
  const [view, setView] = useState<ViewId>('home');
  const [scope, setScope] = useState<ExploreScope>(DEFAULT_EXPLORE_SCOPE);
  const [term, setTerm] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(true);
  const [empty, setEmpty] = useState(false);

  /* Picking a scope on a results page is a navigation, not a filter — that is
     the whole point of promoting it out of the chip row. Following it here is
     what makes that legible: change the scope on the events page and the mock
     moves to groups, exactly as the real control would. The homepage is the
     one exception, because there the choice is made *before* submitting. */
  function handleScope(next: ExploreScope) {
    setScope(next);
    setMenuOpen(false);
    if (view !== 'home' && view !== 'home-open') setView(SCOPE_VIEW[next]);
  }

  function handleView(next: ViewId) {
    setView(next);
    setMenuOpen(next === 'home-open');
    if (next !== 'home' && next !== 'home-open') {
      const match = (
        Object.entries(SCOPE_VIEW) as [ExploreScope, ViewId][]
      ).find(([, id]) => id === next);
      if (match) setScope(match[0]);
    }
  }

  const shared: ViewProps = {
    scope,
    onScope: handleScope,
    term,
    onTerm: setTerm,
    open: menuOpen,
    onOpen: (next) => {
      setMenuOpen(next);
      if (view === 'home-open' && !next) setView('home');
      if (view === 'home' && next) setView('home-open');
    },
    signedIn,
    empty,
  };

  return (
    /* `data-density="compact"` is what the live homepage wraps itself in, and
       it is the first selector in the `--story-*` palette block in
       app/globals.css. Without it — or a `.dirsearch` / `.dirscope` ancestor —
       every colour on these pages resolves to nothing and the mock renders on
       a transparent background with no error to explain it. */
    <div data-density="compact">
      <MockBar
        view={view}
        onView={handleView}
        signedIn={signedIn}
        onSignedIn={setSignedIn}
        empty={empty}
        onEmpty={setEmpty}
        scope={scope}
      />

      {view === 'home' || view === 'home-open' ? (
        <HomeView {...shared} />
      ) : view === 'directory' ? (
        <DirectoryView {...shared} />
      ) : view === 'events' ? (
        <EventsView {...shared} />
      ) : view === 'groups' ? (
        <GroupsView {...shared} />
      ) : (
        <PanasView {...shared} />
      )}

      <footer className="container mx-auto px-4 pt-4 pb-24 text-center text-[0.8125rem] font-semibold opacity-50">
        Design mock at <code>/mock/explore</code> · static fixtures, no data ·
        see <code>app/mock/explore/_data.ts</code> for the argument
      </footer>
    </div>
  );
}

/**
 * Scaffolding, not design.
 *
 * Carries the view switcher, the two viewer states that change what these
 * pages are allowed to show, and a link back to the live directory so the
 * before and after can be put side by side. Styled with the same
 * `.bizprofile-mockbar` / `.mock-switch` the other mocks use so it reads as
 * chrome and never as part of the proposal.
 */
function MockBar({
  view,
  onView,
  signedIn,
  onSignedIn,
  empty,
  onEmpty,
  scope,
}: {
  view: ViewId;
  onView: (next: ViewId) => void;
  signedIn: boolean;
  onSignedIn: (next: boolean) => void;
  empty: boolean;
  onEmpty: (next: boolean) => void;
  scope: ExploreScope;
}) {
  return (
    <div className="bizprofile-mockbar">
      <div className="container mx-auto flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase opacity-70">
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          Design mock · Search &amp; explore
        </span>

        <div className="mock-switch" role="radiogroup" aria-label="View">
          {VIEWS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={view === option.id}
              title={option.hint}
              data-active={view === option.id}
              onClick={() => onView(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Where Enter currently points. Shown because the destination is the
            part of this proposal that is invisible until you press the key,
            and a reviewer should be able to check it without pressing it. */}
        <span className="text-[0.6875rem] font-bold tracking-wide opacity-55">
          {SCOPE_LABEL[scope]} → <code>{SCOPE_DESTINATION[scope]}</code>
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="mock-switch" role="radiogroup" aria-label="Viewer">
            <button
              type="button"
              role="radio"
              aria-checked={signedIn}
              title="A signed-in member — panas and joined groups are visible"
              data-active={signedIn}
              onClick={() => onSignedIn(true)}
            >
              Pana
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!signedIn}
              title="A visitor — the panas page becomes a gate"
              data-active={!signedIn}
              onClick={() => onSignedIn(false)}
            >
              Signed out
            </button>
          </div>

          <div className="mock-switch" role="radiogroup" aria-label="Results">
            <button
              type="button"
              role="radio"
              aria-checked={!empty}
              data-active={!empty}
              onClick={() => onEmpty(false)}
            >
              Results
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={empty}
              title="The no-results state on events and groups"
              data-active={empty}
              onClick={() => onEmpty(true)}
            >
              Empty
            </button>
          </div>

          <Link href="/directory" className="mock-toolbar-link">
            Compare with the live directory
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

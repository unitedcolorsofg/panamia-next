'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Lock, Sparkles } from 'lucide-react';
import type { MockSurface } from '../../_data/panaverse';
import { SurfaceMasthead } from '../../_components/surface-masthead';
import type { GroupsPage, ViewerAuth } from '../_data/mock-groups';
import { GroupsLanding } from './groups-landing';
import { GroupsDiscover } from './groups-discover';
import { GroupsShell } from './groups-shell';

/**
 * Two pages under one mock route.
 *
 * They are separate URLs in the proposal -- /groups and /groups/discover --
 * but one mock, because the question being asked is whether the handoff
 * between them works. A landing page reviewed on its own always looks fine;
 * what goes wrong is arriving at discover having lost the topic you clicked.
 * Switching in place, with the topic carried across, is the only way to see
 * that.
 *
 * Precedent is /mock/group, which puts its viewer switch in the toolbar for
 * the same reason: the thing being reviewed is a transition, not a snapshot.
 * It is not the /mock/dms two-design comparison -- these are not competing
 * answers to one question, they are two halves of one flow.
 */
export function GroupsMock({ surfaces }: { surfaces: MockSurface[] }) {
  const router = useRouter();
  const [page, setPage] = useState<GroupsPage>('landing');
  const [viewer, setViewer] = useState<ViewerAuth>('member');

  /* Carried across the handoff rather than reset. Clicking "Printmaking" on
     the landing page and landing on an unfiltered discover page is the single
     most likely way to get this flow wrong, so the mock wires it properly in
     order to be able to show it working. */
  const [topic, setTopic] = useState<string | null>(null);

  const current =
    surfaces.find((surface) => surface.id === 'social') ?? surfaces[0];

  const openDiscover = (next?: string) => {
    setTopic(next ?? null);
    setPage('discover');
  };

  const selectPage = (next: GroupsPage) => {
    if (next === 'landing') setTopic(null);
    setPage(next);
  };

  return (
    <main className="surface-cream min-h-screen pb-20">
      <MockToolbar
        page={page}
        onSelectPage={selectPage}
        viewer={viewer}
        onSelectViewer={setViewer}
        hostname={current.hostname}
      />

      <SurfaceMasthead
        surfaces={surfaces}
        current={current}
        onSelect={(id) => {
          if (id !== current.id) router.push('/mock/panaverse');
        }}
        sticky
        contained
      />

      <GroupsShell viewer={viewer} page={page} onNavigate={selectPage}>
        {page === 'landing' ? (
          <GroupsLanding viewer={viewer} onOpenDiscover={openDiscover} />
        ) : (
          <GroupsDiscover
            /* Keyed on the incoming topic so arriving from a chip rebuilds the
               page with that filter already applied, rather than keeping the
               state from the last visit. */
            key={topic ?? 'all'}
            viewer={viewer}
            initialTopic={topic}
            onBack={() => selectPage('landing')}
          />
        )}
      </GroupsShell>

      {/* Rendered on both pages because both show group covers, and the cover
          pool is the directory's Pexels one. The Pexels API guidelines ask
          for a visible link back wherever their photographs appear -- the
          directory carries the same line under its results. Real groups
          upload their own headers, so this retires itself along with the
          placeholder art. */}
      <p className="dirsearch-photocredit container mx-auto max-w-5xl px-4 pt-10">
        Group cover photos from{' '}
        <a
          href="https://www.pexels.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Pexels
        </a>
        .
      </p>
    </main>
  );
}

/* Same dark chrome as the feed and group mocks: above the masthead, scrolls
   away while the masthead sticks.
 *
 * Two switches rather than one. Page is the obvious one. Signed-in state is
 * there because it changes the landing page materially -- the shelf of your
 * own groups disappears -- and the people this page exists to convince are
 * precisely the ones who do not have one. */
function MockToolbar({
  page,
  onSelectPage,
  viewer,
  onSelectViewer,
  hostname,
}: {
  page: GroupsPage;
  onSelectPage: (page: GroupsPage) => void;
  viewer: ViewerAuth;
  onSelectViewer: (viewer: ViewerAuth) => void;
  hostname: string;
}) {
  return (
    <div className="mock-toolbar">
      <span className="mock-toolbar-badge">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Mock
      </span>

      <span className="mock-toolbar-host">
        <Lock className="h-3 w-3 flex-none" aria-hidden="true" />
        {hostname}
      </span>

      <div className="mock-switch ml-auto">
        <button
          type="button"
          data-active={page === 'landing'}
          onClick={() => onSelectPage('landing')}
        >
          Landing
        </button>
        <button
          type="button"
          data-active={page === 'discover'}
          onClick={() => onSelectPage('discover')}
        >
          Discover
        </button>
      </div>

      <div className="mock-switch">
        <button
          type="button"
          data-active={viewer === 'member'}
          onClick={() => onSelectViewer('member')}
        >
          Signed in
        </button>
        <button
          type="button"
          data-active={viewer === 'signedOut'}
          onClick={() => onSelectViewer('signedOut')}
        >
          Signed out
        </button>
      </div>

      <Link href="/mock/group" className="mock-toolbar-link">
        Group page mock
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

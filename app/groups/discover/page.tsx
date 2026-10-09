import { Suspense } from 'react';
import { GroupsDiscoverContent } from './_components/groups-discover';
import { GroupsShell } from '@/app/groups/_components/groups-shell';

/**
 * /groups/discover - searching, filtering and sorting groups.
 *
 * Split out from /groups rather than living under it. That page used to do
 * both jobs on one screen, which meant the browse list sat under a search box
 * and every visit looked like a fresh search even when the visitor only
 * wanted their own groups. Now /groups answers "what is this and where do I
 * already belong" and this page answers "find me one".
 *
 * Public, for the same reason /groups is: the door into a group is its
 * `joinPolicy`, not the search index. Private groups are listed here so a
 * request-to-join group can be asked to join; what a stranger is and is not
 * told about one is decided in SQL -- see lib/server/group-search.ts.
 *
 * Not under /s -- see the note on the social surface's `paths` in
 * lib/panaverse/surfaces.ts.
 */

/* Typed structurally rather than as `Metadata`: the vinext `next` shim does
   not export that type. */
export const metadata = {
  title: 'Discover groups | Pana Social',
  description: 'Search groups on Pana Social by name or interest.',
  /* Public to people, not to crawlers, matching /groups: private groups are
     listed here, which assumes a person doing the asking rather than a
     crawler enumerating every private group on the site. */
  robots: { index: false, follow: true },
};

function DiscoverFallback() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="bg-pana-ink/10 h-10 w-56 rounded-xl" />
      <div className="bg-pana-ink/10 h-11 rounded-full" />
      <div className="bg-pana-ink/10 h-40 rounded-2xl" />
      <div className="bg-pana-ink/10 h-40 rounded-2xl" />
    </div>
  );
}

export default function GroupsDiscoverPage() {
  return (
    <main className="surface-cream min-h-screen pb-20">
      <GroupsShell>
        <Suspense fallback={<DiscoverFallback />}>
          <GroupsDiscoverContent />
        </Suspense>
      </GroupsShell>
    </main>
  );
}

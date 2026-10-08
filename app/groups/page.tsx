import { Suspense } from 'react';
import { GroupsContent } from './_components/groups-content';
import { GroupsShell } from './_components/groups-shell';

/**
 * /groups - the front door for groups.
 *
 * Splits the two questions a member arrives with. "Where do I already belong"
 * is answered first, from their own memberships including private ones; "what
 * else is out there" is answered underneath, by the same search endpoint the
 * homepage's Groups scope sends people to.
 *
 * This is now the only groups search. /directory/groups/<term> used to answer
 * a typed term for a reader it knew nothing about, and this page was the
 * member's own shelf; the directory narrowing to listings collapsed the two,
 * and that old URL redirects here. The shelf survived the merge because a
 * group is somewhere you return to, unlike a listing, and burying "the four
 * I'm already in" under a search box treats a regular visit as a fresh
 * discovery every time. Signed out there is no shelf, because there are no
 * groups of yours to put on it, and the page is a flat list of everything.
 *
 * Public either way. Groups used to be gated alongside panas, which made a
 * group invisible to exactly the people it needed to recruit. The door is
 * `joinPolicy`, not the search index -- see the groups API route for what a
 * signed-out reader is and is not told about a group.
 *
 * Not under /s -- see the note on the social surface's `paths` in
 * lib/panaverse/surfaces.ts.
 */

/* Typed structurally rather than as `Metadata`: the vinext `next` shim does
   not export that type. */
export const metadata = {
  title: 'Groups | Pana Social',
  description: 'Find a group on Pana Social, or start your own.',
  /* Public to people, not to crawlers, and the distinction is deliberate:
     private groups are listed here so a request-to-join group can be asked to
     join, which assumes a person doing the asking rather than a crawler
     enumerating every private group on the site. */
  robots: { index: false, follow: true },
};

function GroupsFallback() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="bg-pana-ink/10 h-10 w-48 rounded-xl" />
      <div className="bg-pana-ink/10 h-24 rounded-2xl" />
      <div className="bg-pana-ink/10 h-24 rounded-2xl" />
    </div>
  );
}

export default function GroupsPage() {
  return (
    <main className="surface-cream min-h-screen pb-20">
      <GroupsShell>
        <Suspense fallback={<GroupsFallback />}>
          <GroupsContent />
        </Suspense>
      </GroupsShell>
    </main>
  );
}

import { Suspense } from 'react';
import { GroupsContent } from './_components/groups-content';

/**
 * /groups - the front door for groups.
 *
 * Splits the two questions a member arrives with. "Where do I already belong"
 * is answered first, from their own memberships including private ones; "what
 * else is out there" is answered underneath, by the same search endpoint the
 * directory's Groups scope uses.
 *
 * Distinct from /directory/groups/<term> on purpose. That page answers a typed
 * term and knows nothing about the reader. This one is the member's own shelf,
 * and it is where starting a group lives -- discovery and creation are the same
 * errand often enough that making someone search before they can create was
 * the gap that left groups unreachable from the UI entirely.
 *
 * Not under /s -- see the note on the social surface's `paths` in
 * lib/panaverse/surfaces.ts.
 */

/* Typed structurally rather than as `Metadata`: the vinext `next` shim does
   not export that type. */
export const metadata = {
  title: 'Groups | Pana Social',
  description: 'Find a group on Pana Social, or start your own.',
  /* Same stance as the directory's Groups scope, and for the same reason:
     private groups are deliberately discoverable so a request-to-join group
     can be asked to join, which assumes a person doing the asking rather than
     a crawler enumerating every private group on the site. */
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
      <div className="container mx-auto max-w-4xl px-4 pt-8">
        <Suspense fallback={<GroupsFallback />}>
          <GroupsContent />
        </Suspense>
      </div>
    </main>
  );
}

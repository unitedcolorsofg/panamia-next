import type { Metadata } from 'next';
import { SURFACES, hostnameFor } from '@/lib/panaverse/surfaces';
import { GroupMock } from './_components/group-mock';
import type { MockSurface } from '../_data/panaverse';

/* Design mock for a Pana Social GROUP home page — the third surface in the
   set, after /mock/profile (one author, many readers) and /mock/feed (many
   authors, one reader). A group is many authors and many readers with a door
   on it, and the door is what this mock is really about.

   It renders the design in docs/GROUPS-ROADMAP.md so the schema can be argued
   about in pictures before migration 0043 is written. Three things it is
   trying to settle:

     1. A group post is a status with a group on it. The mock proves this by
        importing the feed's post card rather than drawing a new one.
     2. A group is an actor. The hero is the profile hero with a privacy state
        and a join button.
     3. Real-time chat is not a group-page concern. It is being designed as
        its own feature on its own surface, so this page stays slow: posts,
        events, roster.

   The viewer switch in the toolbar is the point of the page. Groups look
   different depending on who is asking, and the private state is where the
   roadmap's highest-severity risk lives.

   Surfaces come from the registry the Worker routes on, same as the feed mock,
   which keeps `process.env` out of the client bundle.

   Noindex because it is a fixture route — no real group lives here. */
export const metadata: Metadata = {
  title: 'Group (mock) | Pana Social',
  robots: { index: false, follow: false },
};

export default function MockGroupPage() {
  const surfaces: MockSurface[] = SURFACES.map((surface) => ({
    id: surface.id,
    name: surface.name,
    hostname: hostnameFor(surface),
    rootPath: surface.rootPath,
  }));

  return <GroupMock surfaces={surfaces} />;
}

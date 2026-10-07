import type { Metadata } from 'next';
import { SURFACES, hostnameFor } from '@/lib/panaverse/surfaces';
import { GroupsMock } from './_components/groups-mock';
import type { MockSurface } from '../_data/panaverse';

/* Design mocks for the two pages in front of a group, as opposed to
   /mock/group which is the group itself.

   The prompt for these was removing the "Get Involved" tile from the account
   menu and putting a Groups tile in its place. That tile points at /groups,
   and /groups today is a thin utility page: a heading, a "Start a group"
   button, your own groups if you have any, and a search box over a flat list.
   It works for somebody who knows what they are looking for and says nothing
   at all to somebody who followed a bubble to see what groups are -- which is
   now the main way people will arrive.
  
   So this proposes a split:
  
     /groups          a landing page. Your groups, topics to browse, active
                      groups as evidence, group-hosted events, start one last.
     /groups/discover the search surface. Term, topic, sort, counts, empty
                      state.
  
   Both are rendered here behind one switch because the thing worth reviewing
   is the handoff: a topic clicked on the landing page has to arrive at
   discover already applied, and that is invisible in two separate mocks.
  
   Unlike /mock/group, every column annotated in the fixtures exists today --
   groups shipped. These are a redesign of a live page, not a proposal for an
   unbuilt one.
  
   Surfaces come from the registry the Worker routes on, same as the other
   social mocks, which keeps `process.env` out of the client bundle.
  
   Noindex because it is a fixture route -- none of these groups are real. */
export const metadata: Metadata = {
  title: 'Groups landing and discover (mock) | Pana Social',
  robots: { index: false, follow: false },
};

export default function MockGroupsPage() {
  const surfaces: MockSurface[] = SURFACES.map((surface) => ({
    id: surface.id,
    name: surface.name,
    hostname: hostnameFor(surface),
    rootPath: surface.rootPath,
  }));

  return <GroupsMock surfaces={surfaces} />;
}

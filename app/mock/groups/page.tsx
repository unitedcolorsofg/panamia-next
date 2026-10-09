import type { Metadata } from 'next';
import { SURFACES, hostnameFor } from '@/lib/panaverse/surfaces';
import { GroupsMock } from './_components/groups-mock';
import type { MockSurface } from '../_data/panaverse';

/* Design mocks for the pages in front of a group, as opposed to /mock/group
   which is the group itself.

   The original prompt was removing the "Get Involved" tile from the account
   menu and putting a Groups tile in its place. That tile points at /groups,
   and /groups then was a thin utility page: a heading, a "Start a group"
   button, your own groups if you have any, and a search box over a flat list.
   It worked for somebody who knew what they were looking for and said nothing
   at all to somebody who followed a bubble to see what groups are -- which is
   now the main way people arrive. That produced a landing page and a discover
   page, both of which shipped.

   This revision answers the problem that created: /groups is now recruitment
   material end to end, and it is served to members too. The rail took your
   own groups out of the column, correctly, and nothing replaced them -- so a
   member of four groups still lands on "Groups are where a shared interest
   gets a room" and ten topic chips.

   So the proposal is three renders across two URLs:

     /groups          stateful. A digest for members -- join requests waiting
                      on you, events across your groups, and which group has
                      news. The existing pitch for everyone else, which is
                      what it always was: an empty state.
     /groups/discover the search surface, unchanged. Term, topic, sort,
                      counts, empty state.

   All three render here behind one switch because the things worth reviewing
   are the handoffs: a topic clicked on the pitch has to arrive at discover
   already applied, and a member must never see the pitch. Neither is visible
   in separate mocks.

   The digest is deliberately not a feed. getHomeTimeline already has a group
   arm that pulls posts from your groups into the main feed on membership
   alone, private ones included, so a stream here would be the same posts
   twice. What it shows instead is the three things a merged chronological
   feed structurally cannot: a queue, a per-group calendar, and silence.

   Unlike /mock/group, every column annotated in the fixtures exists today
   except one -- `newPosts` needs a per-member last-seen marker that
   social_group_members does not have. These are a redesign of live pages,
   not a proposal for an unbuilt one.

   Surfaces come from the registry the Worker routes on, same as the other
   social mocks, which keeps `process.env` out of the client bundle.

   Noindex because it is a fixture route -- none of these groups are real. */
export const metadata: Metadata = {
  title: 'Groups home, landing and discover (mock) | Pana Social',
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

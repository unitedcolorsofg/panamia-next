import type { Metadata } from 'next';
import { SURFACES, hostnameFor } from '@/lib/panaverse/surfaces';
import { FeedMock } from './_components/feed-mock';
import type { MockSurface } from '../_data/panaverse';

/* Design mock for the Pana Social FEED — the timeline a signed-in member
   reads. It is the companion to /mock/profile: same cards, same tabs, same
   stat rail, different surface. The profile is one author and many readers;
   the feed is many authors and one reader.

   The surfaces come from the same registry the Worker routes hostnames on, so
   the masthead cannot fly a mark for a surface that does not exist, and the
   hostname shown in the mock toolbar is the one that will actually serve this
   page. Reading it server-side also keeps `process.env` — which
   `getRootDomain()` touches — out of the client bundle.

   The title says "Pana Social", not "… | Pana Mia". The suffix was a holdover
   from when the feed was a page of the main site, and a browser tab reading
   "Pana Mia" while the masthead flies the Pana Social mark is the same
   mismatch this redesign exists to remove.

   Noindex because it is a fixture route, not a real timeline — it must not
   compete with the live social routes in search or show up in the sitemap. */
export const metadata: Metadata = {
  title: 'My feed (mock) | Pana Social',
  robots: { index: false, follow: false },
};

export default function MockFeedPage() {
  const surfaces: MockSurface[] = SURFACES.map((surface) => ({
    id: surface.id,
    name: surface.name,
    hostname: hostnameFor(surface),
    rootPath: surface.rootPath,
  }));

  return <FeedMock surfaces={surfaces} />;
}

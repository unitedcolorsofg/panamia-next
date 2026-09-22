import type { Metadata } from 'next';
import { FeedMock } from './_components/feed-mock';

/* Design mock for the Pana Social FEED — the timeline a signed-in member
   reads. It is the companion to /mock/profile: same cards, same tabs, same
   stat rail, different surface. The profile is one author and many readers;
   the feed is many authors and one reader.

   Noindex because it is a fixture route, not a real timeline — it must not
   compete with the live social routes in search or show up in the sitemap. */
export const metadata: Metadata = {
  title: 'Pana Social feed (mock) | Pana Mia',
  robots: { index: false, follow: false },
};

export default function MockFeedPage() {
  return <FeedMock />;
}

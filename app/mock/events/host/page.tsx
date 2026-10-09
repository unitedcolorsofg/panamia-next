import type { Metadata } from 'next';

import { EventsHost } from './_components/events-host';

/**
 * Host an event, redesigned so the form answers to the page it feeds.
 *
 * The argument lives in `_components/events-host.tsx`. In short: `/e/new`
 * today is a wall of twelve controls in column order with one piece of
 * validation, and it never shows a host what their event will look like or who
 * will be able to find it. `/e` ranks by reasons; this page shows the real
 * card and the real lanes while the host is still typing.
 *
 * It sits under `/mock/events` rather than beside it because it is the same
 * mock seen from the other end — it reads that mock's fixtures, its
 * `EventCard` and its `reasonsFor` matcher, and a separate top-level folder
 * would have meant a second set of tags, venues and hosts free to drift from
 * the page the host is actually posting to.
 *
 * Server component purely to carry `robots: noindex`, which
 * app/mock/README.md requires of every mock route and which robots.ts does not
 * otherwise enforce for /mock.
 */
export const metadata: Metadata = {
  title: 'Mock — host an event',
  robots: { index: false, follow: false },
};

export default function EventsHostMockPage() {
  return <EventsHost />;
}

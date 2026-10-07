import type { Metadata } from 'next';
import { EventsDiscover } from './_components/events-discover';

/**
 * /mock/events — an events discover page for directory.pana.social/events.
 *
 * Why this exists: there is nowhere to go and browse what is on. `/events` is
 * an offering front page — it explains what Pana Mia events are to somebody
 * who has not been to one. `/e` lists everything upcoming in one flat column.
 * `/directory/events` is a search scope, and its bare browse view literally
 * renders "Type something to search." All three are reasonable answers to
 * questions people do ask. None of them answers the question most people
 * arrive with, which is "what is on this weekend near me".
 *
 * That question cannot be typed. It has four clauses — when, where, what kind,
 * who else — and three of them are not words, which is why a search box has
 * never been able to take it. So this page is built out of the four as
 * controls rather than as text: a When rail, a date strip counted off the
 * calendar itself, a Type filter, and a section ranked by which of your panas
 * are going. The results group by day, because a week has days in it and a
 * relevance-ranked flat list throws that away.
 *
 * Everything above the grid is the directory's shipping chrome, class for
 * class — `.surface-indigo .dirsearch-band`, the search pill, the
 * `.dirsearch-filterrow` rail — and the cards are `/mock/directory-unified`'s
 * card with its event column filled in. That is deliberate. Events are not a
 * separate product with a separate look; they are one of the four kinds the
 * directory already indexes, and the argument of this page is that discovery
 * is a room in the directory rather than a site of its own.
 *
 * Which is also why the hostname is part of the mock. `directory.pana.social`
 * is not in `lib/panaverse/surfaces.ts` — the registry holds www, social,
 * connectors and admin, so that host would fall back to www today and serve
 * the marketing page. Promoting the directory to the fifth surface is a
 * registry entry and a DNS record, not a rewrite, and the browser frame around
 * the mock is there because that promotion is half of what is being proposed.
 *
 * The other half is the account menu, drawn open on the right. "The events
 * button in the profile menu will also guide the user there" is a claim about
 * one `href` in `lib/panaverse/sites.ts`, currently `/e`. Nothing in the live
 * registry is repointed at a mock route — the wiring is demonstrated inside
 * the mock instead, where it can be seen next to the page it lands on.
 *
 * Server component purely to carry `robots: noindex`, which
 * app/mock/README.md requires of every mock route and which robots.ts does not
 * otherwise enforce for /mock.
 */
export const metadata: Metadata = {
  title: 'Mock — events discover',
  robots: { index: false, follow: false },
};

export default function EventsDiscoverMockPage() {
  return <EventsDiscover />;
}

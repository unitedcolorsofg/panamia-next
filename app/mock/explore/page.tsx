import type { Metadata } from 'next';
import { ExploreMock } from './_components/explore-mock';

/**
 * /mock/explore — the scope control moves to the homepage, and three kinds
 * move out of the directory.
 *
 * Why this exists: the club met and asked for three things. Put the
 * directory / events / groups / panas toggle on the main page's search bar.
 * Leave the directory to its listings. Give events and groups their own
 * explore pages so people can find what is happening near them without going
 * through a directory that was never built for it.
 *
 * All three are the same change seen from different ends. The scope toggle
 * only ever existed because four unlike things shared one results page; once
 * each kind has its own page, the toggle stops being a filter and becomes
 * navigation — and navigation belongs in the search box, before the question
 * is asked, not in a chip row you reach by asking it wrongly first.
 *
 * What the live site does today, for comparison:
 *
 *   - The homepage hero searches "Everything" and says so in its placeholder
 *     ("Search panas, businesses, groups, events"), because it had no control
 *     to say it with. Its own comment in `components/home/sections.tsx` admits
 *     the previous behaviour advertised four kinds and dropped three on submit.
 *   - `/directory/search` serves directory listings with a map, county and
 *     category facets and a rich card.
 *   - `/directory/[scope]` serves the other three from one template, with no
 *     facets at all, 70px rows, and no RSVP, join or follow action anywhere.
 *   - Groups and panas are both members-only, so half the club's public
 *     activity is invisible to the people it is trying to reach.
 *
 * Decisions taken with the club, visible in the mock:
 *
 *   - Two separate explore pages, not one combined "community" page.
 *   - Panas gets a page too, still members-only, with a real gate.
 *   - "Everything" is dropped. The scope menu forces a choice and defaults to
 *     Directory. A search that could mean four things usually meant one.
 *
 * Decisions taken here and open for argument — flagged so review catches them:
 *
 *   - Groups become public. See the comment on `GroupsView`.
 *   - Each page tints from its own scope tone instead of all four being indigo.
 *   - The scope menu names its destination path before you press Enter.
 *
 * Server component purely so it can carry `robots: noindex`, which
 * app/mock/README.md requires of every mock route. `robots.ts` does not
 * disallow /mock, so this header is the only thing keeping it out of search.
 */
export const metadata: Metadata = {
  title: 'Mock — explore',
  robots: { index: false, follow: false },
};

export default function ExploreMockPage() {
  return <ExploreMock />;
}

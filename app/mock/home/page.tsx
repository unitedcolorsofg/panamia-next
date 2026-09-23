import type { Metadata } from 'next';
import { HomeMock } from './_components/home-mock';

/* Design mock for the homepage.
 *
 * Route: /mock/home
 *
 * Built from the Community Connectors Program deck (2026) and the sketch the
 * panas brought over: search, then an info card of notes, then the three
 * pillars, then the existing point-and-newsletter close. The reasoning for
 * each card — and for the seven live sections this drops — is in
 * `_components/home-mock.tsx`; the copy and its slide-by-slide provenance is
 * in `_data.ts`.
 *
 * Noindex because it is a fixture route. It duplicates the real homepage's
 * subject matter almost exactly, so left indexable it would compete with `/`
 * for the site's own name.
 */
export const metadata: Metadata = {
  title: 'Homepage (mock) | Pana Mia',
  robots: { index: false, follow: false },
};

export default function MockHomePage() {
  return <HomeMock />;
}

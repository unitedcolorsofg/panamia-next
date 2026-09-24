import { OfferingFrontPage } from '@/components/offerings/offering-front-page';

/**
 * Pana Ink Press's front page.
 *
 * The press itself is not printing yet, but the page does not say so — the
 * call was vision-first, and an offering that apologises for itself in its own
 * headline is not selling anything. Both buttons go somewhere real: the
 * dispatches at `/a` are the writing the press will put on paper first, which
 * is also the honest version of "already underway".
 */

// Static marketing page — cache at the edge, revalidate hourly (Workers Cache).
export const revalidate = 3600;

export const metadata = {
  title: 'Pana Ink Press | Pana MIA Club',
  description:
    'Zines, pamphlets and printed matter that explain the local movement in a form anyone can hand to anyone.',
};

export default function InkFrontPage() {
  return (
    <OfferingFrontPage
      id="ink"
      actions={{ primary: '/a', secondary: '/form/become-a-pana' }}
    />
  );
}

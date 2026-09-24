import { OfferingFrontPage } from '@/components/offerings/offering-front-page';

/**
 * Pana Ink Press's front page.
 *
 * The press itself is not built, so this page carries the "coming soon" note
 * the shared component renders for any offering whose `appHref` is null. The
 * primary button still goes somewhere real — the dispatches at `/a` are the
 * writing the press will eventually print — because a front page with one
 * dead button and one live one is worse than one with two live ones.
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

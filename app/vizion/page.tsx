import { OfferingFrontPage } from '@/components/offerings/offering-front-page';

/**
 * PanaVizion's front page.
 *
 * The podcast is the offering, so `/podcasts` is the primary. The dispatches
 * at `/a` are the same work written down, which makes them the honest second
 * door rather than a link to somewhere unrelated.
 */

// Static marketing page — cache at the edge, revalidate hourly (Workers Cache).
export const revalidate = 3600;

export const metadata = {
  title: 'PanaVizion | Pana MIA Club',
  description:
    'Conversations with the people building South Florida’s local economy, in their own voice and at their own length.',
};

export default function VizionFrontPage() {
  return (
    <OfferingFrontPage
      id="vizion"
      actions={{ primary: '/podcasts', secondary: '/a' }}
    />
  );
}

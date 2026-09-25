import { OfferingFrontPage } from '@/components/offerings/offering-front-page';

/**
 * Pana Social's front page.
 *
 * `/s` is the feed itself and asks you to be signed in before it says
 * anything; this is the page that explains what you would be signing in to.
 * Copy and structure live in the shared component and the `offerings`
 * namespace — all that is decided here is where the two buttons go.
 */

// Static marketing page — cache at the edge, revalidate hourly (Workers Cache).
export const revalidate = 3600;

export const metadata = {
  title: 'Pana Social | Pana MIA Club',
  description:
    'A local social network that federates, so the community owns its own timeline instead of renting one.',
};

export default function SocialFrontPage() {
  return (
    <OfferingFrontPage
      id="social"
      actions={{ primary: '/s', secondary: '/form/become-a-pana' }}
    />
  );
}

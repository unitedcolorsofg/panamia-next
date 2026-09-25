import { OfferingFrontPage } from '@/components/offerings/offering-front-page';

/**
 * The directory's front page.
 *
 * This route used to be `redirect('/d')`, from before the directory had
 * anything to say for itself: the only thing at `/directory` was a search
 * form, so sending people straight to it was the whole of the answer.
 *
 * It is a front page now because the directory is one of the six offerings
 * and the nav drawer names it alongside the other five — and a drawer item
 * that dumps you into a results page with no explanation is the one entry
 * that behaves differently from its neighbours. `/d` is still the canonical
 * search URL and is still the primary button here; what changed is that
 * `/directory` now introduces it instead of skipping past it.
 */

// Static marketing page — cache at the edge, revalidate hourly (Workers Cache).
export const revalidate = 3600;

export const metadata = {
  title: 'Directory | Pana MIA Club',
  description:
    'The living archive of South Florida — the creatives, founders and small businesses who make this place what it is.',
};

export default function DirectoryFrontPage() {
  return (
    <OfferingFrontPage
      id="directory"
      actions={{ primary: '/d', secondary: '/form/become-a-pana' }}
    />
  );
}

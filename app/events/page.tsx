import { OfferingFrontPage } from '@/components/offerings/offering-front-page';

/**
 * The events front page.
 *
 * `/e` is the calendar; this is what the calendar is for. The secondary
 * button goes to `/e/new` rather than to the become-a-pana form, because the
 * thing this offering most wants from a reader is another event on it.
 */

// Static marketing page — cache at the edge, revalidate hourly (Workers Cache).
export const revalidate = 3600;

export const metadata = {
  title: 'Events | Pana MIA Club',
  description:
    'Markets, workshops, art builds and long dinners across South Florida, organised with the people already doing the work.',
};

export default function EventsFrontPage() {
  return (
    <OfferingFrontPage
      id="events"
      actions={{ primary: '/e', secondary: '/e/new' }}
    />
  );
}

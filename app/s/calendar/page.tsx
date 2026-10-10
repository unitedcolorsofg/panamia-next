import { CalendarPage } from './_components/calendar-page';

/**
 * /s/calendar - everything this pana said yes to.
 *
 * Deliberately noindex, and not for the usual signed-in-page reason. Half of
 * this page is derived from who you follow and which groups you are in, and
 * the committed half includes unlisted events and undecided RSVPs. None of
 * that is public information about anybody, so it must never be crawled.
 *
 * `follow: true` because the events it links to are public pages with their
 * own canonicals; it is this page's contents that are private, not its
 * destinations.
 */

/* Typed structurally rather than as `Metadata`: the vinext `next` shim does
   not export that type. */
export const metadata = {
  title: 'Your calendar | Pana Social',
  description: 'Events you are going to, across your groups and your Panas.',
  robots: { index: false, follow: true },
};

export default function SocialCalendarPage() {
  return <CalendarPage />;
}

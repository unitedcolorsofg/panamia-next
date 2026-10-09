import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { getDiscoveryFeed } from '@/lib/events/discovery';
import { EventsDiscover } from './events-discover';

/**
 * The events surface's front door.
 *
 * A component rather than only a page because the route and the surface are
 * named separately: `/e` is the canonical path every minted event link already
 * points at, and app/page.tsx keeps a (now unreachable) `case 'events'` branch
 * that renders this same component, so the switch over surface ids stays
 * exhaustive. Events is path-only — `subdomain: null` in
 * lib/panaverse/surfaces.ts — so no hostname dispatches here today. Extracting
 * it is what stops the two drifting — the alternative is the root importing
 * a route's default export, which works but reads like a mistake and invites
 * somebody to "fix" it by copying the body.
 *
 * Thin on purpose: it resolves who is asking, hands that to the reason engine,
 * and renders. Every judgement about *why* an event is on the page lives in
 * lib/events/discovery.ts, where it can be read in one piece rather than
 * reconstructed from a page, a query and a component.
 *
 * `viewerProfileId` null is signed out, which is a different state from
 * "signed in with no follows" — the first cannot be computed, the second came
 * back empty — and the page says so rather than showing the same bare list in
 * both cases.
 */
export async function EventsFrontDoor() {
  const session = await auth();
  const viewerProfile = session?.user?.id
    ? await db.query.profiles.findFirst({
        where: eq(profiles.userId, session.user.id),
        columns: { id: true },
      })
    : null;

  const { events, dismissedIds } = await getDiscoveryFeed(
    viewerProfile?.id ?? null
  );

  return (
    <EventsDiscover
      events={events}
      dismissedIds={dismissedIds}
      signedIn={viewerProfile !== null}
    />
  );
}

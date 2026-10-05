import { redirect } from 'next/navigation';

import { HouseBoard } from '@/components/connectors/house-board';
import { ViewerSwitch } from '@/components/connectors/viewer-switch';
import { OfferingFrontPage } from '@/components/offerings/offering-front-page';
import { resolveViewerRole } from '@/lib/connectors/fixtures';

/**
 * The Pana Connectors front page.
 *
 * Two audiences arrive at the same door and only one of them wants a pitch.
 * Someone who is already a connector clicked the bubble to get to their
 * events and their commitments, so they are sent straight through to the HQ;
 * everybody else gets the explanation of what the programme is.
 *
 * ## Why this page is dynamic
 *
 * Reading `?as=` costs the static cache the other offering front pages keep.
 * That is not a loss the mock is introducing: the real version of this branch
 * reads the session to find out whether you have a connector record, and a
 * page that reads the session was never going to be cached at the edge
 * anyway. When the fixtures go, `resolveViewerRole` is replaced by that
 * lookup and the shape of this file does not change.
 */

export const metadata = {
  title: 'Pana Connectors | Pana MIA Club',
  description:
    'Community Connectors are the volunteers who keep Pana MIA running — neighborhood pods across Miami-Dade, Broward and Palm Beach.',
};

export default async function ConnectorsFrontPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const role = resolveViewerRole((await searchParams).as);

  if (role !== 'visitor') {
    // The role is carried through so the switch survives the hop. Without it
    // every preview of the HQ would bounce straight back here.
    redirect(`/connectors/hq?as=${role}`);
  }

  return (
    <>
      <ViewerSwitch current="visitor" />
      <OfferingFrontPage
        id="connectors"
        actions={{
          primary: '/form/become-a-pana',
          secondary: '/connectors/hq?as=connector',
        }}
        interlude={<HouseBoard />}
      />
    </>
  );
}

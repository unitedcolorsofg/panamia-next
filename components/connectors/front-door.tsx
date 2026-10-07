import { redirect } from 'next/navigation';

import { HouseBoard } from '@/components/connectors/house-board';
import { ViewerSwitch } from '@/components/connectors/viewer-switch';
import { OfferingFrontPage } from '@/components/offerings/offering-front-page';
import { resolveViewerRole } from '@/lib/connectors/fixtures';

/**
 * The Pana Connectors front door.
 *
 * Lives here rather than in `app/connectors/page.tsx` because two routes need
 * it: that path, and `/` when the request arrives on `connectors.pana.social`.
 * The subdomain's root has to render the same thing its named path does, and
 * the only alternative to sharing a component is keeping two copies of a
 * redirect in step forever.
 *
 * Two audiences arrive at the same door and only one of them wants a pitch.
 * Someone who is already a connector clicked the bubble to get to their events
 * and their commitments, so they are sent straight through to the HQ;
 * everybody else gets the explanation of what the programme is.
 *
 * ## Why this is dynamic
 *
 * Reading `?as=` costs the static cache the other offering front pages keep.
 * That is not a loss the mock is introducing: the real version of this branch
 * reads the session to find out whether you have a connector record, and a
 * page that reads the session was never going to be cached at the edge
 * anyway. When the fixtures go, `resolveViewerRole` is replaced by that lookup
 * and the shape of this file does not change.
 */
export function ConnectorsFrontDoor({ as }: { as?: string }) {
  const role = resolveViewerRole(as);

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
          // "Become a Connector" used to point at `/form/get-listed`, which is
          // the public *business directory* intake. Somebody who read this
          // whole page and decided they wanted in was handed a form about
          // their shop. `/connectors/join` is the programme's own door.
          primary: '/connectors/join',
          secondary: '/connectors/hq?as=connector',
        }}
        interlude={<HouseBoard />}
      />
    </>
  );
}

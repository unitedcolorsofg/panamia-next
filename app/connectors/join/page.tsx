import { ConnectorJoinForm } from '@/components/connectors/join-form';
import { ViewerSwitch } from '@/components/connectors/viewer-switch';

/**
 * Where "Become a Connector" goes.
 *
 * The form is `components/connectors/join-form.tsx`; this file gives it a
 * route, metadata and the surface's viewer switch, so a reviewer who lands
 * here can get back to either state without using the back button.
 *
 * `noindex` while it is a mock. A form that cannot be submitted has no
 * business ranking for "become a community connector miami" — the search
 * result would be a promise the page does not keep.
 */

export const metadata = {
  title: 'Become a Connector | Pana MIA Club',
  description:
    'Join a neighborhood pod across Miami-Dade, Broward or Palm Beach, pick the house that matches what you already like doing, and tell your pod what you can bring.',
  robots: { index: false, follow: false },
};

export default function ConnectorJoinPage() {
  return (
    <>
      <ViewerSwitch current="visitor" />
      <ConnectorJoinForm />
    </>
  );
}

import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { ConnectorJoinForm } from '@/components/connectors/join-form';
import { getMyConnector } from '@/lib/connectors/membership';

/**
 * Where "Become a Connector" goes.
 *
 * The form is `components/connectors/join-form.tsx`; this file gives it a
 * route, metadata, and the session it needs.
 *
 * Joining writes to the signed-in member's own profile, so there is nowhere to
 * put the answers until there is an account to hang them on — hence the
 * redirect to sign in rather than an anonymous form that asks for an email and
 * tries to match it up later.
 *
 * Somebody who has already joined gets the same form with their answers in it.
 * The API treats a second POST as an edit, so this is also the "change my
 * houses" page, and that is one page fewer to keep in step with the first.
 *
 * `noindex`, because it requires a session. A search result that lands every
 * visitor on a sign-in redirect is a worse answer than not ranking at all.
 */

export const metadata = {
  title: 'Become a Connector | Pana MIA Club',
  description:
    'Join a neighborhood pod across Miami-Dade, Broward or Palm Beach, pick the house that matches what you already like doing, and tell your pod what you can bring.',
  robots: { index: false, follow: false },
};

export default async function ConnectorJoinPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin');
  }

  const me = await getMyConnector(session.user.id);

  return (
    <ConnectorJoinForm
      initialPod={me?.membership.pod ?? null}
      initialHouses={me?.membership.houses ?? []}
      initialBring={me?.membership.bring ?? ''}
      isEditing={me !== null}
    />
  );
}

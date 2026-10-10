import type { Metadata } from 'next';
import { SURFACES, hostnameFor } from '@/lib/panaverse/surfaces';
import { DmChatMock } from './_components/dm-chat-mock';
import type { MockSurface } from '../_data/panaverse';

/* Design mock for the Pana Social DM conversation view.
 *
 * /mock/dms put mail and chat side by side and asked which one Pana Social
 * should grow into. That is settled - chat UX on the direct-status substrate,
 * with live delivery - and docs/CHAT-ROADMAP.md records it. This route draws
 * the consequence.
 *
 * It is the next thing that has to exist rather than a nice-to-have. Path A
 * in the roadmap is live delivery, and live delivery is blocked on there
 * being a conversation to deliver into: /updates is four tabs of lists with
 * no thread anywhere, so today a socket would have nowhere to put what it
 * received.
 *
 * The fixtures are picked to put the substrate's awkward parts on screen -
 * the seven-day expiry, the gate's three answers, a federated thread, and a
 * dropped socket - because those are the parts a generic chat UI leaves out
 * and then meets in production.
 *
 * Surfaces come from the same registry the Worker routes hostnames on, so the
 * masthead cannot fly a mark for a surface that does not exist, and reading
 * it server-side keeps `process.env` out of the client bundle.
 *
 * Noindex because it is a fixture route, not a real inbox. */
export const metadata: Metadata = {
  title: 'Messages (mock) | Pana Social',
  robots: { index: false, follow: false },
};

export default function MockDmChatPage() {
  const surfaces: MockSurface[] = SURFACES.map((surface) => ({
    id: surface.id,
    name: surface.name,
    hostname: hostnameFor(surface),
    rootPath: surface.rootPath,
  }));

  return <DmChatMock surfaces={surfaces} />;
}

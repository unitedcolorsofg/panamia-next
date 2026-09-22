import type { Metadata } from 'next';
import { SURFACES, hostnameFor } from '@/lib/panaverse/surfaces';
import { PanaverseMock } from './_components/panaverse-mock';
import type { MockSurface } from '../_data/panaverse';

/* Design mock for the PANAVERSE CHROME — the masthead, the surface switcher,
   and the identity block that have to hold Pana Mia together once Pana Social
   moves to social.panamia.club and a member starts crossing origins mid-session.

   Unlike the other mocks, the surfaces are not a fixture. They are read here,
   on the server, from the same registry `worker/index.ts` routes hostnames on,
   so this page cannot show a surface that does not exist or a hostname that
   does not resolve. Reading it server-side also keeps `process.env` — which
   `getRootDomain()` touches — out of the client bundle.

   Noindex because it is a fixture route: it must not compete with the real
   surfaces in search or appear in the sitemap. */
export const metadata: Metadata = {
  title: 'Panaverse switcher (mock) | Pana Mia',
  robots: { index: false, follow: false },
};

export default function MockPanaversePage() {
  const surfaces: MockSurface[] = SURFACES.map((surface) => ({
    id: surface.id,
    name: surface.name,
    hostname: hostnameFor(surface),
    rootPath: surface.rootPath,
  }));

  return <PanaverseMock surfaces={surfaces} />;
}

import type { Metadata } from 'next';
import { SURFACES, hostnameFor } from '@/lib/panaverse/surfaces';
import { SettingsMock } from './_components/settings-mock';
import type { MockSurface } from '../_data/panaverse';

/* Design mock for ACCOUNT SETTINGS — the live route is /account/user/edit.

   Surfaces are read here, on the server, from the same registry the worker
   routes hostnames on, for the reason /mock/panaverse does it: a settings page
   whose entire argument is "this is one account across every surface" cannot
   be allowed to list a surface that does not exist. It also keeps
   `getRootDomain()`, which touches `process.env`, out of the client bundle.

   Noindex because it is a fixture route: it must not compete with the real
   settings page in search or appear in the sitemap. */
export const metadata: Metadata = {
  title: 'Account settings (mock) | Pana Mia',
  robots: { index: false, follow: false },
};

export default function MockSettingsPage() {
  const surfaces: MockSurface[] = SURFACES.map((surface) => ({
    id: surface.id,
    name: surface.name,
    hostname: hostnameFor(surface),
    rootPath: surface.rootPath,
  }));

  return <SettingsMock surfaces={surfaces} />;
}

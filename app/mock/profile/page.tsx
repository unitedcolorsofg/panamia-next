import type { Metadata } from 'next';
import { ProfileMock } from './_components/profile-mock';

/* Design mock for the PERSONAL profile, which is a Pana Social profile: posts,
   Panas, and groups. Business listings are a separate directory surface with
   its own design — the schema already splits them, since DIRECTORY_ACCOUNT_TYPES
   is ['small_business', 'hybrid'] and 'personal' is excluded from the directory.

   Noindex because it is a fixture route, not a real profile — it must not
   compete with /p/[handle] in search or show up in the sitemap. */
export const metadata: Metadata = {
  title: 'Personal profile (mock) | Pana Mia',
  robots: { index: false, follow: false },
};

export default function MockProfilePage() {
  return <ProfileMock />;
}

import type { Metadata } from 'next';
import { ProfileMock } from './_components/profile-mock';

/* Design mock for the personal profile, shared by the public website and Pana
   Social. Noindex because it is a fixture route, not a real profile — it must
   not compete with /p/[handle] in search or show up in the sitemap. */
export const metadata: Metadata = {
  title: 'Personal profile (mock) | Pana Mia',
  robots: { index: false, follow: false },
};

export default function MockProfilePage() {
  return <ProfileMock />;
}

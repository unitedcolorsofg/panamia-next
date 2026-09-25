import type { Metadata } from 'next';
import { ProfileNextMock } from './_components/profile-next-mock';

/* Revamped personal profile. Sits beside /mock/profile rather than replacing
   it so the two layouts can be opened side by side — the point of the mock is
   the comparison, and deleting the old one removes the evidence.

   Same fixtures as /mock/profile on purpose: identical person, identical
   posts, so any difference on screen is a difference in the design.

   Noindex because it is a fixture route, not a real profile. */
export const metadata: Metadata = {
  title: 'Personal profile — revamp (mock) | Pana Mia',
  robots: { index: false, follow: false },
};

export default function MockProfileNextPage() {
  return <ProfileNextMock />;
}

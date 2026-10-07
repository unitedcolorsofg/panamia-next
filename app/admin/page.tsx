import { AdminHub } from '@/components/Admin/hub';

/**
 * The admin hub at its named path.
 *
 * The page itself is `components/Admin/hub.tsx`, shared with `/` on
 * `admin.pana.social`. This file exists to give it a route and metadata.
 */

export const metadata = {
  title: 'Admin | Pana MIA Club',
  robots: { index: false, follow: false },
};

export default async function AdminHubPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  return <AdminHub as={(await searchParams).as} path="/admin" />;
}

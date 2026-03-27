'use client';

import { useSession } from '@/lib/auth-client';
import PageMeta from '@/components/PageMeta';
import { Card, CardContent } from '@/components/ui/card';
import AdminMenu from '@/components/Admin/AdminHeader';

export default function AdminPodcastsPage() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <PageMeta title="Unauthorized" desc="" />
        <div>
          <h2 className="mb-6 text-3xl font-bold">UNAUTHORIZED</h2>
          <h3 className="text-xl">You must be logged in to view this page.</h3>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <PageMeta title="Podcast Setup | Admin" desc="" />
      <AdminMenu />
      <div>
        <h2 className="mb-6 text-3xl font-bold">Podcasts Page Setup</h2>
        <Card>
          <CardContent className="p-6">
            {/* Placeholder for future podcast setup functionality */}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

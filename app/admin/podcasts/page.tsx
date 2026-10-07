'use client';

import { useSession } from '@/lib/auth-client';
import PageMeta from '@/components/PageMeta';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminPodcastsPage() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <>
        <PageMeta title="Unauthorized" desc="" />
        <div>
          <h2 className="mb-6 text-3xl font-bold">UNAUTHORIZED</h2>
          <h3 className="text-xl">You must be logged in to view this page.</h3>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title="Podcast Setup | Admin" desc="" />
      <div>
        <h2 className="mb-6 text-3xl font-bold">Podcasts Page Setup</h2>
        <Card>
          <CardContent className="p-6">
            {/* Placeholder for future podcast setup functionality */}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

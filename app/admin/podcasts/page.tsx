'use client';

import { useAdminGate } from '@/components/Admin/gate';
import PageMeta from '@/components/PageMeta';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminPodcastsPage() {
  const { gate } = useAdminGate();

  if (gate) return gate;

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

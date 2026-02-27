'use client';

import { useSession } from '@/lib/auth-client';
import PageMeta from '@/components/PageMeta';
import AdminMenu from '@/components/Admin/AdminHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useAdminActiveProfiles,
  AdminProfileInterface,
} from '@/lib/query/admin';
import { Download } from 'lucide-react';

export default function AdminDownloadProfilesPage() {
  const { data: session } = useSession();
  const { data, isLoading, isError } = useAdminActiveProfiles();

  const downloadCSV = (data: any) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Name,Email,Phone,Handle\n' +
      data
        .map(
          (profile: AdminProfileInterface) =>
            `"${profile.name}","${profile.email}","${profile.phone}","${profile.handle}"`
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'allProfiles.csv');
    document.body.appendChild(link);
    link.click();
  };

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
      <PageMeta title="Download Profiles | Admin" desc="" />
      <AdminMenu />
      <div>
        <h2 className="mb-6 text-3xl font-bold">Download Profiles</h2>
        <Card>
          <CardHeader>
            <CardTitle>All Active Profiles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && <p>Loading profiles...</p>}
            {isError && (
              <p className="text-destructive">Error loading profiles</p>
            )}
            {data && (
              <Button onClick={() => downloadCSV(data)}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

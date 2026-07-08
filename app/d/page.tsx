import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DirectorySearchContent } from '@/app/directory/search/_components/search-content';

// Attempt to cache the directory shell at the edge (Workers Cache).
// NOTE: DirectorySearchContent uses useSearchParams(), which forces dynamic
// rendering — vinext may ignore this and keep `no-store`. Harmless if so; verify
// with cf-cache-status after deploy. Search results load client-side regardless.
export const revalidate = 300;

function SearchFallback() {
  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-6">
        <section className="text-center">
          <h1 className="text-4xl font-bold">Pana Mia Directory</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Explore South Florida locals and communities
          </p>
        </section>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function DirectoryPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <DirectorySearchContent />
    </Suspense>
  );
}

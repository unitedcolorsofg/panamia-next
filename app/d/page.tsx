import { Suspense } from 'react';
import { DirectorySearchContent } from '@/app/directory/search/_components/search-content';
import { SearchFallback } from '@/app/directory/search/_components/search-fallback';

// Attempt to cache the directory shell at the edge (Workers Cache).
// NOTE: DirectorySearchContent uses useSearchParams(), which forces dynamic
// rendering — vinext may ignore this and keep `no-store`. Harmless if so; verify
// with cf-cache-status after deploy. Search results load client-side regardless.
export const revalidate = 300;

export default function DirectoryPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <DirectorySearchContent />
    </Suspense>
  );
}

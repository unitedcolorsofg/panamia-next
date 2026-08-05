import { Card, CardContent } from '@/components/ui/card';

/**
 * Suspense fallback shared by both search routes (/directory/search and
 * /directory/search/<term>), so the two render an identical shell while the
 * client component and its query boot.
 */
export function SearchFallback() {
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

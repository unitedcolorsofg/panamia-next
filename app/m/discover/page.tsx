import { MentorFilters } from './_components/filters';

export default async function DiscoverPage() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="mb-8 text-3xl font-bold">Discover Mentors</h1>
          <p className="text-muted-foreground mt-2">
            Find mentors who can help you grow in your journey
          </p>
        </div>

        <MentorFilters />
      </div>
    </main>
  );
}

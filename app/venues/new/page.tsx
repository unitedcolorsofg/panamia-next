import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';

export const metadata = { title: 'Submit Venue | Panamia Club' };

export default async function NewVenuePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  if (!session.user.panaVerified) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Verification Required</h1>
        <p className="text-muted-foreground mt-4">
          You must be a verified Pana to submit a venue.{' '}
          <Link href="/form/become-a-pana" className="text-primary underline">
            Apply to become a Pana
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/venues"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Back to Venues
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Submit a Venue</h1>
      <p className="text-muted-foreground mt-2">
        Venues require admin approval before use. We verify safety and
        accessibility.
      </p>
      <div className="mt-6 rounded-lg border p-6">
        <p className="text-muted-foreground">
          Venue submission form coming soon. Use{' '}
          <code className="bg-muted rounded px-1 text-sm">
            POST /api/venues
          </code>{' '}
          directly.
        </p>
      </div>
    </div>
  );
}

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { events, eventOrganizers, profiles } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PhotoApprovalPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const event = await db.query.events.findFirst({
    where: eq(events.slug, slug),
  });
  if (!event) notFound();

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
  });
  const org = profile
    ? await db.query.eventOrganizers.findFirst({
        where: and(
          eq(eventOrganizers.eventId, event.id),
          eq(eventOrganizers.profileId, profile.id)
        ),
      })
    : null;

  if (!org && !session.user.isAdmin) redirect(`/e/${slug}/manage`);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/e/${slug}/manage`}
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Back to Manage
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Photo Approval</h1>
      <p className="text-muted-foreground mt-1">
        Approve photos via{' '}
        <code className="bg-muted rounded px-1 text-sm">
          PATCH /api/events/{slug}/photos/[photoId]
        </code>
        .
      </p>
    </div>
  );
}

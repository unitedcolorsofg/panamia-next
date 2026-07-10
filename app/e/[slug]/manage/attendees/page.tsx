import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { events, profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { ArrowLeft } from 'lucide-react';
import AttendeeList from '@/components/events/AttendeeList';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ManageAttendeesPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/e/${slug}/manage/attendees`);
  }

  const [event, profile] = await Promise.all([
    db.query.events.findFirst({
      where: eq(events.slug, slug),
      columns: { id: true, title: true, slug: true, hostProfileId: true },
    }),
    db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
      columns: { id: true },
    }),
  ]);
  if (!event) notFound();
  if (!profile || profile.id !== event.hostProfileId) notFound();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/e/${event.slug}/manage`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Manage
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Attendees · {event.title}</h1>
      <AttendeeList slug={event.slug} />
    </main>
  );
}

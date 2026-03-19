import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { events, eventPhotos } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const event = await db.query.events.findFirst({
    where: eq(events.slug, slug),
    columns: { title: true },
  });
  return {
    title: event ? `Photos · ${event.title} | Panamia Club` : 'Event Photos',
  };
}

export default async function EventPhotosPage({ params }: PageProps) {
  const { slug } = await params;

  const event = await db.query.events.findFirst({
    where: eq(events.slug, slug),
    columns: {
      id: true,
      title: true,
      status: true,
      visibility: true,
      photoPolicy: true,
    },
  });

  if (!event || event.status !== 'published') notFound();

  const photos = await db.query.eventPhotos.findMany({
    where: and(
      eq(eventPhotos.eventId, event.id),
      eq(eventPhotos.approved, true)
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    columns: { id: true, url: true, caption: true },
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/e/${slug}`}
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Back to Event
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{event.title} — Photos</h1>

      {photos.length === 0 ? (
        <p className="text-muted-foreground mt-8 text-center">No photos yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group bg-muted relative aspect-square overflow-hidden rounded-lg"
            >
              <img
                src={photo.url}
                alt={photo.caption || ''}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              {photo.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {photo.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

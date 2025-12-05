import type { Metadata } from 'next';
import Link from 'next/link';
import { Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'PanaVizión - Pana MIA Podcast',
  description:
    'Youtube links to our most recent PanaVizión podcast videos, where we meet with SoFlo locals and discuss art, business and community.',
};

interface VideoEmbedProps {
  videoId: string;
  title: string;
}

function VideoEmbed({ videoId, title }: VideoEmbedProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="aspect-video">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${videoId}`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            className="h-full w-full"
          />
        </div>
        <div className="p-4">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PodcastsPage() {
  const videos = [
    {
      id: 'IX2z1-_KEJw',
      title: 'Panavizión ft. Julie from Easy Peasy Tattoos & Alexx in Chainss',
    },
    {
      id: 'u4Ehz-Jx7Uo',
      title: 'PanaVizión S1E4: Witches of Miami, Bozito, and Vanessa McCoy',
    },
    {
      id: 'QFtX-UczYb0',
      title:
        'PanaVizión Interviews Kat from Earth Pallas and Paco from Folktale San Pedro',
    },
    {
      id: 'Z9nYArpmfpI',
      title:
        'PanaVizión Interviews Sarah from Dear Eleanor and Enrique from Stillblue',
    },
    {
      id: '2fmVE_d9L_k',
      title: 'PanaVizión Interviews Chill Otter Co and Golden Flora',
    },
    {
      id: 'gTzHxujUxnc',
      title: "Punto De Encuentro: Pana MIA Club's First Official Meet Up",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <h1 className="text-4xl font-bold text-pana-pink md:text-5xl">
              Pana MIA Club Podcasts
            </h1>
            <p className="text-xl text-muted-foreground">
              Meet with SoFlo locals and discuss art, business, and community
            </p>
          </div>
        </div>
      </section>

      {/* Videos Section */}
      <section className="pb-16 md:pb-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl space-y-8">
            <h2 className="text-center text-2xl font-bold md:text-3xl">
              Most Recent Videos
            </h2>

            <div className="space-y-8">
              {videos.map((video) => (
                <VideoEmbed
                  key={video.id}
                  videoId={video.id}
                  title={video.title}
                />
              ))}
            </div>

            {/* YouTube Channel Link */}
            <div className="flex justify-center pt-8">
              <Button
                size="lg"
                className="bg-red-600 px-8 py-6 text-lg text-white hover:bg-red-700"
                asChild
              >
                <Link
                  href="https://www.youtube.com/@panavizion305"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  Our Full Youtube Channel
                  <Youtube className="h-6 w-6" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

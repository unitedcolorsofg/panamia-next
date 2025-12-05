import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Twitter,
  Instagram,
  Music,
  Mail,
  Search,
  UserPlus,
  Calendar,
  Heart,
  Youtube,
  Users,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Links - Pana MIA Club',
  description:
    'Connect with Pana MIA Club on social media and explore our directory of local South Florida businesses.',
};

export default function LinksPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-2xl px-4 py-12">
        {/* Logo and Header */}
        <div className="mb-8 text-center">
          <div className="mb-6 flex justify-center">
            <Image
              src="/img/home/logoPanaMIA2.png"
              alt="Pana MIA Club Logo"
              width={200}
              height={100}
              className="h-auto w-48"
              priority
            />
          </div>
          <h1 className="mb-2 text-3xl font-bold">Pana MIA Club</h1>
          <p className="text-lg text-muted-foreground">The Future is Local</p>
        </div>

        {/* Social Media Icons */}
        <div className="mb-8 flex justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            asChild
          >
            <Link
              href="https://twitter.com/panamiaclub"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on Twitter"
            >
              <Twitter className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            asChild
          >
            <Link
              href="https://www.instagram.com/panamiaclub/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on Instagram"
            >
              <Instagram className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            asChild
          >
            <Link
              href="https://www.tiktok.com/@panamiaclub"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow us on TikTok"
            >
              <Music className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full"
            asChild
          >
            <Link href="mailto:info@panamia.club" aria-label="Email us">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {/* Main Links */}
        <div className="space-y-4">
          <Button size="lg" className="h-14 w-full text-lg" asChild>
            <Link
              href="/directory/search"
              className="flex items-center justify-center gap-2"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
              Explore Our Directory
            </Link>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-14 w-full text-lg"
            asChild
          >
            <Link
              href="/form/become-a-pana"
              className="flex items-center justify-center gap-2"
            >
              <UserPlus className="h-5 w-5" aria-hidden="true" />
              Become A Pana
            </Link>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-14 w-full text-lg"
            asChild
          >
            <Link
              href="https://shotgun.live/venues/pana-mia-club"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              <Calendar className="h-5 w-5" aria-hidden="true" />
              Our Events
            </Link>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-14 w-full text-lg"
            asChild
          >
            <Link
              href="/donate"
              className="flex items-center justify-center gap-2"
            >
              <Heart className="h-5 w-5" aria-hidden="true" />
              Support Our Mission
            </Link>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-14 w-full text-lg"
            asChild
          >
            <Link
              href="https://forms.gle/BFw91iYLj4yVjQZn6"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              <Users className="h-5 w-5" aria-hidden="true" />
              Volunteer With Us
            </Link>
          </Button>
        </div>

        {/* YouTube Playlist */}
        <Card className="mt-8 overflow-hidden">
          <CardContent className="p-0">
            <div className="aspect-video">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/videoseries?list=PLzL8p8P4v6F03_6C9S_SthYiI6W96YJLY"
                title="Pana MIA YouTube Playlist"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                className="h-full w-full"
              />
            </div>
            <div className="p-4 text-center">
              <h2 className="text-lg font-semibold">Watch Our Latest Videos</h2>
            </div>
          </CardContent>
        </Card>

        {/* Spotify Playlist */}
        <div className="mt-6 text-center">
          <Button
            size="lg"
            className="bg-green-600 text-lg hover:bg-green-700"
            asChild
          >
            <Link
              href="https://open.spotify.com/user/ij9xugbz4bgqlllbmyjmkuzre?si=c1fb6e2bd9aa4a1b"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              <Music className="h-5 w-5" aria-hidden="true" />
              Listen on Spotify
            </Link>
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Pana MIA Club</p>
          <p className="mt-1">South Florida&apos;s Local Community Network</p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ExternalLink,
  Instagram,
  Facebook,
  Music,
  Twitter,
} from 'lucide-react';

interface ProfileSocialsProps {
  socials: {
    website?: string;
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    twitter?: string;
    spotify?: string;
  };
}

function urlWithSource(url: string) {
  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }
  try {
    const newUrl = new URL(url);
    newUrl.searchParams.set('utm_source', 'panamia');
    return newUrl.toString();
  } catch {
    return url;
  }
}

export function ProfileSocials({ socials }: ProfileSocialsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Socials and Links</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {socials.website && (
            <Button variant="outline" asChild>
              <a
                href={urlWithSource(socials.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Website
              </a>
            </Button>
          )}

          {socials.instagram && (
            <Button variant="outline" asChild>
              <a
                href={urlWithSource(socials.instagram)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Instagram className="h-4 w-4" aria-hidden="true" />
                Instagram
              </a>
            </Button>
          )}

          {socials.facebook && (
            <Button variant="outline" asChild>
              <a
                href={urlWithSource(socials.facebook)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Facebook className="h-4 w-4" aria-hidden="true" />
                Facebook
              </a>
            </Button>
          )}

          {socials.tiktok && (
            <Button variant="outline" asChild>
              <a
                href={urlWithSource(socials.tiktok)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Music className="h-4 w-4" aria-hidden="true" />
                TikTok
              </a>
            </Button>
          )}

          {socials.twitter && (
            <Button variant="outline" asChild>
              <a
                href={urlWithSource(socials.twitter)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Twitter className="h-4 w-4" aria-hidden="true" />
                Twitter
              </a>
            </Button>
          )}

          {socials.spotify && (
            <Button variant="outline" asChild>
              <a
                href={urlWithSource(socials.spotify)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Music className="h-4 w-4" aria-hidden="true" />
                Spotify
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

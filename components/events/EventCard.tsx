'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, MapPin, Users, Globe } from 'lucide-react';

interface EventCardProps {
  slug: string;
  title: string;
  description?: string | null;
  coverImage?: string | null;
  coverImageAlt?: string | null;
  startsAt: string;
  timezone?: string | null;
  mode: 'online' | 'offline' | 'hybrid';
  attendeeCount?: number;
  attendeeCap?: number | null;
  venue?: {
    name?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
}

export default function EventCard({
  slug,
  title,
  description,
  coverImage,
  coverImageAlt,
  startsAt,
  timezone,
  mode,
  attendeeCount = 0,
  attendeeCap,
  venue,
}: EventCardProps) {
  const when = new Date(startsAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone || undefined,
  });

  return (
    <Link href={`/e/${slug}`}>
      <Card className="group h-full overflow-hidden transition-shadow hover:shadow-lg">
        {coverImage && (
          <div className="relative aspect-video overflow-hidden">
            <Image
              src={coverImage}
              alt={coverImageAlt || title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
        <CardContent className={coverImage ? 'pt-4' : 'pt-6'}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs capitalize">
              {mode}
            </Badge>
          </div>
          <h3 className="mb-2 line-clamp-2 text-lg font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {title}
          </h3>
          {description && (
            <p className="mb-3 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
          <div className="space-y-1 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{when}</span>
            </div>
            {mode === 'online' ? (
              <div className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Online</span>
              </div>
            ) : (
              venue && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {venue.name}
                    {venue.city ? ` · ${venue.city}, ${venue.state}` : ''}
                  </span>
                </div>
              )
            )}
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {attendeeCount} going
                {attendeeCap ? ` · ${attendeeCap} cap` : ''}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, User } from 'lucide-react';
import Link from 'next/link';
import { SearchResultsInterface } from '@/lib/query/directory';

interface SearchResultCardProps {
  profile: SearchResultsInterface;
  distance?: number;
  isMentor?: boolean;
}

function detailLimit(details: string) {
  if (details?.length > 200) {
    return `${details.substring(0, 197)}...`;
  }
  return details;
}

export function SearchResultCard({
  profile,
  distance,
  isMentor,
}: SearchResultCardProps) {
  const primaryImage = profile.images?.primaryCDN || '/img/bg_coconut_blue.jpg';

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col md:flex-row">
        {/* Profile Image */}
        <div className="relative h-48 w-full md:h-auto md:w-48">
          <img
            src={primaryImage}
            alt={profile.name as string}
            className="h-full w-full object-cover"
          />
          {isMentor && (
            <Badge className="absolute top-2 right-2 bg-blue-600 text-white">
              Mentor
            </Badge>
          )}
        </div>

        {/* Profile Content */}
        <CardContent className="flex flex-1 flex-col gap-3 p-6">
          {/* Name */}
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold">{profile.name}</h3>
          </div>

          {/* Five Words */}
          {profile.five_words && (
            <Badge variant="secondary" className="w-fit">
              {profile.five_words}
            </Badge>
          )}

          {/* Location */}
          {profile.primary_address?.city && (
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="h-4 w-4" />
              <span>{profile.primary_address.city}</span>
              {distance && distance > 0 && (
                <span className="text-xs">
                  &nbsp;({distance.toFixed(2)} miles away)
                </span>
              )}
            </div>
          )}

          {/* Details */}
          {profile.details && (
            <p className="text-gray-700 dark:text-gray-300">
              {detailLimit(profile.details as string)}
            </p>
          )}

          {/* Actions */}
          <div className="mt-auto flex flex-wrap gap-2">
            <Button variant="default" asChild>
              <Link href={`/profile/${profile.slug}`}>
                <User className="h-4 w-4" />
                View Profile
              </Link>
            </Button>
            {/* TODO: Add social follow/unfollow buttons per docs/SOCIAL-ROADMAP.md Phase 4 */}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FollowButton } from './FollowButton';
import { SocialActorDisplay } from '@/lib/interfaces';

interface ActorCardProps {
  actor: SocialActorDisplay;
  isFollowing?: boolean;
  isSelf?: boolean;
  showFollowButton?: boolean;
  showStats?: boolean;
}

export function ActorCard({
  actor,
  isFollowing = false,
  isSelf = false,
  showFollowButton = true,
  showStats = true,
}: ActorCardProps) {
  const actorInitials = actor.name
    ? actor.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : actor.username.slice(0, 2).toUpperCase();

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <Link href={`/profile/${actor.username}`}>
            <Avatar className="h-12 w-12">
              <AvatarImage src={actor.iconUrl || undefined} />
              <AvatarFallback>{actorInitials}</AvatarFallback>
            </Avatar>
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/profile/${actor.username}`}
                  className="block truncate font-semibold hover:underline"
                >
                  {actor.name || actor.username}
                </Link>
                <Link
                  href={`/profile/${actor.username}`}
                  className="text-muted-foreground block truncate text-sm"
                >
                  @{actor.username}
                </Link>
              </div>

              {showFollowButton && !isSelf && (
                <FollowButton
                  username={actor.username}
                  isFollowing={isFollowing}
                />
              )}
            </div>

            {actor.summary && (
              <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                {actor.summary}
              </p>
            )}

            {showStats && (
              <div className="text-muted-foreground mt-2 flex items-center gap-4 text-sm">
                <Link
                  href={`/profile/${actor.username}?tab=following`}
                  className="hover:underline"
                >
                  <span className="text-foreground font-semibold">
                    {actor.followingCount}
                  </span>{' '}
                  Following
                </Link>
                <Link
                  href={`/profile/${actor.username}?tab=followers`}
                  className="hover:underline"
                >
                  <span className="text-foreground font-semibold">
                    {actor.followersCount}
                  </span>{' '}
                  Followers
                </Link>
                <span>
                  <span className="text-foreground font-semibold">
                    {actor.statusCount}
                  </span>{' '}
                  Posts
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

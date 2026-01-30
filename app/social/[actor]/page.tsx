'use client';

import { use, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PostList, FollowButton, ActorCard } from '@/components/social';
import { useActor, useActorPosts, useFollows } from '@/lib/query/social';
import { Loader2, FileText, Users, UserPlus } from 'lucide-react';

const VALID_TABS = ['posts', 'followers', 'following'] as const;

export default function ActorProfilePage({
  params,
}: {
  params: Promise<{ actor: string }>;
}) {
  const { actor: username } = use(params);
  const searchParams = useSearchParams();

  const tabFromUrl = useMemo(() => {
    const tab = searchParams?.get('tab');
    return tab && VALID_TABS.includes(tab as (typeof VALID_TABS)[number])
      ? tab
      : null;
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState(tabFromUrl || 'posts');

  const { data: actorData, isLoading: actorLoading } = useActor(username);
  const { data: postsData, isLoading: postsLoading } = useActorPosts(username);
  const { data: followingData } = useFollows('following');
  const { data: followersData } = useFollows('followers');

  if (actorLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto flex max-w-2xl justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  if (!actorData?.actor) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-2 text-2xl font-bold">User not found</h1>
          <p className="text-muted-foreground">
            The user @{username} doesn&apos;t exist or hasn&apos;t enabled
            social features.
          </p>
        </div>
      </div>
    );
  }

  const actor = actorData.actor;
  const actorInitials = actor.name
    ? actor.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : actor.username.slice(0, 2).toUpperCase();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={actor.iconUrl || undefined} />
                <AvatarFallback className="text-2xl">
                  {actorInitials}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-bold">
                      {actor.name || actor.username}
                    </h1>
                    <p className="text-muted-foreground">@{actor.username}</p>
                  </div>

                  {!actorData.isSelf && (
                    <FollowButton
                      username={actor.username}
                      isFollowing={actorData.isFollowing}
                      size="default"
                    />
                  )}
                </div>

                {actor.summary && (
                  <p className="mt-3 text-sm">{actor.summary}</p>
                )}

                <div className="mt-4 flex items-center gap-6 text-sm">
                  <button
                    onClick={() => setActiveTab('posts')}
                    className="hover:underline"
                  >
                    <span className="font-semibold">{actor.statusCount}</span>{' '}
                    <span className="text-muted-foreground">Posts</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('following')}
                    className="hover:underline"
                  >
                    <span className="font-semibold">
                      {actor.followingCount}
                    </span>{' '}
                    <span className="text-muted-foreground">Following</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('followers')}
                    className="hover:underline"
                  >
                    <span className="font-semibold">
                      {actor.followersCount}
                    </span>{' '}
                    <span className="text-muted-foreground">Followers</span>
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="following" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Following
            </TabsTrigger>
            <TabsTrigger value="followers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Followers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4">
            <PostList
              statuses={postsData?.statuses || []}
              isLoading={postsLoading}
              hasMore={!!postsData?.nextCursor}
              emptyMessage={`@${username} hasn't posted anything yet.`}
            />
          </TabsContent>

          <TabsContent value="following" className="mt-4">
            {actorData.isSelf ? (
              <ActorList
                actors={followingData?.actors || []}
                type="following"
              />
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                Following list is only visible to the account owner.
              </div>
            )}
          </TabsContent>

          <TabsContent value="followers" className="mt-4">
            {actorData.isSelf ? (
              <ActorList
                actors={followersData?.actors || []}
                type="followers"
              />
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                Followers list is only visible to the account owner.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ActorList({
  actors,
  type,
}: {
  actors: Array<{
    id: string;
    username: string;
    domain: string;
    name?: string | null;
    iconUrl?: string | null;
  }>;
  type: 'following' | 'followers';
}) {
  if (actors.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        {type === 'following'
          ? "You're not following anyone yet."
          : "You don't have any followers yet."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actors.map((actor) => (
        <ActorCard
          key={actor.id}
          actor={{
            ...actor,
            summary: null,
            followingCount: 0,
            followersCount: 0,
            statusCount: 0,
          }}
          showStats={false}
        />
      ))}
    </div>
  );
}

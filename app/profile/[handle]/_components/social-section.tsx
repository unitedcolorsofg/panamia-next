'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostList, FollowButton, ActorCard } from '@/components/social';
import { useActor, useActorPosts, useFollows } from '@/lib/query/social';
import { Loader2, FileText, Users, UserPlus } from 'lucide-react';

const VALID_TABS = ['posts', 'followers', 'following'] as const;

export function SocialSection({ handle }: { handle: string }) {
  const { status: authStatus } = useSession();
  const isAuthenticated = authStatus === 'authenticated';
  const searchParams = useSearchParams();

  const tabFromUrl = useMemo(() => {
    const tab = searchParams?.get('tab');
    return tab && VALID_TABS.includes(tab as (typeof VALID_TABS)[number])
      ? tab
      : null;
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState(tabFromUrl || 'posts');

  const { data: actorData, isLoading: actorLoading } = useActor(handle);
  const { data: postsData, isLoading: postsLoading } = useActorPosts(handle);
  const { data: followingData } = useFollows('following');
  const { data: followersData } = useFollows('followers');

  // Don't render anything if still loading or no actor
  if (actorLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!actorData?.actor) {
    return null;
  }

  const actor = actorData.actor;

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Social stats and follow button */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <button
              onClick={() => setActiveTab('posts')}
              className="hover:underline"
            >
              <span className="font-semibold">{actor.statusCount}</span>{' '}
              <span className="text-muted-foreground">Posts</span>
            </button>
            {isAuthenticated && (
              <>
                <button
                  onClick={() => setActiveTab('following')}
                  className="hover:underline"
                >
                  <span className="font-semibold">{actor.followingCount}</span>{' '}
                  <span className="text-muted-foreground">Following</span>
                </button>
                <button
                  onClick={() => setActiveTab('followers')}
                  className="hover:underline"
                >
                  <span className="font-semibold">{actor.followersCount}</span>{' '}
                  <span className="text-muted-foreground">Followers</span>
                </button>
              </>
            )}
          </div>

          {!actorData.isSelf && isAuthenticated && (
            <FollowButton
              username={actor.username}
              isFollowing={actorData.isFollowing}
              size="sm"
            />
          )}
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            className={`grid w-full ${isAuthenticated ? 'grid-cols-3' : 'grid-cols-1'}`}
          >
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Posts
            </TabsTrigger>
            {isAuthenticated && (
              <>
                <TabsTrigger
                  value="following"
                  className="flex items-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Following
                </TabsTrigger>
                <TabsTrigger
                  value="followers"
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Followers
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="posts" className="mt-4">
            <PostList
              statuses={postsData?.statuses || []}
              isLoading={postsLoading}
              hasMore={!!postsData?.nextCursor}
              emptyMessage={`@${handle} hasn't posted anything yet.`}
            />
          </TabsContent>

          {isAuthenticated && (
            <>
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
            </>
          )}
        </Tabs>
      </CardContent>
    </Card>
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

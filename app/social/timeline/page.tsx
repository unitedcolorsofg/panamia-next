'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PostComposer,
  PostList,
  SocialEligibilityGate,
} from '@/components/social';
import { useTimeline, usePublicTimeline, useMyActor } from '@/lib/query/social';
import { Home, Globe } from 'lucide-react';

export default function TimelinePage() {
  const { status } = useSession();
  const [activeTab, setActiveTab] = useState<'home' | 'public'>('home');

  // Redirect to signin if not authenticated
  if (status === 'unauthenticated') {
    redirect('/signin');
  }

  // Show loading while checking auth
  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-8 w-48 rounded" />
            <div className="bg-muted h-32 rounded" />
            <div className="bg-muted h-24 rounded" />
            <div className="bg-muted h-24 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold">Timeline</h1>

        <SocialEligibilityGate>
          <TimelineContent activeTab={activeTab} setActiveTab={setActiveTab} />
        </SocialEligibilityGate>
      </div>
    </div>
  );
}

function TimelineContent({
  activeTab,
  setActiveTab,
}: {
  activeTab: 'home' | 'public';
  setActiveTab: (tab: 'home' | 'public') => void;
}) {
  const { data: myActor } = useMyActor();
  const homeTimeline = useTimeline();
  const publicTimeline = usePublicTimeline();

  const currentTimeline = activeTab === 'home' ? homeTimeline : publicTimeline;
  const statuses = currentTimeline.data?.statuses || [];
  const hasMore = !!currentTimeline.data?.nextCursor;

  return (
    <div className="space-y-6">
      {/* Composer */}
      {myActor?.actor && (
        <Card>
          <CardContent className="pt-4">
            <PostComposer />
          </CardContent>
        </Card>
      )}

      {/* Timeline Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'home' | 'public')}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="home" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Home
          </TabsTrigger>
          <TabsTrigger value="public" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Public
          </TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="mt-4">
          <PostList
            statuses={statuses}
            isLoading={homeTimeline.isLoading}
            hasMore={hasMore}
            emptyMessage="Follow some people to see their posts here!"
          />
        </TabsContent>

        <TabsContent value="public" className="mt-4">
          <PostList
            statuses={statuses}
            isLoading={publicTimeline.isLoading}
            hasMore={hasMore}
            emptyMessage="No public posts yet. Be the first!"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Loader2, Lock, Pencil } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import {
  useActor,
  useActorPosts,
  usePanas,
  useProfileGroups,
} from '@/lib/query/social';
import {
  PostList,
  FollowButton,
  SendVoiceMemoButton,
} from '@/components/social';
import { Button } from '@/components/ui/button';
import type { PersonalProfileView } from '@/lib/server/personal-profile';
import { PersonalHero } from './personal-hero';
import { PERSONAL_TAB_ICONS, PersonalTabs } from './personal-tabs';
import { PanaCard, GroupCard } from './personal-cards';
import type { PersonalTab, StatDef, TabDef } from './types';

/* Reading order for the body, which is not the stat rail's order — posts lead
   here because that is what people come to a profile for, while the rail
   leads with the figure the profile is proudest of. */
const TAB_ORDER: PersonalTab[] = ['posts', 'panas', 'groups'];

/* The personal (Pana Social) profile.
 *
 * Identity comes in as props because the page around this is edge-cached and
 * must stay session-free on the server. Everything social is fetched here on
 * the client instead, which is also what lets the Panas list vary by viewer
 * without splitting the cache. */
export function PersonalProfile({
  profile,
}: {
  profile: PersonalProfileView;
}) {
  const [activeTab, setActiveTab] = useState<PersonalTab>('posts');
  const { status: authStatus } = useSession();
  const isAuthenticated = authStatus === 'authenticated';

  const handle = profile.handle;
  const { data: actorData } = useActor(handle);
  const { data: postsData, isLoading: postsLoading } = useActorPosts(handle);
  const { data: panasData, isLoading: panasLoading } = usePanas(handle);
  const { data: groupsData, isLoading: groupsLoading } =
    useProfileGroups(handle);

  const actor = actorData?.actor;
  const isSelf = Boolean(actorData?.isSelf);

  /* Rail order leads with Panas; the tab bar below leads with Posts. Both read
     from this one list so the two controls can never disagree about a count. */
  const stats: StatDef[] = [
    { tab: 'panas', label: 'Panas', value: panasData?.count ?? null },
    { tab: 'posts', label: 'Posts', value: actor?.statusCount ?? null },
    { tab: 'groups', label: 'Groups', value: groupsData?.groups.length ?? null },
  ];

  const tabs: TabDef[] = TAB_ORDER.map((id) => {
    const stat = stats.find((entry) => entry.tab === id);
    if (!stat) {
      throw new Error(`Personal profile is missing a stat for "${id}".`);
    }
    return {
      id,
      label: stat.label,
      icon: PERSONAL_TAB_ICONS[id],
      count: stat.value,
    };
  });

  const actions = renderActions({
    isSelf,
    isAuthenticated,
    actor,
    isFollowing: Boolean(actorData?.isFollowing),
  });

  return (
    <main className="surface-cream min-h-screen pb-20">
      <PersonalHero
        profile={profile}
        stats={stats}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        actions={actions}
        mobileActions={actions}
      />

      <div className="container mx-auto max-w-4xl px-4">
        <div className="mt-8">
          <PersonalTabs
            tabs={tabs}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
          />
        </div>

        <div className="mt-6">
          {activeTab === 'posts' && (
            <Panel id="posts">
              <PostList
                statuses={postsData?.statuses || []}
                isLoading={postsLoading}
                hasMore={!!postsData?.nextCursor}
                emptyMessage={`@${handle} hasn't posted anything yet.`}
              />
            </Panel>
          )}

          {activeTab === 'panas' && (
            <Panel id="panas">
              <PanelIntro
                title="Panas"
                lede="A Pana is a mutual follow — both people followed each other. Everyone listed here follows this Pana back."
              />
              <PanasPanel
                data={panasData}
                isLoading={panasLoading}
                name={profile.name}
                handle={handle}
              />
            </Panel>
          )}

          {activeTab === 'groups' && (
            <Panel id="groups">
              <PanelIntro
                title="Groups"
                lede="Communities inside Pana Social. Only groups anyone can find are listed — private groups stay private."
              />
              <GroupsPanel
                groups={groupsData?.groups ?? []}
                isLoading={groupsLoading}
                name={profile.name}
              />
            </Panel>
          )}
        </div>
      </div>
    </main>
  );
}

function renderActions({
  isSelf,
  isAuthenticated,
  actor,
  isFollowing,
}: {
  isSelf: boolean;
  isAuthenticated: boolean;
  isFollowing: boolean;
  actor?: {
    id: string;
    username: string;
    name?: string | null;
    iconUrl?: string | null;
    uri?: string | null;
  };
}): ReactNode {
  if (isSelf) {
    return (
      <Button
        asChild
        variant="outline"
        className="border-pana-ink/20 rounded-full font-extrabold"
      >
        <Link href="/account/profile/edit">
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit profile
        </Link>
      </Button>
    );
  }

  if (!isAuthenticated || !actor?.uri) return null;

  return (
    <>
      <SendVoiceMemoButton
        recipient={{
          id: actor.id,
          username: actor.username,
          displayName: actor.name || actor.username,
          avatarUrl: actor.iconUrl || undefined,
          uri: actor.uri,
        }}
        size="sm"
      />
      <FollowButton
        username={actor.username}
        isFollowing={isFollowing}
        size="sm"
      />
    </>
  );
}

/* Signed-out viewers get the count from the hero but not the list. The empty
   state says which of the two it is, because "no Panas yet" and "you can't see
   them" look identical otherwise and only one is worth signing in over. */
function PanasPanel({
  data,
  isLoading,
  name,
  handle,
}: {
  data?: { count: number; canSeeList: boolean; actors: unknown[] };
  isLoading: boolean;
  name: string;
  handle: string;
}) {
  if (isLoading) return <PanelLoading />;

  if (data && !data.canSeeList) {
    return (
      <EmptyState icon={Lock}>
        {data.count > 0 ? (
          <>
            <Link
              href={`/signin?callbackUrl=/p/${encodeURIComponent(handle)}`}
              className="text-pana-indigo underline"
            >
              Sign in
            </Link>{' '}
            to see who {firstName(name)} is Panas with.
          </>
        ) : (
          <>{firstName(name)} has no Panas yet.</>
        )}
      </EmptyState>
    );
  }

  const panas = (data?.actors ?? []) as Parameters<
    typeof PanaCard
  >[0]['pana'][];

  if (panas.length === 0) {
    return <EmptyState>{firstName(name)} has no Panas yet.</EmptyState>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {panas.map((pana) => (
        <PanaCard key={pana.id} pana={pana} />
      ))}
    </div>
  );
}

function GroupsPanel({
  groups,
  isLoading,
  name,
}: {
  groups: Parameters<typeof GroupCard>[0]['group'][];
  isLoading: boolean;
  name: string;
}) {
  if (isLoading) return <PanelLoading />;

  if (groups.length === 0) {
    return (
      <EmptyState>{firstName(name)} isn&apos;t in any public groups.</EmptyState>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <GroupCard key={group.groupId} group={group} />
      ))}
    </div>
  );
}

function firstName(name: string): string {
  return name.split(' ')[0] || name;
}

function Panel({ id, children }: { id: PersonalTab; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`profile-panel-${id}`}
      aria-labelledby={`profile-tab-${id}`}
    >
      {children}
    </div>
  );
}

function PanelIntro({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-black tracking-tight">{title}</h2>
      <p className="text-pana-ink/60 mt-1 max-w-2xl text-[13px] leading-snug font-medium">
        {lede}
      </p>
    </div>
  );
}

function PanelLoading() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 className="text-pana-ink/40 h-6 w-6 animate-spin" />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  children,
}: {
  icon?: typeof Lock;
  children: ReactNode;
}) {
  return (
    <div className="border-pana-ink/10 text-pana-ink/60 rounded-2xl border border-dashed py-12 text-center text-sm font-bold">
      {Icon && (
        <Icon className="mx-auto mb-3 h-5 w-5 opacity-60" aria-hidden="true" />
      )}
      {children}
    </div>
  );
}

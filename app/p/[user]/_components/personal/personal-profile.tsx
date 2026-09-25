'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, Lock, Pencil } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import {
  useActor,
  useActorPosts,
  usePanas,
  useProfileEvents,
  useProfileGroups,
} from '@/lib/query/social';
import type {
  ProfileEventSummary,
  ProfileGroupSummary,
} from '@/lib/query/social';
import {
  PostList,
  FollowButton,
  SendVoiceMemoButton,
} from '@/components/social';
import { Button } from '@/components/ui/button';
import { isUnoptimizableImageSrc } from '@/lib/image-src';
import type { PersonalProfileView } from '@/lib/server/personal-profile';
import { IdentityRail } from './identity-rail';
import { PERSONAL_TAB_ICONS, PersonalTabs } from './personal-tabs';
import { PanaCard } from './personal-cards';
import { EventCard, GroupRow } from './personal-content-cards';
import type { PersonalTab, StatDef, TabDef } from './types';

/* The personal (Pana Social) profile.
 *
 * Two columns, inverting the feed's: identity on the left and stays put, work
 * on the right and scrolls. The old layout stacked them, which meant the top
 * third of every screen re-answered "who is this" while the answer to "what
 * have they been up to" started below the fold.
 *
 * Identity comes in as props because the page around this is edge-cached and
 * must stay session-free on the server. Everything social is fetched here on
 * the client instead, which is also what lets Panas and RSVPs vary by viewer
 * without splitting the cache. */
export function PersonalProfile({ profile }: { profile: PersonalProfileView }) {
  const [activeTab, setActiveTab] = useState<PersonalTab>('posts');
  const { status: authStatus } = useSession();
  const isAuthenticated = authStatus === 'authenticated';

  const handle = profile.handle;
  const { data: actorData } = useActor(handle);
  const { data: postsData, isLoading: postsLoading } = useActorPosts(handle);
  const { data: panasData, isLoading: panasLoading } = usePanas(handle);
  const { data: eventsData, isLoading: eventsLoading } =
    useProfileEvents(handle);
  const { data: groupsData, isLoading: groupsLoading } =
    useProfileGroups(handle);

  const actor = actorData?.actor;
  const isSelf = Boolean(actorData?.isSelf);

  const events = eventsData?.events ?? [];
  const groups = groupsData?.groups ?? [];

  /* Upcoming only. A count that included last year's shows would describe a
     history rather than a calendar, and it sits beside "Posts", which is
     unambiguously a running total. */
  const upcomingCount = events.filter(
    (event) => new Date(event.startsAt).getTime() >= Date.now()
  ).length;

  const stats: StatDef[] = [
    { tab: 'panas', label: 'Panas', value: panasData?.count ?? null },
    { tab: 'posts', label: 'Posts', value: actor?.statusCount ?? null },
    {
      tab: 'groups',
      label: 'Groups',
      value: groupsData ? groups.length : null,
    },
  ];

  const statValue = (tab: PersonalTab) =>
    stats.find((entry) => entry.tab === tab)?.value ?? null;

  /* Posts lead because that is what people come to a profile for. Panas keeps
     a tab rather than living only in the rail: the rail module shows a dozen
     faces, and a profile with four hundred Panas needs somewhere for the rest
     of them to be. */
  const tabs: TabDef[] = [
    {
      id: 'posts',
      label: 'Posts',
      icon: PERSONAL_TAB_ICONS.posts,
      count: statValue('posts'),
    },
    {
      id: 'events',
      label: 'Events',
      icon: PERSONAL_TAB_ICONS.events,
      count: eventsData ? upcomingCount : null,
    },
    {
      id: 'groups',
      label: 'Groups',
      icon: PERSONAL_TAB_ICONS.groups,
      count: statValue('groups'),
    },
    {
      id: 'panas',
      label: 'Panas',
      icon: PERSONAL_TAB_ICONS.panas,
      count: statValue('panas'),
    },
  ];

  const actions = renderActions({
    isSelf,
    isAuthenticated,
    actor,
    isFollowing: Boolean(actorData?.isFollowing),
  });

  return (
    <main className="surface-cream min-h-screen pb-20">
      <div className="container mx-auto max-w-6xl px-4 pt-6">
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          <IdentityRail
            profile={profile}
            stats={stats}
            actions={actions}
            panas={
              <PanasRailModule
                data={panasData}
                name={profile.name}
                onSeeAll={() => setActiveTab('panas')}
              />
            }
          />

          <div className="min-w-0">
            <PersonalTabs
              tabs={tabs}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
            />

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

              {activeTab === 'events' && (
                <Panel id="events">
                  <EventsPanel
                    events={events}
                    isLoading={eventsLoading}
                    canSeeAttending={Boolean(eventsData?.canSeeAttending)}
                    name={profile.name}
                  />
                </Panel>
              )}

              {activeTab === 'groups' && (
                <Panel id="groups">
                  <PanelIntro
                    title="Groups"
                    lede="Communities inside Pana Social — neighborhood crews, crafts, dominoes, whatever people organize around. Only public groups appear here."
                  />
                  <GroupsPanel
                    groups={groups}
                    isLoading={groupsLoading}
                    name={profile.name}
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
            </div>
          </div>
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
        className="border-pana-ink/20 flex-1 rounded-full font-extrabold"
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

/* Upcoming and past, split.
 *
 * Four upcoming events look identical whether someone turns up constantly or
 * signed up once, so the recent past stays on the page — it is what separates
 * a habit from a plan. */
function EventsPanel({
  events,
  isLoading,
  canSeeAttending,
  name,
}: {
  events: ProfileEventSummary[];
  isLoading: boolean;
  canSeeAttending: boolean;
  name: string;
}) {
  if (isLoading) return <PanelLoading />;

  const now = Date.now();
  const upcoming = events.filter(
    (event) => new Date(event.startsAt).getTime() >= now
  );
  const past = events.filter(
    (event) => new Date(event.startsAt).getTime() < now
  );

  if (events.length === 0) {
    return (
      <EmptyState>
        {firstName(name)} has nothing coming up.
        {!canSeeAttending && (
          <span className="mt-1.5 block font-medium opacity-80">
            Events someone is going to stay private. Only what they host shows
            here.
          </span>
        )}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div className="space-y-3">
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h3 className="rail-heading mb-3">Recently</h3>
          <div className="space-y-3">
            {past.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupsPanel({
  groups,
  isLoading,
  name,
}: {
  groups: ProfileGroupSummary[];
  isLoading: boolean;
  name: string;
}) {
  if (isLoading) return <PanelLoading />;

  if (groups.length === 0) {
    return (
      <EmptyState>
        {firstName(name)} hasn&rsquo;t joined any public groups yet.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <GroupRow key={group.id} group={group} />
      ))}
    </div>
  );
}

/* The rail's Panas module: a wall of faces, not a list.
 *
 * Signed-out viewers get the count but no faces, the same split the endpoint
 * draws — how many is an aggregate nobody can impose on anyone, naming who is
 * a social graph. */
function PanasRailModule({
  data,
  name,
  onSeeAll,
}: {
  data?: {
    count: number;
    canSeeList: boolean;
    actors: {
      id: string;
      name?: string | null;
      username: string;
      iconUrl?: string | null;
    }[];
  } | null;
  name: string;
  onSeeAll: () => void;
}) {
  if (!data || data.count === 0) return null;

  const shown = data.actors.slice(0, 12);

  return (
    <section className="profile-card p-4">
      <h2 className="rail-heading">Panas</h2>

      {shown.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {shown.map((pana) => (
            <li key={pana.id}>
              <span
                className="border-pana-ink/10 bg-pana-butter relative block h-10 w-10 overflow-hidden rounded-full border-2"
                title={`${pana.name || pana.username} (@${pana.username})`}
              >
                {pana.iconUrl ? (
                  <Image
                    src={pana.iconUrl}
                    alt={pana.name || pana.username}
                    fill
                    sizes="40px"
                    className="object-cover"
                    unoptimized={isUnoptimizableImageSrc(pana.iconUrl)}
                  />
                ) : (
                  <span className="text-pana-ink flex h-full w-full items-center justify-center text-sm font-black">
                    {(pana.name || pana.username).charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-pana-ink/55 mt-2 text-[12px] leading-snug font-bold">
          {firstName(name)} has {data.count.toLocaleString('en-US')}{' '}
          {data.count === 1 ? 'Pana' : 'Panas'}.
        </p>
      )}

      <button
        type="button"
        onClick={onSeeAll}
        className="link-arrow text-pana-indigo mt-3 inline-flex text-[13px] font-extrabold"
      >
        See all Panas
      </button>
    </section>
  );
}

/* Signed-out viewers get the count from the rail but not the list. The empty
   state says which of the two it is, because "no Panas yet" and "you can't see
   them" look identical otherwise and only one is worth signing in over. */
function PanasPanel({
  data,
  isLoading,
  name,
  handle,
}: {
  data?: { count: number; canSeeList: boolean; actors: unknown[] } | null;
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

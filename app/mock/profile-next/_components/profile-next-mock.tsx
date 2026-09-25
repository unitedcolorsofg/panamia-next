'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  FileText,
  Store,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  MOCK_GROUPS,
  MOCK_POSTS,
  MOCK_PROFILE,
  RESERVED_MODULES,
} from '../../profile/_data/mock-profile';
import { PostCard } from '../../profile/_components/post-card';
import { ReservedSlot } from '../../profile/_components/group-cards';
import {
  MOCK_EVENTS,
  MOCK_RECO_LISTS,
  MOCK_RECO_TOTAL,
  MOCK_UPCOMING_COUNT,
} from '../_data/mock-profile-next';
import { IdentityRail } from './identity-rail';
import { EventCard, GroupRow, RecoListCard } from './content-cards';

type NextTab = 'posts' | 'events' | 'groups' | 'recommends';

interface NextTabDef {
  id: NextTab;
  label: string;
  icon: LucideIcon;
  count: number;
}

/* Four tabs, and they are all things this person has made or committed to.
 * Panas — a list of other people — is the one thing on the old profile that
 * does not fit that sentence, which is why it lives in the rail instead.
 *
 * Counts are the real totals, not the length of the mock array: a profile
 * claiming "Posts 4" would be describing the fixture rather than the person.
 * Events counts upcoming only, because a lifetime RSVP total answers a
 * question nobody asks. */
const TABS: NextTabDef[] = [
  {
    id: 'posts',
    label: 'Posts',
    icon: FileText,
    count: statValue('posts'),
  },
  {
    id: 'events',
    label: 'Events',
    icon: CalendarDays,
    count: MOCK_UPCOMING_COUNT,
  },
  {
    id: 'groups',
    label: 'Groups',
    icon: UsersRound,
    count: statValue('groups'),
  },
  {
    id: 'recommends',
    label: 'Recommends',
    icon: Store,
    count: MOCK_RECO_TOTAL,
  },
];

function statValue(tab: 'posts' | 'groups') {
  const stat = MOCK_PROFILE.stats.find((entry) => entry.tab === tab);
  if (!stat) {
    throw new Error(`Mock profile is missing a stat for "${tab}".`);
  }
  return stat.value;
}

/* Two of the four modules the old profile held space for are built on this
   page. Rendering the full reserved list here would have the layout claiming
   to be waiting on features it is already showing. */
const STILL_RESERVED = RESERVED_MODULES.filter(
  (module) =>
    module.title !== 'Events & RSVPs' && module.title !== 'Recommended lists'
);

const UPCOMING = MOCK_EVENTS.filter((event) => !event.past);
const PAST = MOCK_EVENTS.filter((event) => event.past);

/* The revamped personal profile.
 *
 * The layout is the feed's grid, mirrored. The feed puts content on the left
 * and a rail on the right; a profile inverts that, because on a feed the
 * standing column is context for a stream of other people, and on a profile
 * the standing column IS the subject.
 *
 * What this removes is the full-bleed banner, the big centred avatar, and the
 * full-width tab bar — the three things that made the old page read as a
 * social network's default rather than as Pana Mia. Nothing about the person
 * is lost; it is all in the rail, at a size that matches how often it is read. */
export function ProfileNextMock() {
  const [activeTab, setActiveTab] = useState<NextTab>('posts');

  return (
    <main className="surface-cream min-h-screen pb-20">
      <div className="container mx-auto max-w-6xl px-4 pt-6 lg:pt-10">
        <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          <IdentityRail />

          <div className="min-w-0">
            <div
              className="profile-tabs"
              role="tablist"
              aria-label="Profile content"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`next-tab-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`next-panel-${tab.id}`}
                    className="profile-tab"
                    data-active={isActive}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {tab.label}
                    <span className="profile-tab-count">
                      {tab.count.toLocaleString('en-US')}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              {activeTab === 'posts' && (
                <Panel id="posts">
                  <div className="space-y-4">
                    {MOCK_POSTS.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        profile={MOCK_PROFILE}
                      />
                    ))}
                  </div>
                </Panel>
              )}

              {activeTab === 'events' && (
                <Panel id="events">
                  <PanelIntro
                    title="Upcoming"
                    lede="Markets, workshops, and dinners this Pana is hosting or going to. Events marked Panas only are visible to mutuals — an RSVP is not automatically public."
                  />
                  <div className="space-y-4">
                    {UPCOMING.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>

                  {/* Past events are what turn a profile from a plan into a
                      pattern: four upcoming RSVPs look the same whether
                      someone shows up constantly or signed up once. */}
                  <h3 className="border-pana-ink/10 text-pana-ink/50 mt-8 border-t pt-5 text-[11px] font-extrabold tracking-widest uppercase">
                    Recently
                  </h3>
                  <div className="mt-4 space-y-4">
                    {PAST.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </Panel>
              )}

              {activeTab === 'groups' && (
                <Panel id="groups">
                  <PanelIntro
                    title="Groups"
                    lede="Communities inside Pana Social. Invite-only groups appear here only when the viewer is also a member."
                  />
                  <div className="space-y-4">
                    {MOCK_GROUPS.map((group) => (
                      <GroupRow key={group.id} group={group} />
                    ))}
                  </div>
                </Panel>
              )}

              {activeTab === 'recommends' && (
                <Panel id="recommends">
                  <PanelIntro
                    title="Recommends"
                    lede="Named lists of local businesses this Pana vouches for, in their own words. Every place links to its listing in the directory."
                  />
                  <div className="space-y-4">
                    {MOCK_RECO_LISTS.map((list) => (
                      <RecoListCard key={list.id} list={list} />
                    ))}
                  </div>
                </Panel>
              )}
            </div>

            <section className="mt-12">
              <span className="section-eyebrow">Room to grow</span>
              <h2 className="mt-3 text-xl font-black tracking-tight">
                Still held open
              </h2>
              <p className="text-pana-ink/65 mt-2 text-[13px] leading-snug font-medium">
                Events and recommended lists were reserved slots on the previous
                profile and are built above. These two are still waiting.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {STILL_RESERVED.map((module) => (
                  <ReservedSlot key={module.title} module={module} />
                ))}
              </div>
            </section>

            <p className="border-pana-ink/10 text-pana-ink/55 mt-12 border-t pt-6 text-[13px] leading-snug font-bold">
              Design mock at <code>/mock/profile-next</code> with hardcoded
              data. Same person and same posts as{' '}
              <Link
                href="/mock/profile"
                className="link-arrow text-pana-indigo"
              >
                /mock/profile
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>{' '}
              so the two layouts can be compared directly. The live route is{' '}
              <code>/p/[handle]</code>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Panel({ id, children }: { id: NextTab; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`next-panel-${id}`}
      aria-labelledby={`next-tab-${id}`}
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

'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  MOCK_FOLLOWERS_ONLY_COUNT,
  MOCK_GROUPS,
  MOCK_PANAS,
  MOCK_POSTS,
  MOCK_PROFILE,
  RESERVED_MODULES,
  type ProfileTab,
} from '../_data/mock-profile';
import { ProfileHero } from './profile-hero';
import { PROFILE_TAB_ICONS, ProfileTabs, type TabDef } from './profile-tabs';
import { PostCard } from './post-card';
import { PanaCard } from './connection-cards';
import { GroupCard, ReservedSlot } from './group-cards';

/* Reading order for the body, which is not the stat rail's order — posts lead
   here because that is what people come to a profile for, while the rail
   leads with the figure the profile is proudest of. */
const TAB_ORDER: ProfileTab[] = ['posts', 'panas', 'groups'];

/* Labels and counts come off the same stats the rail renders, so the two
   controls can never disagree about how many Panas someone has. */
const TABS: TabDef[] = TAB_ORDER.map((id) => {
  const stat = MOCK_PROFILE.stats.find((entry) => entry.tab === id);
  if (!stat) {
    throw new Error(`Mock profile is missing a stat for the "${id}" tab.`);
  }
  return {
    id,
    label: stat.label,
    icon: PROFILE_TAB_ICONS[id],
    count: stat.value,
  };
});

/* The whole mock. State lives here because the hero's stat rail and the tab
   bar are two views of the same selection. */
export function ProfileMock() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

  return (
    <main className="surface-cream min-h-screen pb-20">
      <ProfileHero
        profile={MOCK_PROFILE}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <div className="container mx-auto max-w-4xl px-4">
        <div className="mt-8">
          <ProfileTabs
            tabs={TABS}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
          />
        </div>

        <div className="mt-6">
          {activeTab === 'posts' && (
            <Panel id="posts">
              <div className="space-y-4">
                {MOCK_POSTS.map((post) => (
                  <PostCard key={post.id} post={post} profile={MOCK_PROFILE} />
                ))}
              </div>
            </Panel>
          )}

          {activeTab === 'panas' && (
            <Panel id="panas">
              <PanelIntro
                title="Panas"
                lede="A Pana is a mutual follow — both people followed each other. Everyone listed here follows this Pana back."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {MOCK_PANAS.map((pana) => (
                  <PanaCard key={pana.id} pana={pana} />
                ))}
              </div>
              <p className="border-pana-ink/10 text-pana-ink/60 mt-5 border-t pt-4 text-[13px] font-bold">
                {MOCK_FOLLOWERS_ONLY_COUNT.toLocaleString('en-US')} more people
                follow {MOCK_PROFILE.name.split(' ')[0]} without being followed
                back. They are followers, not Panas, so they are not counted in
                the Panas figure above.
              </p>
            </Panel>
          )}

          {activeTab === 'groups' && (
            <Panel id="groups">
              <PanelIntro
                title="Groups"
                lede="Communities inside Pana Social. Invite-only groups appear here only when the viewer is also a member."
              />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MOCK_GROUPS.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* Held-open space. Shown on every tab on purpose — it is a statement
            about the profile as a whole, not about the active section. */}
        <section className="mt-14">
          <span className="section-eyebrow">Room to grow</span>
          <h2 className="mt-3 text-2xl font-black tracking-tight">
            Space reserved as Pana Social fills in
          </h2>
          <p className="section-lede text-pana-ink/70 mt-2">
            These modules are designed into the layout now so the profile does
            not have to be re-laid-out later.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {RESERVED_MODULES.map((module) => (
              <ReservedSlot key={module.title} module={module} />
            ))}
          </div>
        </section>

        <p className="border-pana-ink/10 text-pana-ink/55 mt-14 border-t pt-6 text-[13px] font-bold">
          Design mock at <code>/mock/profile</code> with hardcoded data. This is
          the <strong>personal</strong> profile, which is a Pana Social profile
          — posts, Panas, and groups. Business listings are a separate directory
          design. The live route is{' '}
          <Link href="/p/claribel" className="link-arrow text-pana-indigo">
            /p/[handle]
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </main>
  );
}

function Panel({ id, children }: { id: ProfileTab; children: ReactNode }) {
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

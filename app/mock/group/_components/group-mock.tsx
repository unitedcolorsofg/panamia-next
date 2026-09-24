'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Lock, Shield, Sparkles } from 'lucide-react';
import type { MockSurface } from '../../_data/panaverse';
import { SurfaceMasthead } from '../../_components/surface-masthead';
import { FeedPostCard } from '../../feed/_components/feed-post-card';
import {
  MOCK_CHAT,
  MOCK_EVENTS,
  MOCK_GROUP,
  MOCK_GROUP_POSTS,
  MOCK_MEMBERS,
  MOCK_PRIVATE_GROUP,
  MOCK_RELATED,
  type GroupTab,
  type ViewerState,
} from '../_data/mock-group';
import { GroupHero } from './group-hero';
import { GroupRail } from './group-rail';
import { GroupChat } from './group-chat';
import { EventCard, MemberRow } from './group-panels';

/* Design mock for a Pana Social group home page.
 *
 * Deliberately built out of the feed and profile mocks rather than beside
 * them. The post cards are literally imported from /mock/feed — not copied,
 * imported — because the design claim being made is that a group post IS a
 * status with a group_id on it, exactly as docs/GROUPS-ROADMAP.md proposes. If
 * a group post needed its own card, the schema would be wrong. Reusing the
 * component is how the mock argues the schema is right.
 *
 * The hero is the profile's hero with a privacy state and a join action, for
 * the same reason: a group is an actor, so it wears an actor's furniture.
 *
 * The toolbar switches viewer state rather than content state, which is the
 * one real departure from the feed mock. A group looks materially different
 * depending on who is asking, and that difference is the whole design problem.
 * `locked` is the important one. */
export function GroupMock({ surfaces }: { surfaces: MockSurface[] }) {
  const router = useRouter();
  const [viewer, setViewer] = useState<ViewerState>('member');
  const [activeTab, setActiveTab] = useState<GroupTab>('posts');
  const [joined, setJoined] = useState(true);

  const group = viewer === 'locked' ? MOCK_PRIVATE_GROUP : MOCK_GROUP;
  const isMember = viewer === 'member' || joined;

  const current =
    surfaces.find((surface) => surface.id === 'social') ?? surfaces[0];

  /* Chat is a members-only tab, so a visitor should not be looking at an empty
     room with a greyed-out box. Hiding the tab entirely is the honest version:
     the room is not a thing they have. */
  const tabs: { id: GroupTab; label: string; count: number }[] = [
    { id: 'posts', label: 'Posts', count: MOCK_GROUP_POSTS.length },
    { id: 'events', label: 'Events', count: MOCK_EVENTS.length },
    { id: 'members', label: 'Members', count: MOCK_MEMBERS.length },
    ...(isMember
      ? [{ id: 'chat' as const, label: 'Chat', count: MOCK_CHAT.length }]
      : []),
  ];

  const selectViewer = (next: ViewerState) => {
    setViewer(next);
    setJoined(next === 'member');
    setActiveTab('posts');
  };

  return (
    <main className="surface-cream min-h-screen pb-20">
      <MockToolbar
        viewer={viewer}
        onSelectViewer={selectViewer}
        hostname={current.hostname}
      />

      <SurfaceMasthead
        surfaces={surfaces}
        current={current}
        onSelect={(id) => {
          if (id !== current.id) router.push('/mock/panaverse');
        }}
        sticky
        contained
      />

      <GroupHero
        group={group}
        viewer={viewer}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        joined={joined}
        onToggleJoin={() => setJoined((value) => !value)}
      />

      <div className="container mx-auto max-w-6xl px-4 pt-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <div className="min-w-0">
            {viewer === 'locked' ? (
              <LockedPanel />
            ) : (
              <>
                <div role="tablist" aria-label="Group sections">
                  <div className="profile-tabs">
                    {tabs.map((tab) => {
                      const isActive = tab.id === activeTab;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          id={`group-tab-${tab.id}`}
                          aria-selected={isActive}
                          aria-controls="group-panel"
                          className="profile-tab"
                          data-active={isActive}
                          onClick={() => setActiveTab(tab.id)}
                        >
                          {tab.label}
                          <span className="profile-tab-count">{tab.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  id="group-panel"
                  role="tabpanel"
                  aria-labelledby={`group-tab-${activeTab}`}
                  className="mt-5"
                >
                  {activeTab === 'posts' && (
                    <div className="space-y-4">
                      {/* Non-members read but cannot post. The roadmap's
                          write path checks membership; saying so here keeps
                          the mock honest about it. */}
                      {!isMember && (
                        <p className="text-pana-ink/60 border-pana-ink/10 rounded-2xl border border-dashed px-4 py-3 text-[13px] leading-snug font-bold">
                          You&apos;re reading a public group. Join to post,
                          reply, or open the chat.
                        </p>
                      )}
                      {MOCK_GROUP_POSTS.map((post) => (
                        <FeedPostCard key={post.id} post={post} />
                      ))}
                      <div className="feed-end mt-8">
                        <span>That&apos;s the whole group so far</span>
                      </div>
                    </div>
                  )}

                  {activeTab === 'events' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {MOCK_EVENTS.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  )}

                  {activeTab === 'members' && (
                    <div className="space-y-3">
                      {MOCK_MEMBERS.map((member) => (
                        <MemberRow key={member.id} member={member} />
                      ))}
                    </div>
                  )}

                  {activeTab === 'chat' && (
                    <GroupChat
                      messages={MOCK_CHAT}
                      viewer={viewer}
                      joined={joined}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          <GroupRail
            group={group}
            members={
              viewer === 'locked' ? MOCK_MEMBERS.slice(0, 2) : MOCK_MEMBERS
            }
            /* Scoped to the group actually being rendered rather than passed
               unconditionally. The private fixture hosts nothing, and an
               earlier revision of this file leaked the public group's next
               workshop into its rail — a real instance of the bug the locked
               state exists to catch, caught by the locked state. */
            nextEvent={group.eventCount > 0 ? MOCK_EVENTS[0] : undefined}
            related={viewer === 'locked' ? [] : MOCK_RELATED}
            viewer={viewer}
          />
        </div>

        <p className="border-pana-ink/10 text-pana-ink/55 mt-14 border-t pt-6 text-[13px] font-bold">
          Design mock at <code>/mock/group</code> with hardcoded data, following{' '}
          <code>docs/GROUPS-ROADMAP.md</code>. Post cards are imported from{' '}
          <Link href="/mock/feed" className="link-arrow text-pana-indigo">
            /mock/feed
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>{' '}
          rather than redrawn, because a group post is a status with a group on
          it. The hero shares its primitives with{' '}
          <Link href="/mock/profile" className="link-arrow text-pana-indigo">
            /mock/profile
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </main>
  );
}

/* What a non-member sees of a private group.
 *
 * This panel is the most important thing on the page. The roadmap lists
 * private-group leakage as the highest-severity risk in the whole design —
 * one missing membership check in the timeline query and a tenant union's
 * posts land in a stranger's feed. A risk written in a document is easy to
 * nod at; a risk drawn on screen is something a reviewer can actually check.
 *
 * So the rule is visible rather than described: no posts, no roster, no chat,
 * no event location, no post or event counts. Name, summary, admins, member
 * count, and a way in. If a future change causes anything else to appear here,
 * the mock has caught a bug. */
function LockedPanel() {
  return (
    <div className="space-y-4">
      <div className="reserved-slot items-start p-7">
        <p className="reserved-slot-title inline-flex items-center gap-2">
          <Lock className="h-4 w-4" aria-hidden="true" />
          This group is private
        </p>
        <p className="text-pana-ink/70 max-w-prose text-[14px] leading-relaxed font-medium">
          Posts, members, events, and chat are only visible to people who have
          been approved. An admin reviews every request.
        </p>
        <p className="text-pana-ink/50 max-w-prose text-[13px] leading-snug font-medium">
          Nothing from inside this group is loaded on this page — not in the
          feed, not in search, not here.
        </p>
      </div>

      <div className="profile-card flex items-start gap-3 p-5">
        <Shield
          className="text-pana-indigo mt-0.5 h-5 w-5 flex-none"
          aria-hidden="true"
        />
        <div>
          <p className="text-[14px] leading-snug font-extrabold">
            Why groups can be private
          </p>
          <p className="text-pana-ink/65 mt-1 max-w-prose text-[13px] leading-relaxed font-medium">
            Tenant unions, mutual aid crews, and support circles organise here
            too. A group that cannot be read from the outside is the reason they
            can.
          </p>
        </div>
      </div>
    </div>
  );
}

/* Developer chrome, same treatment as the feed mock: dark, above the masthead,
   scrolls away while the masthead sticks. The switch changes who is looking
   rather than what exists, because a group's design problem is a permissions
   problem. */
function MockToolbar({
  viewer,
  onSelectViewer,
  hostname,
}: {
  viewer: ViewerState;
  onSelectViewer: (viewer: ViewerState) => void;
  hostname: string;
}) {
  return (
    <div className="mock-toolbar">
      <span className="mock-toolbar-badge">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Mock
      </span>

      <span className="mock-toolbar-host">
        <Lock className="h-3 w-3 flex-none" aria-hidden="true" />
        {hostname}
      </span>

      <div className="mock-switch ml-auto">
        <button
          type="button"
          data-active={viewer === 'member'}
          onClick={() => onSelectViewer('member')}
        >
          Member
        </button>
        <button
          type="button"
          data-active={viewer === 'visitor'}
          onClick={() => onSelectViewer('visitor')}
        >
          Visitor
        </button>
        <button
          type="button"
          data-active={viewer === 'locked'}
          onClick={() => onSelectViewer('locked')}
        >
          Private
        </button>
      </div>

      <Link href="/mock/feed" className="mock-toolbar-link">
        Feed mock
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import {
  Bell,
  CalendarDays,
  Check,
  Globe,
  Lock,
  Share2,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GroupTab, MockGroup, ViewerState } from '../_data/mock-group';

interface GroupHeroProps {
  group: MockGroup;
  viewer: ViewerState;
  activeTab: GroupTab;
  onSelectTab: (tab: GroupTab) => void;
  joined: boolean;
  onToggleJoin: () => void;
}

/* Cover, identity block, summary, actions, and the stat rail.
 *
 * Structurally the personal profile's hero with a different identity block,
 * and that similarity is deliberate: a group is an actor in the proposed
 * schema, so it should wear the same furniture a person does. Where it differs
 * is where a group genuinely differs — it has a privacy state and a join
 * action, and a person has neither.
 *
 * The stat rail drives the same `activeTab` state as the tab bar below it, so
 * "428 Members" is a control rather than a decoration. It is not a second
 * `tablist`: two tablists driving one set of panels reads as a duplicate
 * control group to a screen reader, so these stay plain buttons and the tab
 * bar below owns the tab semantics. Lifted wholesale from ProfileHero, which
 * solved this already. */
export function GroupHero({
  group,
  viewer,
  activeTab,
  onSelectTab,
  joined,
  onToggleJoin,
}: GroupHeroProps) {
  const isPrivate = group.visibility === 'private';

  /* A locked group shows Members but not Posts or Events. Advertising "1,240
     posts" on a page that refuses to show a single one is a tease, and worse,
     it leaks activity level — which is exactly the kind of detail a tenant
     union would not want a landlord reading off a public page. */
  const stats: { tab: GroupTab; label: string; value: number }[] =
    viewer === 'locked'
      ? [{ tab: 'members', label: 'Members', value: group.memberCount }]
      : [
          { tab: 'members', label: 'Members', value: group.memberCount },
          { tab: 'posts', label: 'Posts', value: group.postCount },
          { tab: 'events', label: 'Events', value: group.eventCount },
        ];

  return (
    <header>
      {/* Scallop is white to match the masthead directly above, the same way
          the profile hero meets it. */}
      <div
        className="profile-cover scallop"
        style={{ '--scallop': '#ffffff' } as CSSProperties}
      >
        <Image
          src={group.cover}
          alt={group.coverAlt}
          fill
          priority
          sizes="100vw"
        />
      </div>

      <div className="container mx-auto max-w-4xl px-4">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:gap-7">
          {/* Square-ish rather than a circle. A circular avatar reads as a
              person, and the one thing this page must never be mistaken for
              is somebody's profile. */}
          <div className="profile-avatar" data-shape="group">
            <Image
              src={group.avatar}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 184px, 152px"
            />
          </div>

          <div className="min-w-0 flex-1 md:pb-1">
            <h1 className="profile-name">{group.name}</h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="profile-handle">@{group.handle}</span>
              <span
                className="identity-pill"
                data-tone={isPrivate ? undefined : 'verified'}
              >
                {isPrivate ? (
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {isPrivate ? 'Private group' : 'Open group'}
              </span>
            </div>
          </div>

          <div className="hidden flex-none items-center gap-2 md:flex md:pb-1">
            <GroupActions
              viewer={viewer}
              joined={joined}
              onToggleJoin={onToggleJoin}
            />
          </div>
        </div>

        <div className="mt-5 max-w-2xl space-y-4">
          <p className="text-pana-ink/85 text-[15px] leading-relaxed font-medium">
            {group.summary}
          </p>

          <div className="text-pana-ink/60 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-bold">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" aria-hidden="true" />
              {group.memberCount.toLocaleString('en-US')} members
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {group.founded}
            </span>
          </div>

          {/* Topics are the search surface, not decoration — they are the
              JSONB flag map that feeds the group's tsvector, so they are the
              same shape as the tags on a profile and render the same way. */}
          <ul className="flex flex-wrap gap-2">
            {group.topics.map((topic) => (
              <li key={topic}>
                <span className="identity-pill text-pana-ink/70">#{topic}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex items-center gap-2 md:hidden">
          <GroupActions
            viewer={viewer}
            joined={joined}
            onToggleJoin={onToggleJoin}
            stretch
          />
        </div>

        <div className="stat-rail mt-6">
          {stats.map((stat) => (
            <button
              key={stat.tab}
              type="button"
              className="stat-rail-item"
              data-active={activeTab === stat.tab}
              onClick={() => onSelectTab(stat.tab)}
            >
              <span className="stat-rail-value">
                {stat.value.toLocaleString('en-US')}
              </span>
              <span className="stat-rail-label">{stat.label}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

/* Rendered twice at different breakpoints, so it is factored out rather than
   duplicated. `stretch` is the mobile arrangement, where the primary action
   claims the remaining width.
 *
 * Three different primary actions, one per viewer state, because the same
 * button cannot honestly serve all three:
 *
 *   - member  → Joined, which is a way *out*. A member needs no call to action.
 *   - visitor → Join group, one tap, because the policy is open.
 *   - locked  → Request to join, which sets an expectation of waiting. Calling
 *               it "Join" would promise access this group does not grant.
 *
 * Indigo rather than burnt, per the palette note in globals.css: white-on-burnt
 * measures roughly 4.2:1, under the 4.5 bar for button copy, while
 * cream-on-indigo measures 9.01. */
function GroupActions({
  viewer,
  joined,
  onToggleJoin,
  stretch = false,
}: {
  viewer: ViewerState;
  joined: boolean;
  onToggleJoin: () => void;
  stretch?: boolean;
}) {
  if (viewer === 'locked') {
    return (
      <>
        <Button
          className={`bg-pana-indigo text-pana-cream hover:bg-pana-indigo/90 rounded-full font-extrabold ${
            stretch ? 'flex-1' : ''
          }`}
        >
          <Lock className="h-4 w-4" aria-hidden="true" />
          Request to join
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="border-pana-ink/20 rounded-full"
          aria-label="Share group"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </>
    );
  }

  return (
    <>
      <Button
        onClick={onToggleJoin}
        aria-pressed={joined}
        variant={joined ? 'outline' : 'default'}
        className={
          joined
            ? `border-pana-ink/20 rounded-full font-extrabold ${stretch ? 'flex-1' : ''}`
            : `bg-pana-indigo text-pana-cream hover:bg-pana-indigo/90 rounded-full font-extrabold ${
                stretch ? 'flex-1' : ''
              }`
        }
      >
        {joined ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <UserPlus className="h-4 w-4" aria-hidden="true" />
        )}
        {joined ? 'Joined' : 'Join group'}
      </Button>

      {joined && (
        <Button
          variant="outline"
          size="icon"
          className="border-pana-ink/20 rounded-full"
          aria-label="Notification settings for this group"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}

      <Button
        variant="outline"
        size="icon"
        className="border-pana-ink/20 rounded-full"
        aria-label="Share group"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </>
  );
}

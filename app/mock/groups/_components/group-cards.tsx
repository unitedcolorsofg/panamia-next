'use client';

import Image from 'next/image';
import { CalendarDays, Lock, MessageSquare, Users } from 'lucide-react';
import {
  groupFor,
  type MockGroupCard,
  type MockGroupEvent,
  type MockTopic,
} from '../_data/mock-groups';

/**
 * The pieces the landing page and the discover page share.
 *
 * They share these rather than each drawing their own because the two pages
 * are one flow: somebody scans featured groups on the landing page, clicks
 * through to discover, and scans again. If the card changed shape between the
 * two steps the second screen would read as a different feature.
 */

/**
 * The action on a group card, which is the only genuinely hard part of it.
 *
 * Four states, not two, and the third and fourth are the ones that get
 * forgotten:
 *
 *   joined    -> no join control at all, just a way back in
 *   requested -> pending, and NOT a button, because clicking it again does
 *                nothing a member can perceive
 *   invite    -> there is no action; saying so is better than a button that
 *                fails on click
 *   open      -> the ordinary case
 *
 * A request-policy group still gets a working button; it just says Request.
 * Collapsing that into "Join" is how people end up believing they are in a
 * group that has not approved them yet.
 */
function JoinAction({ group }: { group: MockGroupCard }) {
  if (group.joined) {
    return (
      <span className="border-pana-ink/15 text-pana-ink/60 inline-flex shrink-0 items-center rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold">
        Joined
      </span>
    );
  }

  if (group.requested) {
    return (
      <span className="border-pana-indigo/30 text-pana-indigo inline-flex shrink-0 items-center rounded-full border-2 border-dashed px-3 py-1.5 text-[12px] font-extrabold">
        Requested
      </span>
    );
  }

  if (group.joinPolicy === 'invite') {
    return (
      <span className="text-pana-ink/45 inline-flex shrink-0 items-center px-1 text-[12px] font-bold">
        Invite only
      </span>
    );
  }

  return (
    <button
      type="button"
      className="bg-pana-ink inline-flex shrink-0 items-center rounded-full px-4 py-1.5 text-[12px] font-extrabold text-white"
    >
      {group.joinPolicy === 'request' ? 'Request' : 'Join'}
    </button>
  );
}

/**
 * Activity, and the reason it is a sentence rather than a number.
 *
 * A private group reports nothing, because its post count is not public. A
 * dormant group says so plainly instead of rendering "0 posts this week",
 * which reads as broken rather than quiet. Both are cases a bare number
 * cannot express, which is why this returns prose.
 */
function activityLabel(group: MockGroupCard): string | null {
  if (group.visibility === 'private') return null;
  if (group.postsThisWeek === 0) return 'Quiet this week';
  if (group.postsThisWeek === 1) return '1 post this week';
  return `${group.postsThisWeek} posts this week`;
}

export function GroupCard({ group }: { group: MockGroupCard }) {
  const activity = activityLabel(group);

  return (
    <article className="profile-card flex gap-3.5 p-4">
      <Image
        src={group.avatar}
        alt=""
        width={56}
        height={56}
        className="border-pana-ink/10 h-14 w-14 flex-none rounded-2xl border-2 object-cover"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-pana-ink truncate text-[15px] leading-tight font-extrabold">
              {group.name}
            </h3>
            <p className="text-pana-ink/50 mt-0.5 truncate text-[12px] font-bold">
              @{group.handle}
            </p>
          </div>

          <JoinAction group={group} />
        </div>

        {/* Clamped rather than truncated at a character count. The long
            summary in the fixtures is there to make sure three lines is
            enough to be useful and not so many that cards stop being
            scannable next to each other. */}
        <p className="text-pana-ink/70 mt-2 line-clamp-3 text-[13px] leading-relaxed font-medium">
          {group.summary}
        </p>

        <div className="text-pana-ink/55 mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {group.memberCount.toLocaleString()}
          </span>

          {activity && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              {activity}
            </span>
          )}

          {group.visibility === 'private' && (
            <span className="card-flag">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Private
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * A topic chip.
 *
 * The count is passed in from topicsWithCounts() rather than read off the
 * topic, so a chip can never advertise a number the filter behind it does not
 * produce -- see the note on derived values in the fixtures.
 */
export function TopicChip({
  topic,
  count,
  active,
  onSelect,
}: {
  topic: MockTopic;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={
        active
          ? 'border-pana-ink bg-pana-ink inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-[13px] font-extrabold text-white'
          : 'border-pana-ink/14 text-pana-ink hover:border-pana-indigo inline-flex items-center gap-1.5 rounded-full border-2 bg-white px-3.5 py-1.5 text-[13px] font-extrabold transition-colors'
      }
    >
      {topic.label}
      <span className={active ? 'text-white/60' : 'text-pana-ink/40'}>
        {count}
      </span>
    </button>
  );
}

/**
 * An upcoming event, with its group named on it.
 *
 * The group's name is not decoration. An event row that only says what and
 * when is an events-page row; naming the host is the whole argument for
 * putting events on a groups page, because it shows what joining actually
 * gets you.
 */
export function GroupEventRow({ event }: { event: MockGroupEvent }) {
  const group = groupFor(event);
  if (!group) return null;

  return (
    <article className="profile-card flex items-center gap-3.5 p-4">
      <div className="bg-pana-indigo/10 text-pana-indigo flex h-11 w-11 flex-none items-center justify-center rounded-xl">
        <CalendarDays className="h-5 w-5" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-pana-ink truncate text-[14px] leading-tight font-extrabold">
          {event.title}
        </h3>
        <p className="text-pana-ink/60 mt-0.5 truncate text-[12px] font-bold">
          {event.when} - {event.where}
        </p>
        <p className="text-pana-ink/45 mt-0.5 truncate text-[12px] font-bold">
          Hosted by {group.name} - {event.going} going
        </p>
      </div>
    </article>
  );
}

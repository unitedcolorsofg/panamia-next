'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  CalendarDays,
  Globe,
  Lock,
  Mail,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  eventsForGroup,
  groupFor,
  topicLabel,
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
 *
 * The browse card is built out of the directory's `.dirsearch-card-*`
 * primitives rather than new ones. That is deliberate: a group being browsed
 * and a business being browsed are the same question asked twice -- what is
 * this, who else is there, is anything happening soon -- and the directory
 * card is the one we already know answers it. Reusing the classes also means
 * the two surfaces cannot drift apart as either is tuned.
 *
 * If this ships, the CSS block wants renaming to something surface-neutral
 * (`.pana-browsecard-*`) rather than leaving groups dressed in a class called
 * "dirsearch". That is a rename, not a redesign, so it is not worth doing to
 * a mock.
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
      <span className="dirsearch-save" data-on="true">
        Joined
      </span>
    );
  }

  if (group.requested) {
    return <span className="dirsearch-claim">Requested</span>;
  }

  if (group.joinPolicy === 'invite') {
    return (
      <span className="text-pana-ink/45 inline-flex shrink-0 items-center px-1 text-[13px] font-bold">
        Invite only
      </span>
    );
  }

  return (
    <button type="button" className="dirsearch-view">
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

/**
 * How you get in, in the slot the directory card uses for how far away
 * something is.
 *
 * That slot is not "location" in the abstract -- it is the one thing standing
 * between seeing a result and acting on it. For a business that is the drive.
 * For a group it is the door: an invite-only group you cannot join is as out
 * of reach as a shop in Homestead, and finding that out after clicking Join
 * is the same wasted trip.
 *
 * Visibility is deliberately not repeated here. A private group already wears
 * a badge on its cover, which is the louder position, and saying it twice on
 * one card spends the slot on something the viewer has already been told.
 */
function accessLabel(group: MockGroupCard): {
  Icon: typeof Globe;
  text: string;
} {
  if (group.joinPolicy === 'invite') {
    return { Icon: Mail, text: 'Invite only' };
  }
  if (group.joinPolicy === 'request') {
    return { Icon: ShieldCheck, text: 'Anyone can ask, organisers approve' };
  }
  return { Icon: Globe, text: 'Open to anyone' };
}

/**
 * `showEvents` is opt-in rather than always on.
 *
 * The landing page's "Active right now" shelf is a handful of cards being
 * argued for, where "they are meeting on Saturday" is the strongest thing
 * that can be said about a group. Discover is a list of ten-plus being
 * scanned, where a fourth fact on every row costs more in density than it
 * returns -- and where the sort is explicitly about posts, so a date would be
 * answering a question nobody asked.
 */
export function GroupCard({
  group,
  showEvents = false,
}: {
  group: MockGroupCard;
  showEvents?: boolean;
}) {
  const activity = activityLabel(group);
  const access = accessLabel(group);
  const href = '/mock/group';

  /* Suppressed together, and for one reason rather than three. What a private
     group is doing, when it next meets, and who is in it are the things
     privacy is actually protecting -- a browse card that leaked any of them
     would make the setting decorative. */
  const isPrivate = group.visibility === 'private';
  const events = showEvents && !isPrivate ? eventsForGroup(group.id) : [];
  const nextEvent = events[0];
  const faces = isPrivate ? [] : group.memberFaces.slice(0, 4);

  return (
    <article className="dirsearch-card">
      <Link
        href={href}
        className="dirsearch-card-media"
        aria-label={`${group.name} — view group`}
        tabIndex={-1}
      >
        {group.cover ? (
          <Image
            src={group.cover}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 260px"
            className="object-cover"
          />
        ) : (
          /* No cover is a normal state, not a broken one, so it gets a
             deliberate treatment rather than an empty butter rectangle. The
             media box already carries the butter background; this just stops
             it reading as a failed image load. */
          <span className="text-pana-indigo/25 absolute inset-0 flex items-center justify-center">
            <Users className="h-10 w-10" aria-hidden="true" />
          </span>
        )}

        {isPrivate && (
          <span className="dirsearch-card-cert">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Private
          </span>
        )}
      </Link>

      <div className="dirsearch-card-body">
        <div className="dirsearch-card-head">
          <span className="dirsearch-card-logo">
            <Image
              src={group.avatar}
              alt=""
              width={52}
              height={52}
              aria-hidden="true"
            />
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">
              <Link href={href}>{group.name}</Link>
            </h3>
            <p className="dirsearch-card-tagline">@{group.handle}</p>
          </div>
        </div>

        <p className="dirsearch-card-where">
          <access.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{access.text}</span>
          {activity && (
            <span className="dirsearch-card-distance">{activity}</span>
          )}
        </p>

        {/* The CSS clamps this rather than cutting at a character count. The
            long summary in the fixtures is there to make sure three lines is
            enough to be useful and not so many that cards stop being
            scannable next to each other. */}
        <p className="dirsearch-card-blurb">{group.summary}</p>

        {group.topics.length > 0 && (
          <ul className="dirsearch-card-cats">
            {group.topics.map((topic) => (
              <li key={topic}>{topicLabel(topic)}</li>
            ))}
          </ul>
        )}

        {/* A reason to turn up this week rather than join and forget. When a
            group has several, the nearest one is named and the rest are
            counted: listing both dates turns a one-line summary into a
            schedule, and showing only the first is a half-truth. */}
        {nextEvent && (
          <Link href={href} className="dirsearch-card-event">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            <strong>{nextEvent.title}</strong>
            <span>{nextEvent.day}</span>
            {events.length > 1 && (
              <span>+{events.length - 1} more this month</span>
            )}
          </Link>
        )}

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            {faces.length > 0 && (
              <span className="dirsearch-card-avatars" aria-hidden="true">
                {faces.map((face) => (
                  <Image key={face} src={face} alt="" width={26} height={26} />
                ))}
              </span>
            )}
            <span className="dirsearch-card-counts">
              <strong>{group.memberCount.toLocaleString()}</strong> members
            </span>
          </div>

          <div className="dirsearch-card-actions">
            <JoinAction group={group} />
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * The compact variant, for groups the viewer is already in.
 *
 * "Your groups" is navigation, not persuasion. A cover photograph, a topic
 * list and a row of member faces are all arguments for joining, and spending
 * them on somebody who joined months ago pushes the thing they came for --
 * the way back in -- below the fold. The rich card sells; this one just gets
 * out of the way.
 */
export function GroupRow({ group }: { group: MockGroupCard }) {
  const activity = activityLabel(group);

  return (
    <Link
      href="/mock/group"
      className="profile-card hover:border-pana-indigo/30 flex items-center gap-3.5 p-3.5 transition-colors"
    >
      <Image
        src={group.avatar}
        alt=""
        width={44}
        height={44}
        className="border-pana-ink/10 h-11 w-11 flex-none rounded-xl border-2 object-cover"
      />

      <div className="min-w-0 flex-1">
        <h3 className="text-pana-ink truncate text-[14px] leading-tight font-extrabold">
          {group.name}
        </h3>
        <div className="text-pana-ink/55 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-bold">
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
    </Link>
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
          {event.day} - {event.time} - {event.where}
        </p>
        <p className="text-pana-ink/45 mt-0.5 truncate text-[12px] font-bold">
          Hosted by {group.name} - {event.going} going
        </p>
      </div>
    </article>
  );
}

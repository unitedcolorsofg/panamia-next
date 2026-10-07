'use client';

import {
  CalendarDays,
  Globe,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react';
import SurfaceLink from '@/components/panaverse/SurfaceLink';
import type {
  GroupSearchSummary,
  MyGroupSummary,
  UpcomingGroupEvent,
} from '@/lib/query/social';

/**
 * The group cards shared by /groups and /groups/discover.
 *
 * They share these rather than each drawing their own because the two pages
 * are one flow: somebody scans featured groups on the landing page, clicks
 * through to discover, and scans again. If the card changed shape between the
 * two steps the second screen would read as a different feature.
 *
 * The rich card is built out of the directory's `.dirsearch-card-*`
 * primitives rather than new ones. That is deliberate: a group being browsed
 * and a business being browsed are the same question asked twice -- what is
 * this, who else is there, is anything happening soon -- and the directory
 * card is the one we already know answers it. Reusing the classes also means
 * the two surfaces cannot drift apart as either is tuned.
 *
 * The class names want renaming to something surface-neutral
 * (`.pana-browsecard-*`), since groups are not the directory. That is a
 * rename rather than a redesign, and it touches eleven files across the
 * directory, panas and explore surfaces, so it is deliberately not bundled
 * with shipping this page.
 *
 * Every image here is a plain `<img>`, not `next/image`. These are remote CDN
 * URLs and next.config.js declares no `remotePatterns`, so the optimizer
 * would reject them at runtime.
 */

/** Topic chips on a card before the rest are folded into a count. */
const TOPIC_PREVIEW_LIMIT = 4;

/** Faces in the pile. The server sends up to five; four reads as a crowd. */
const FACE_LIMIT = 4;

/** Stands in for a missing cover, same as the directory uses. */
const FALLBACK_LOGO = '/img/bg_coconut_blue.jpg';

/** A group's topics, in the order they were stored, flags only. */
export function groupTopics(group: {
  topics: Record<string, boolean>;
}): string[] {
  const topics = group.topics ?? {};
  return Object.keys(topics).filter((topic) => topics[topic]);
}

/**
 * When an event is, in the event's own timezone.
 *
 * An event in Miami is on the day Miami says it is regardless of where it is
 * being browsed from. Same position search-kinds.ts and suggest.ts take, and
 * the same fallback: one row with a bad tz must not take the page down.
 */
function formatWhen(startsAt: string, timezone: string): string | null {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  };

  try {
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
}

/**
 * Activity, and the reason it is a sentence rather than a number.
 *
 * A private group reports nothing, because its post count is not public --
 * the server already sends 0, and rendering that as "0 posts this week" would
 * turn a withheld number into a false claim that the group is dead. A
 * genuinely dormant public group says so plainly for the same reason: "0
 * posts this week" reads as broken rather than quiet. Both are cases a bare
 * number cannot express, which is why this returns prose or nothing.
 */
function activityLabel(group: GroupSearchSummary): string | null {
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
function accessLabel(group: GroupSearchSummary): {
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
 * The action on a group card, and the one place this differs from the mock.
 *
 * The mock drew a working Join button with four states, including "Requested".
 * Production cannot: the search endpoint is deliberately unauthenticated, so a
 * result carries no membership at all, and `useMyGroups` -- the only thing
 * that knows -- lists active memberships and not pending requests. A button
 * that cannot see a pending request would offer "Join" to somebody already
 * waiting on approval, re-submit it, and leave them believing they are in a
 * group that has not approved them. That is exactly the failure the four-state
 * design existed to prevent, so it is better not to draw the button than to
 * draw one that lies.
 *
 * So the action navigates rather than writes. The group page knows the
 * viewer's real state -- member, pending, banned, invited -- and is where
 * joining already works. The card keeps the label, because "Request" and
 * "Join" tell you what will happen when you arrive, and drops the write.
 *
 * `joined` comes from the viewer's own group list, which is why it is passed
 * in rather than read here: one query on the page, not one per card.
 */
function JoinAction({
  group,
  joined,
}: {
  group: GroupSearchSummary;
  joined: boolean;
}) {
  if (joined) {
    return (
      <span className="dirsearch-save" data-on="true">
        Joined
      </span>
    );
  }

  if (group.joinPolicy === 'invite') {
    return (
      <span className="text-pana-ink/45 inline-flex shrink-0 items-center px-1 text-[13px] font-bold">
        Invite only
      </span>
    );
  }

  return (
    <SurfaceLink href={`/g/${group.handle}`} className="dirsearch-view">
      {group.joinPolicy === 'request' ? 'Request' : 'Join'}
    </SurfaceLink>
  );
}

/**
 * `showEvents` is opt-in rather than always on.
 *
 * The landing page's "Active right now" shelf is a handful of cards being
 * argued for, where "they are meeting on Saturday" is the strongest thing
 * that can be said about a group. Discover is a list of twenty-plus being
 * scanned, where a fourth fact on every row costs more in density than it
 * returns -- and where the sort is often explicitly about posts, so a date
 * would be answering a question nobody asked.
 */
export function GroupCard({
  group,
  joined = false,
  showEvents = false,
}: {
  group: GroupSearchSummary;
  joined?: boolean;
  showEvents?: boolean;
}) {
  const activity = activityLabel(group);
  const access = accessLabel(group);
  const href = `/g/${group.handle}`;
  const name = group.name || group.handle;

  /* Suppressed together, and for one reason rather than three. What a private
     group is doing, when it next meets, and who is in it are the things
     privacy is actually protecting. The server already withholds all three in
     SQL, so this is belt and braces rather than the enforcement point -- but
     it is what keeps the card from rendering "Quiet this week" over a group
     that simply refused to answer. */
  const isPrivate = group.visibility === 'private';
  const nextEvent = showEvents && !isPrivate ? group.nextEvent : null;
  const moreEvents = Math.max(0, group.upcomingEventCount - 1);
  const faces = isPrivate ? [] : (group.faces ?? []).slice(0, FACE_LIMIT);

  const topics = groupTopics(group);
  const shownTopics = topics.slice(0, TOPIC_PREVIEW_LIMIT);
  const moreTopics = topics.length - shownTopics.length;

  const when = nextEvent
    ? formatWhen(nextEvent.startsAt, nextEvent.timezone)
    : null;

  return (
    <article className="dirsearch-card">
      <SurfaceLink
        href={href}
        className="dirsearch-card-media"
        aria-label={`${name} — view group`}
        tabIndex={-1}
      >
        {group.headerUrl ? (
          <img
            src={group.headerUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
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
      </SurfaceLink>

      <div className="dirsearch-card-body">
        <div className="dirsearch-card-head">
          <span className="dirsearch-card-logo">
            <img
              src={group.iconUrl || FALLBACK_LOGO}
              alt=""
              aria-hidden="true"
            />
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">
              <SurfaceLink href={href}>{name}</SurfaceLink>
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

        {group.summary && (
          <p className="dirsearch-card-blurb">{group.summary}</p>
        )}

        {shownTopics.length > 0 && (
          /* Topics are free text -- the create form takes a comma-separated
             list and stores it as typed -- so the key is the label. There is
             no vocabulary to translate against, and inventing one would mean
             a chip reading something the group never wrote. */
          <ul className="dirsearch-card-cats">
            {shownTopics.map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
            {moreTopics > 0 && <li>+{moreTopics}</li>}
          </ul>
        )}

        {/* A reason to turn up this week rather than join and forget. When a
            group has several, the nearest one is named and the rest are
            counted: listing every date turns a one-line summary into a
            schedule, and showing only the first is a half-truth. */}
        {nextEvent && when && (
          <SurfaceLink
            href={`/events/${nextEvent.slug}`}
            className="dirsearch-card-event"
          >
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            <strong>{nextEvent.title}</strong>
            <span>{when}</span>
            {moreEvents > 0 && <span>+{moreEvents} more coming up</span>}
          </SurfaceLink>
        )}

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            {/* Faces, never names. Decorative by design -- no alt text, no
                link, nothing to click through to -- so the crowd reads as
                real without becoming a list of who to go find. */}
            {faces.length > 0 && (
              <span className="dirsearch-card-avatars" aria-hidden="true">
                {faces.map((face, index) => (
                  <img key={`${face}-${index}`} src={face} alt="" />
                ))}
              </span>
            )}
            <span className="dirsearch-card-counts">
              <strong>{group.memberCount.toLocaleString()}</strong>
              {group.memberCount === 1 ? ' member' : ' members'}
            </span>
          </div>

          <div className="dirsearch-card-actions">
            <JoinAction group={group} joined={joined} />
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
 *
 * Takes MyGroupSummary rather than a search result, because this list can say
 * things search results cannot: the reader's role, and that a private group
 * is one they are inside rather than one they might ask to join.
 */
export function GroupRow({ group }: { group: MyGroupSummary }) {
  const runsIt = group.role === 'admin' || group.role === 'moderator';

  return (
    <SurfaceLink
      href={`/g/${group.handle}`}
      className="profile-card hover:border-pana-indigo/30 flex items-center gap-3.5 p-3.5 transition-colors"
    >
      <img
        src={group.iconUrl || FALLBACK_LOGO}
        alt=""
        aria-hidden="true"
        className="border-pana-ink/10 h-11 w-11 flex-none rounded-xl border-2 object-cover"
      />

      <div className="min-w-0 flex-1">
        <h3 className="text-pana-ink truncate text-[14px] leading-tight font-extrabold">
          {group.name || group.handle}
        </h3>
        <div className="text-pana-ink/55 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-bold">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {group.memberCount.toLocaleString()}
          </span>
          {runsIt && (
            <span className="bg-pana-indigo/10 text-pana-indigo rounded-full px-2 py-0.5 capitalize">
              {group.role}
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
    </SurfaceLink>
  );
}

/**
 * A topic chip.
 *
 * The count is passed in from the facet query rather than counted on the
 * client, so a chip can never advertise a number the filter behind it does
 * not produce. Both pages read the same endpoint for the same reason.
 */
export function TopicChip({
  topic,
  count,
  active,
  onSelect,
}: {
  topic: string;
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
      {topic}
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
export function GroupEventRow({ event }: { event: UpcomingGroupEvent }) {
  const when = formatWhen(event.startsAt, event.timezone);

  /* An offline event with no venue row is not a data error -- the venue is
     optional and gets announced later -- so it says so rather than rendering
     an empty separator. */
  const where =
    event.venue?.name ??
    (event.mode === 'online' ? 'Online' : 'Location to be announced');

  return (
    <SurfaceLink
      href={`/events/${event.slug}`}
      className="profile-card hover:border-pana-indigo/30 flex items-center gap-3.5 p-4 transition-colors"
    >
      <div className="bg-pana-indigo/10 text-pana-indigo flex h-11 w-11 flex-none items-center justify-center rounded-xl">
        <CalendarDays className="h-5 w-5" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-pana-ink truncate text-[14px] leading-tight font-extrabold">
          {event.title}
        </h3>
        <p className="text-pana-ink/60 mt-0.5 truncate text-[12px] font-bold">
          {[when, where].filter(Boolean).join(' - ')}
        </p>
        <p className="text-pana-ink/45 mt-0.5 truncate text-[12px] font-bold">
          Hosted by {event.groupName || event.groupHandle}
          {event.attendeeCount > 0 && ` - ${event.attendeeCount} going`}
        </p>
      </div>
    </SurfaceLink>
  );
}

/**
 * The personal calendar: every upcoming event one pana is connected to, from
 * all three places events come from.
 *
 * There is only one `events` table. Directory listings, groups and panas are
 * distinguished by which host column is set — `host_profile_id` XOR
 * `host_group_id`, enforced by the `events_single_host` check in migration
 * 0047 — so a unified calendar is a filter, not an integration between three
 * systems. That is why this file is a query rather than a merge layer.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE
 *
 * Committed and suggested are returned as two lists and must never be merged
 * into one. A calendar answers "where have I said I will be", and a list that
 * mixes that with "this might interest you" cannot answer it — the user has to
 * re-derive which rows are promises every time they look. Interleaving them is
 * also how a quiet calendar gets padded out to look busy, which is a lie about
 * the one surface a person uses to plan their week.
 *
 * Suggested entries therefore also carry `because`. An unsolicited row that
 * cannot say why it is there is advertising.
 *
 * VISIBILITY
 *
 * `event_visibility` is public | unlisted; there are no private events, and
 * `docs/EVENTS-ROADMAP.md` explains why: NIP-52 has no concept of a private
 * calendar event or a private guest list, so inventing one locally would
 * promise a privacy the protocol cannot keep.
 *
 * Unlisted still means "not discoverable", so it is allowed in `committed` and
 * excluded from `suggested`. You can only have RSVP'd to an unlisted event by
 * being given the link, so showing it back to you reveals nothing you were not
 * already told. Suggesting one would reveal it to somebody who was not.
 */

import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  ne,
  or,
} from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  eventAttendees,
  events,
  socialActors,
  socialFollows,
  socialGroupMembers,
  socialGroups,
  type EventStatus,
  type EventMode,
} from '@/lib/schema';

/** Why an event is on your calendar. The committed reasons come first because
 *  they are the ones with your name attached to them. */
export type CalendarReason = 'hosting' | 'rsvp' | 'group' | 'following';

/** What the host is, which is a badge rather than a filter — "Clay & Kiln is
 *  running a class" and "Jules is hosting a repair café" are different kinds
 *  of invitation even though they are the same row shape. */
export type CalendarHostKind = 'pana' | 'group';

export interface CalendarEntry {
  id: string;
  slug: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  coverImage: string | null;
  mode: EventMode;
  /** Denormalised count of 'going' RSVPs, straight off the events row. The
   *  rail's rule is that every number is fetched rather than asserted, and
   *  this one already exists because the RSVP route maintains it. */
  attendeeCount: number;
  visibility: 'public' | 'unlisted';
  reason: CalendarReason;
  /** Only ever set on committed entries, and only for an actual RSVP. */
  rsvp: 'going' | 'maybe' | null;
  hostKind: CalendarHostKind;
  hostName: string;
  /** Handle for the host, so the row can link somewhere. */
  hostHandle: string | null;
  venueName: string | null;
  venueCity: string | null;
  /** Why this is being suggested. Null on committed entries, which need no
   *  justification — you put them there. */
  because: string | null;
}

export interface PersonalCalendar {
  committed: CalendarEntry[];
  suggested: CalendarEntry[];
}

type EventRow = typeof events.$inferSelect & {
  venue?: { name: string; city: string | null } | null;
  host?: { name: string | null } | null;
  hostGroup?: {
    actor?: { name: string | null; username: string } | null;
  } | null;
};

/* A group has no name of its own: social_groups carries only the membership
   and policy columns, and the display name and handle live on the actor it
   is. So reaching a group's name is always two hops, never one. */
const WITH_HOSTS = {
  venue: { columns: { name: true, city: true } },
  host: { columns: { name: true } },
  hostGroup: {
    columns: { id: true },
    with: { actor: { columns: { name: true, username: true } } },
  },
} as const;

/**
 * Flattens a row into the shape the UI renders.
 *
 * Host naming falls back rather than throwing: an event whose host row was
 * deleted still has a date somebody planned around, and dropping it from the
 * calendar would be a worse failure than showing it with a vague host.
 */
function toEntry(
  event: EventRow,
  reason: CalendarReason,
  rsvp: 'going' | 'maybe' | null,
  because: string | null,
  hostProfileName?: string | null,
  hostProfileHandle?: string | null
): CalendarEntry {
  const isGroupHosted = !!event.hostGroupId;

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    coverImage: event.coverImage,
    mode: event.mode,
    attendeeCount: event.attendeeCount,
    visibility: event.visibility,
    reason,
    rsvp,
    hostKind: isGroupHosted ? 'group' : 'pana',
    hostName: isGroupHosted
      ? (event.hostGroup?.actor?.name ?? 'A group')
      : (hostProfileName ?? event.host?.name ?? 'A pana'),
    hostHandle: isGroupHosted
      ? (event.hostGroup?.actor?.username ?? null)
      : (hostProfileHandle ?? null),
    venueName: event.venue?.name ?? null,
    venueCity: event.venue?.city ?? null,
    because,
  };
}

/**
 * Everything upcoming for one pana, in two lists.
 *
 * `actorId` is optional because an account that never enrolled in Pana Social
 * has no actor, and that is not an error — it has RSVPs and hosted events like
 * anyone else, just no groups or follows to draw suggestions from.
 */
export async function getPersonalCalendar({
  profileId,
  actorId,
  days = 60,
  limit = 50,
}: {
  profileId: string;
  actorId?: string | null;
  days?: number;
  limit?: number;
}): Promise<PersonalCalendar> {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + days);

  const upcoming = and(
    gte(events.startsAt, now),
    lte(events.startsAt, horizon),
    eq(events.status, 'published' as EventStatus)
  );

  // ---------------------------------------------------------------------
  // Committed: things you have actually said you will do.
  // ---------------------------------------------------------------------

  /* Both going and maybe. A maybe is the entry most worth showing, because it
     is the only one still waiting on a decision from you — dropping it would
     leave the calendar silent about the one thing it should be nagging about.
     Unverified rows are excluded: somebody who started the magic-link flow and
     never finished has not committed to anything. */
  const rsvpRows = await db
    .select({
      eventId: eventAttendees.eventId,
      status: eventAttendees.status,
    })
    .from(eventAttendees)
    .where(
      and(
        eq(eventAttendees.profileId, profileId),
        or(
          eq(eventAttendees.status, 'going'),
          eq(eventAttendees.status, 'maybe')
        ),
        isNotNull(eventAttendees.emailVerifiedAt)
      )
    );

  const rsvpByEvent = new Map(
    rsvpRows.map((row) => [row.eventId, row.status as 'going' | 'maybe'])
  );

  /* Hosting is a commitment too, and a stronger one than an RSVP. An organiser
     whose own calendar omitted the thing they are running would have to keep
     it somewhere else, which is the problem this page exists to solve. */
  const hosted = await db.query.events.findMany({
    where: and(upcoming, eq(events.hostProfileId, profileId)),
    orderBy: [asc(events.startsAt)],
    limit,
    with: WITH_HOSTS,
  });

  const hostedIds = new Set(hosted.map((event) => event.id));

  /* Deliberately unfiltered on visibility: an unlisted event you RSVP'd to is
     one you were handed the link for, so it belongs on your own calendar. */
  const rsvpIds = [...rsvpByEvent.keys()].filter((id) => !hostedIds.has(id));
  const attending = rsvpIds.length
    ? await db.query.events.findMany({
        where: and(upcoming, inArray(events.id, rsvpIds)),
        orderBy: [asc(events.startsAt)],
        limit,
        with: WITH_HOSTS,
      })
    : [];

  const committed = [
    ...hosted.map((event) => toEntry(event as EventRow, 'hosting', null, null)),
    ...attending.map((event) =>
      toEntry(
        event as EventRow,
        'rsvp',
        rsvpByEvent.get(event.id) ?? null,
        null
      )
    ),
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  if (!actorId) {
    return { committed, suggested: [] };
  }

  // ---------------------------------------------------------------------
  // Suggested: public events from the groups and panas you already chose.
  // ---------------------------------------------------------------------

  const committedIds = new Set(committed.map((entry) => entry.id));

  const memberships = await db
    .select({
      groupId: socialGroupMembers.groupId,
      name: socialActors.name,
    })
    .from(socialGroupMembers)
    .innerJoin(socialGroups, eq(socialGroups.id, socialGroupMembers.groupId))
    .innerJoin(socialActors, eq(socialActors.id, socialGroups.actorId))
    .where(
      and(
        eq(socialGroupMembers.actorId, actorId),
        eq(socialGroupMembers.status, 'active')
      )
    );

  const groupNames = new Map(memberships.map((row) => [row.groupId, row.name]));

  /* Public only, on both halves of the suggestion. An unlisted event is not
     discoverable by definition, and being in the host's group is not the same
     as having been given its link. */
  const groupEvents = memberships.length
    ? await db.query.events.findMany({
        where: and(
          upcoming,
          eq(events.visibility, 'public'),
          inArray(events.hostGroupId, [...groupNames.keys()])
        ),
        orderBy: [asc(events.startsAt)],
        limit,
        with: WITH_HOSTS,
      })
    : [];

  /* Follows resolve to actors; events are hosted by profiles. socialActors
     carries the profile id, so one join turns "who do I follow" into "whose
     events are these". Only accepted follows — a pending request is a question
     the other person has not answered. */
  const following = await db
    .select({
      profileId: socialActors.profileId,
      name: socialActors.name,
      username: socialActors.username,
    })
    .from(socialFollows)
    .innerJoin(socialActors, eq(socialActors.id, socialFollows.targetActorId))
    .where(
      and(
        eq(socialFollows.actorId, actorId),
        eq(socialFollows.status, 'accepted'),
        isNotNull(socialActors.profileId),
        ne(socialActors.id, actorId)
      )
    );

  const followedProfiles = new Map(
    following
      .filter((row) => row.profileId)
      .map((row) => [
        row.profileId as string,
        { name: row.name, username: row.username },
      ])
  );

  const followedEvents = followedProfiles.size
    ? await db.query.events.findMany({
        where: and(
          upcoming,
          eq(events.visibility, 'public'),
          inArray(events.hostProfileId, [...followedProfiles.keys()])
        ),
        orderBy: [asc(events.startsAt)],
        limit,
        with: WITH_HOSTS,
      })
    : [];

  const seen = new Set(committedIds);
  const suggested: CalendarEntry[] = [];

  for (const event of groupEvents) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const groupName = event.hostGroupId
      ? groupNames.get(event.hostGroupId)
      : null;
    suggested.push(
      toEntry(
        event as EventRow,
        'group',
        null,
        groupName ? `You're in ${groupName}` : "You're in this group"
      )
    );
  }

  for (const event of followedEvents) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const host = event.hostProfileId
      ? followedProfiles.get(event.hostProfileId)
      : null;
    const hostName = host?.name || host?.username || 'a pana';
    suggested.push(
      toEntry(
        event as EventRow,
        'following',
        null,
        `You follow ${hostName}`,
        host?.name ?? host?.username ?? null,
        host?.username ?? null
      )
    );
  }

  suggested.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return { committed, suggested };
}

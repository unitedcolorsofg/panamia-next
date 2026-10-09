/**
 * Why an event is on the page.
 *
 * This is the production port of app/mock/events/_reasons.ts, and the module
 * the discovery page at /e is built around. Everything else there is markup.
 *
 * A discover page lives or dies on one question: *why am I being shown this?*
 * The failure mode is familiar from every "For You" surface ever shipped -- a
 * ranked list with no stated cause, which the viewer has no way to check and
 * no way to correct, so it is trusted for about a week and then ignored. The
 * fix is not a better ranking. It is making the cause a first-class value that
 * the card has to render.
 *
 * So a `Reason` is computed here, server-side, from real rows, and if it
 * cannot be computed the event does not get a lane. That constraint is doing
 * real work: it is what stops a lane heading from promising a relationship the
 * data cannot actually demonstrate.
 *
 * Signals, with the table each comes from:
 *
 *   follow-host   social_follows -> events.host_profile_id / host_group_id
 *   panas-going   event_attendees ∩ social_follows, status 'going'
 *   tag-match     events.tags ∩ tags of events the viewer already attended
 *   new-host      count(events) by the same host, plus events.attendee_count
 *
 * Deliberately *not* a signal: raw popularity. It is the one thing every
 * ranker reaches for first and it is self-reinforcing -- the big event is
 * shown because it is big, so it gets bigger. On a directory whose whole
 * purpose is small local makers that is not a neutral default, it is the
 * opposite of the product. Attendance appears here only inverted, in
 * `new-host`, which looks for the small room rather than the full one. The
 * genuinely big events still get a lane, at the bottom, under a heading that
 * says you would have found them anyway.
 *
 * Reasons are computed once per request and are *window-independent* -- why an
 * event suits you does not change because you asked about Saturday instead of
 * tonight. That is what lets the page filter by window and rebuild lanes in
 * the browser without another round trip, and it is why `buildLanes` below is
 * a pure function over already-resolved reasons rather than another query.
 */

import { db } from '@/lib/db';
import {
  eventAttendees,
  eventDismissals,
  events,
  profiles,
  socialActors,
  socialFollows,
  socialGroups,
} from '@/lib/schema';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
} from 'drizzle-orm';
import type { EventStatus } from '@/lib/schema';

/** How many upcoming events the page reasons over. */
const CANDIDATE_LIMIT = 60;

/**
 * The timezone the windows are reckoned in.
 *
 * "Tonight" is a claim about the viewer, not about the event, so it needs one
 * answer rather than one per row. South Florida is what this directory is, and
 * it is already the default on `events.timezone`; a viewer reading from
 * elsewhere is looking at what is on *here*, which is the only reading of
 * "tonight" that makes sense on a page about places you can physically go.
 */
const SITE_TIMEZONE = 'America/New_York';

/*
 * The pure half lives in `./lanes`, which imports nothing, because the
 * client component needs `buildLanes` and must not drag this file's
 * database import into the browser bundle with it. Re-exported here so
 * server callers still have one place to import from.
 */
export type {
  DiscoveryEvent,
  DiscoveryPana,
  Lane,
  Reason,
  ReasonKind,
  WhenBucket,
} from './lanes';
export { LANE_COPY, buildLanes, seatsLeft } from './lanes';

import type {
  DiscoveryEvent,
  DiscoveryPana,
  Reason,
  WhenBucket,
} from './lanes';

/**
 * Everything the page needs, in one call.
 *
 * `viewerProfileId` null means signed out, which is a different state from
 * "signed in with no follows": the first cannot be computed, the second came
 * back empty. The page says so rather than showing the same bare list twice.
 */
export async function getDiscoveryFeed(
  viewerProfileId: string | null
): Promise<{
  events: DiscoveryEvent[];
  dismissedIds: string[];
}> {
  const now = new Date();

  const rows = await db.query.events.findMany({
    where: and(
      eq(events.status, 'published' as EventStatus),
      eq(events.visibility, 'public'),
      gte(events.startsAt, now)
    ),
    orderBy: [asc(events.startsAt)],
    limit: CANDIDATE_LIMIT,
    with: {
      venue: { columns: { name: true, city: true } },
      host: { columns: { id: true, name: true } },
      hostGroup: {
        columns: { id: true },
        with: { actor: { columns: { name: true, username: true } } },
      },
    },
  });

  if (rows.length === 0) return { events: [], dismissedIds: [] };

  const eventIds = rows.map((row) => row.id);
  const hostProfileIds = unique(
    rows.map((row) => row.hostProfileId).filter(isString)
  );
  const hostGroupIds = unique(
    rows.map((row) => row.hostGroupId).filter(isString)
  );

  const [pastCounts, viewer] = await Promise.all([
    countPastEventsByHost(hostProfileIds, hostGroupIds, now),
    viewerProfileId
      ? resolveViewerSignals(viewerProfileId, eventIds, now)
      : Promise.resolve(null),
  ]);

  const discovery = rows.map((row) => {
    const hostId = row.hostProfileId ?? row.hostGroupId ?? '';
    const isGroup = row.hostGroupId !== null;
    const hostName =
      (isGroup
        ? (row.hostGroup?.actor?.name ?? row.hostGroup?.actor?.username)
        : row.host?.name) ?? 'A pana';

    const event: DiscoveryEvent = {
      id: row.id,
      slug: row.slug,
      title: row.title,
      blurb: row.description ?? '',
      cover: row.coverImage,
      coverAlt: row.coverImageAlt,
      mode: row.mode,
      startsAt: row.startsAt.toISOString(),
      when: formatWhen(row.startsAt, row.timezone),
      day: formatDay(row.startsAt, row.timezone),
      bucket: bucketFor(row.startsAt, now),
      timezone: row.timezone,
      where:
        row.mode === 'online'
          ? 'Online'
          : row.venue
            ? [row.venue.name, row.venue.city].filter(Boolean).join(' · ')
            : 'Location to be announced',
      going: row.attendeeCount,
      cap: row.attendeeCap,
      tags: row.tags,
      host: { id: hostId, name: hostName, isGroup },
      reasons: [],
    };

    event.reasons = reasonsFor(event, {
      pastEvents: pastCounts.get(hostId) ?? 0,
      followsHost: viewer?.followedHostIds.has(hostId) ?? false,
      panas: viewer?.panasByEvent.get(row.id) ?? [],
      attended: viewer?.attended ?? [],
    });

    return event;
  });

  return {
    events: discovery,
    dismissedIds: viewer ? [...viewer.dismissedIds] : [],
  };
}

/** The viewer-dependent half of a reason. Separated so `reasonsFor` stays a
 *  pure function of resolved facts, testable without a database. */
interface ViewerFacts {
  pastEvents: number;
  followsHost: boolean;
  panas: DiscoveryPana[];
  attended: { title: string; tags: string[] }[];
}

/**
 * Every reason that holds for an event, strongest first.
 *
 * Order is the editorial judgement of the page and worth stating plainly:
 * a host you chose to follow beats people you know going, which beats a
 * subject you have turned up for before, which beats the page arguing on an
 * unknown host's behalf. Each event is then placed in exactly one lane, by its
 * strongest reason -- the same event appearing under three headings is the
 * fastest way to make a page of four lanes feel like a page of one.
 */
export function reasonsFor(
  event: DiscoveryEvent,
  facts: ViewerFacts
): Reason[] {
  const out: Reason[] = [];

  if (facts.followsHost)
    out.push({ kind: 'follow-host', host: event.host.name });

  /* Three rather than one: two panas going is a coincidence, and a lane that
     fires on a single RSVP turns every event one friend attends into a
     personalised recommendation. */
  if (facts.panas.length >= 3) {
    out.push({ kind: 'panas-going', panas: facts.panas });
  }

  const match = tagMatch(event, facts.attended);
  if (match) out.push({ kind: 'tag-match', ...match });

  if (facts.pastEvents <= 1 && event.going < 50) {
    out.push({
      kind: 'new-host',
      host: event.host.name,
      pastEvents: facts.pastEvents,
    });
  }

  return out;
}

/** Tags this event shares with something the viewer actually turned up to,
 *  plus which past event earned the match. Returns null when there is no
 *  overlap, so the caller cannot accidentally render an empty claim. */
function tagMatch(
  event: DiscoveryEvent,
  attended: { title: string; tags: string[] }[]
): { tags: string[]; from: string } | null {
  for (const past of attended) {
    const shared = event.tags.filter((tag) => past.tags.includes(tag));
    if (shared.length > 0) return { tags: shared, from: past.title };
  }
  return null;
}

/**
 * How many published events each host has already run.
 *
 * This is the field that makes the anti-popularity lane possible: it is the
 * only way to distinguish a quiet event by someone established from a first
 * event by someone who has never had an audience. Those two look identical
 * under any attendance-based ranking, and only one of them is a discovery.
 *
 * Counted over *past* events, so an organiser announcing six things at once
 * does not stop being new the moment they do it.
 */
async function countPastEventsByHost(
  hostProfileIds: string[],
  hostGroupIds: string[],
  now: Date
): Promise<Map<string, number>> {
  const out = new Map<string, number>();

  const byProfile = hostProfileIds.length
    ? await db
        .select({ hostId: events.hostProfileId, n: count() })
        .from(events)
        .where(
          and(
            inArray(events.hostProfileId, hostProfileIds),
            eq(events.status, 'published' as EventStatus),
            lt(events.startsAt, now)
          )
        )
        .groupBy(events.hostProfileId)
    : [];

  const byGroup = hostGroupIds.length
    ? await db
        .select({ hostId: events.hostGroupId, n: count() })
        .from(events)
        .where(
          and(
            inArray(events.hostGroupId, hostGroupIds),
            eq(events.status, 'published' as EventStatus),
            lt(events.startsAt, now)
          )
        )
        .groupBy(events.hostGroupId)
    : [];

  for (const row of [...byProfile, ...byGroup]) {
    if (row.hostId) out.set(row.hostId, row.n);
  }
  return out;
}

/**
 * Everything about the viewer that a reason can be built from.
 *
 * One function because these four queries share a cursor's worth of context
 * and all four are useless alone: a follow list with no RSVPs produces no
 * panas lane, and an attendance history with no upcoming tags produces no tag
 * lane. Resolving them together also keeps the page to a fixed number of
 * round trips rather than one per lane.
 */
async function resolveViewerSignals(
  viewerProfileId: string,
  eventIds: string[],
  now: Date
) {
  const viewerActor = await db.query.socialActors.findFirst({
    where: eq(socialActors.profileId, viewerProfileId),
    columns: { id: true },
  });

  const follows = viewerActor
    ? await db.query.socialFollows.findMany({
        where: and(
          eq(socialFollows.actorId, viewerActor.id),
          eq(socialFollows.status, 'accepted')
        ),
        columns: { targetActorId: true },
      })
    : [];

  const targetActorIds = unique(follows.map((f) => f.targetActorId));

  /* A follow points at an actor, and an actor is either a pana or a group.
     Both can host (migration 0047 enforces exactly one), so both have to be
     resolved or every group's events silently lose the strongest reason the
     page has. */
  const [followedProfiles, followedGroups] = await Promise.all([
    targetActorIds.length
      ? db.query.socialActors.findMany({
          where: and(
            inArray(socialActors.id, targetActorIds),
            isNotNull(socialActors.profileId)
          ),
          columns: { profileId: true },
        })
      : Promise.resolve([]),
    targetActorIds.length
      ? db.query.socialGroups.findMany({
          where: inArray(socialGroups.actorId, targetActorIds),
          columns: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const followedProfileIds = unique(
    followedProfiles.map((a) => a.profileId).filter(isString)
  );
  const followedHostIds = new Set<string>([
    ...followedProfileIds,
    ...followedGroups.map((g) => g.id),
  ]);

  const [goingRows, attendedRows, dismissals] = await Promise.all([
    /* Panas going. Restricted to the candidate events so this stays one small
       indexed read rather than a scan of every RSVP the viewer's circle has
       ever made. */
    followedProfileIds.length
      ? db
          .select({
            eventId: eventAttendees.eventId,
            id: profiles.id,
            name: profiles.name,
            screenname: profiles.screenname,
            avatar: profiles.primaryImageCdn,
          })
          .from(eventAttendees)
          .innerJoin(profiles, eq(profiles.id, eventAttendees.profileId))
          .where(
            and(
              inArray(eventAttendees.eventId, eventIds),
              inArray(eventAttendees.profileId, followedProfileIds),
              eq(eventAttendees.status, 'going')
            )
          )
      : Promise.resolve([]),
    /* Attendance history, newest first. Turned up to, not bookmarked: the
       whole point of this signal is that it produces "like the MIA Zine Fair
       you went to" rather than "because you like print". */
    db
      .select({ title: events.title, tags: events.tags })
      .from(eventAttendees)
      .innerJoin(events, eq(events.id, eventAttendees.eventId))
      .where(
        and(
          eq(eventAttendees.profileId, viewerProfileId),
          eq(eventAttendees.status, 'going'),
          lt(events.startsAt, now)
        )
      )
      .orderBy(desc(events.startsAt))
      .limit(20),
    db.query.eventDismissals.findMany({
      where: eq(eventDismissals.profileId, viewerProfileId),
      columns: { eventId: true },
    }),
  ]);

  const panasByEvent = new Map<string, DiscoveryPana[]>();
  for (const row of goingRows) {
    const list = panasByEvent.get(row.eventId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      screenname: row.screenname,
      avatar: row.avatar,
    });
    panasByEvent.set(row.eventId, list);
  }

  return {
    followedHostIds,
    panasByEvent,
    attended: attendedRows.map((row) => ({ title: row.title, tags: row.tags })),
    dismissedIds: new Set(dismissals.map((d) => d.eventId)),
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isString(value: string | null): value is string {
  return value !== null;
}

/**
 * The calendar date in a given timezone, as YYYY-MM-DD.
 *
 * `en-CA` rather than arithmetic on a Date: it is the one common locale whose
 * short date format is already ISO order, so this is a formatter call rather
 * than three getters and a pad, and it gets DST right because Intl does.
 */
function dateKey(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** 0 = Sunday, in the given timezone. */
function weekday(at: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(at);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/**
 * Which window an event falls in.
 *
 * The buckets are the viewer's situation, not even divisions of the calendar,
 * so they overlap in the way the words do and are resolved in order: an event
 * tonight is "tonight" even though it is also this week. `weekend` runs Friday
 * through Sunday and only means *this coming* one -- on a Monday the weekend
 * is five days away and still the weekend, but on the following Tuesday it is
 * gone rather than eleven days off.
 */
function bucketFor(startsAt: Date, now: Date): WhenBucket {
  const today = dateKey(now, SITE_TIMEZONE);
  const day = dateKey(startsAt, SITE_TIMEZONE);
  if (day === today) return 'today';

  const daysOut = Math.round(
    (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000
  );

  /* Days until the coming Sunday. Sunday itself counts as 0, so an event on a
     Sunday is still this weekend rather than next. */
  const todayDow = weekday(now, SITE_TIMEZONE);
  const untilSunday = (7 - todayDow) % 7;
  const eventDow = weekday(startsAt, SITE_TIMEZONE);
  if (daysOut <= untilSunday && eventDow >= 5) return 'weekend';

  if (daysOut <= 31) return 'month';
  return 'later';
}

/** "Fri 20 Feb, 7:00 PM", in the event's own timezone -- a show at 8pm in
 *  Miami is at 8pm on the page wherever it is read from. */
function formatWhen(at: Date, timeZone: string): string {
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(at);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(at);
  return `${date}, ${time}`;
}

/** "Fri 20" — the calendar tab's day heading. */
function formatDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
  }).format(at);
}

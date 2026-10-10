/**
 * Everything `/e/new` needs from the database before a host types anything.
 *
 * The host page shows, live, which lanes on `/e` a draft would land in. The
 * discovery page computes those lanes per *reader*, from follows, RSVPs and
 * attendance history — none of which a browser holds. So the obvious build is
 * a debounced round trip that re-asks the server on every keystroke, and that
 * is the wrong shape here, because nothing a host can type changes any of it.
 * A title does not move a follower count. A tag does not change how many
 * events somebody has hosted.
 *
 * So the split is: this module resolves the slow, viewer-shaped facts once, on
 * the server, at page load; `./host-draft` then recomputes lanes in the
 * browser as fast as the host can type, using the same pure `reasonsFor` the
 * discovery page ranks with. One query pass, no debounce, no loading state on
 * a readout whose whole job is to answer instantly.
 *
 * One honest approximation is worth naming. On `/e`, `tag-match` fires when an
 * event shares a tag with something *this reader* turned up to. The host page
 * has no reader, so it answers the question it actually can: is this tag one
 * that people here have turned up for before? `provenBy` counts the distinct
 * panas who RSVPed going to a past event carrying that tag. That is a weaker
 * claim than the lane makes and it is stated as a weaker claim — the readout
 * says the tag is matchable, never that a particular person will match it.
 */

import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  eventAttendees,
  events,
  profiles,
  socialFollows,
  socialGroups,
  venues,
} from '@/lib/schema';
import type { EventStatus } from '@/lib/schema';
import { listHostableGroups } from '@/lib/server/event-host';
import { countPastEventsByHost } from './discovery';
import type { HostContext, HostIdentity } from './host-draft';

/* The shapes live in `./host-draft`, which imports nothing but `./lanes`, so
   the client half can hold them without acquiring an edge to this file's
   database import. Re-exported here because server callers resolve the
   context, and asking them to import the type from a different module than
   the function would be a small, permanent papercut. */
export type {
  HostContext,
  HostIdentity,
  TagOption,
  VenueOption,
} from './host-draft';

/** Upcoming events the corpus figures are drawn from. Matches the discovery
 *  page's own candidate window, so "cards here run about N characters" is a
 *  claim about the same set of cards the host is about to join. */
const CORPUS_LIMIT = 60;

/** Past RSVPs scanned to work out which tags readers have actually turned up
 *  for. Bounded because this is a hint under a chip, not an analytic. */
const ATTENDANCE_LIMIT = 2000;

/** Tag chips offered. The long tail is real but a wall of eighty chips is a
 *  worse prompt than twelve. */
const TAG_CHOICES = 12;

/**
 * Resolve the context, or null when this user cannot host at all.
 *
 * Null means no profile row, which `POST /api/events` rejects with 403. The
 * page says so itself rather than letting someone fill in twelve fields and
 * find out at submit.
 */
export async function getHostContext(
  userId: string
): Promise<HostContext | null> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { id: true, name: true },
    with: { socialActor: { columns: { id: true } } },
  });
  if (!profile) return null;

  const now = new Date();

  const [identities, venueRows, corpus, proven] = await Promise.all([
    resolveIdentities(profile, now),
    db
      .select({
        id: venues.id,
        name: venues.name,
        city: venues.city,
        state: venues.state,
      })
      .from(venues)
      .where(eq(venues.status, 'active'))
      .orderBy(venues.name)
      .limit(200),
    db
      .select({
        tags: events.tags,
        description: events.description,
        coverImage: events.coverImage,
      })
      .from(events)
      .where(
        and(
          eq(events.status, 'published' as EventStatus),
          eq(events.visibility, 'public'),
          gte(events.startsAt, now)
        )
      )
      .orderBy(events.startsAt)
      .limit(CORPUS_LIMIT),
    countProvenTags(now),
  ]);

  const upcomingByTag = new Map<string, number>();
  for (const row of corpus) {
    for (const tag of row.tags) {
      upcomingByTag.set(tag, (upcomingByTag.get(tag) ?? 0) + 1);
    }
  }

  /* Every tag either side knows about, ranked by whether it has ever actually
     earned somebody a lane, then by how live it is. A tag nobody has turned up
     for is still offered — it has to be, or no new subject could ever start —
     but it sorts below the ones that work. */
  const tags = [...new Set([...upcomingByTag.keys(), ...proven.keys()])]
    .map((tag) => ({
      tag,
      upcoming: upcomingByTag.get(tag) ?? 0,
      provenBy: proven.get(tag) ?? 0,
    }))
    .sort((a, b) => b.provenBy - a.provenBy || b.upcoming - a.upcoming)
    .slice(0, TAG_CHOICES);

  const blurbs = corpus
    .map((row) => (row.description ?? '').trim().length)
    .filter((length) => length > 0);

  return {
    identities,
    venues: venueRows,
    tags,
    typicalBlurb: blurbs.length
      ? Math.round(blurbs.reduce((n, length) => n + length, 0) / blurbs.length)
      : 0,
    withCover: corpus.filter((row) => row.coverImage !== null).length,
    upcoming: corpus.length,
  };
}

/**
 * Who this person can post as, with the two numbers that decide two lanes.
 *
 * The group list comes from `listHostableGroups`' own rule — admin and
 * moderator, active membership — by way of the same table, because the create
 * route re-derives it server-side and a selector offering a group the route
 * will reject is worse than no selector.
 */
async function resolveIdentities(
  profile: { id: string; name: string; socialActor: { id: string } | null },
  now: Date
): Promise<HostIdentity[]> {
  const groups = await listHostableGroups(profile.id);

  const groupActors = groups.length
    ? await db
        .select({ id: socialGroups.id, actorId: socialGroups.actorId })
        .from(socialGroups)
        .where(
          inArray(
            socialGroups.id,
            groups.map((group) => group.id)
          )
        )
    : [];

  const actorIdByGroup = new Map(
    groupActors.map((row) => [row.id, row.actorId])
  );
  const actorIds = [
    ...(profile.socialActor ? [profile.socialActor.id] : []),
    ...groupActors.map((row) => row.actorId),
  ];

  const [followerRows, pastEvents] = await Promise.all([
    actorIds.length
      ? db
          .select({ targetActorId: socialFollows.targetActorId })
          .from(socialFollows)
          .where(
            and(
              inArray(socialFollows.targetActorId, actorIds),
              eq(socialFollows.status, 'accepted')
            )
          )
      : Promise.resolve([]),
    countPastEventsByHost(
      [profile.id],
      groups.map((group) => group.id),
      now
    ),
  ]);

  const followers = new Map<string, number>();
  for (const row of followerRows) {
    followers.set(
      row.targetActorId,
      (followers.get(row.targetActorId) ?? 0) + 1
    );
  }

  /* Self first, always. Posting in your own name is the default the create
     route falls back to, and a list that led with a group would make the
     quietest, most consequential control on the form look pre-answered. */
  return [
    {
      id: '',
      name: profile.name,
      kind: 'self' as const,
      followers: profile.socialActor
        ? (followers.get(profile.socialActor.id) ?? 0)
        : 0,
      pastEvents: pastEvents.get(profile.id) ?? 0,
    },
    ...groups.map((group) => {
      const actorId = actorIdByGroup.get(group.id);
      return {
        id: group.id,
        name: group.name,
        kind: 'group' as const,
        followers: actorId ? (followers.get(actorId) ?? 0) : 0,
        pastEvents: pastEvents.get(group.id) ?? 0,
      };
    }),
  ];
}

/**
 * Distinct panas who have turned up to a past event carrying each tag.
 *
 * Turned up to, not bookmarked: `status = 'going'` on an event that has
 * already happened. That is the same evidence the `tag-match` lane runs on, so
 * a tag with a number beside it here is a tag that has genuinely earned
 * somebody a lane before, rather than one that merely appears a lot.
 *
 * Counted per person rather than per RSVP so one enthusiast attending nine
 * print nights does not make `print` look like nine people's interest.
 */
async function countProvenTags(now: Date): Promise<Map<string, number>> {
  const rows = await db
    .select({ profileId: eventAttendees.profileId, tags: events.tags })
    .from(eventAttendees)
    .innerJoin(events, eq(events.id, eventAttendees.eventId))
    .where(
      and(
        eq(eventAttendees.status, 'going'),
        eq(events.status, 'published' as EventStatus),
        lt(events.startsAt, now)
      )
    )
    .orderBy(desc(events.startsAt))
    .limit(ATTENDANCE_LIMIT);

  const peopleByTag = new Map<string, Set<string>>();
  for (const row of rows) {
    /* A guest RSVP has no profile row, so it has no history to match a lane
       against later. Skipping keeps this count to panas the tag lane could
       actually reach. */
    if (!row.profileId) continue;
    for (const tag of row.tags ?? []) {
      const people = peopleByTag.get(tag) ?? new Set<string>();
      people.add(row.profileId);
      peopleByTag.set(tag, people);
    }
  }

  return new Map(
    [...peopleByTag].map(([tag, people]) => [tag, people.size] as const)
  );
}

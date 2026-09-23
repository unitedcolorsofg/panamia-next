/**
 * Batched reads for a page of directory results.
 *
 * The profile page can afford a query per listing because it only ever shows
 * one. A page of search results shows twenty, and the same helpers called in a
 * loop would turn one screen into sixty round trips. Every function here takes
 * the whole page of profile ids and answers in a single query, returning a Map
 * keyed by profile id so callers can stitch without another pass.
 *
 * All of this data already existed — on the profile page, in profile_signals,
 * in events. None of it had ever been joined into search, which is why the
 * directory card had nothing to show but a name and a photo.
 */

import { db } from '@/lib/db';
import { events, profiles, profileSignals, venues } from '@/lib/schema';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
} from 'drizzle-orm';

export interface DirectorySignalCounts {
  saves: number;
  recommends: number;
}

/**
 * Save and recommend counts for many listings at once.
 *
 * Grouped by profile and kind in one pass, so the pair for a given listing can
 * never be read from two different snapshots and disagree.
 */
export async function getSignalCountsForProfiles(
  profileIds: string[]
): Promise<Map<string, DirectorySignalCounts>> {
  const counts = new Map<string, DirectorySignalCounts>();
  if (profileIds.length === 0) return counts;

  const rows = await db
    .select({
      profileId: profileSignals.profileId,
      kind: profileSignals.kind,
      total: count(),
    })
    .from(profileSignals)
    .where(inArray(profileSignals.profileId, profileIds))
    .groupBy(profileSignals.profileId, profileSignals.kind);

  for (const row of rows) {
    const entry = counts.get(row.profileId) ?? { saves: 0, recommends: 0 };
    if (row.kind === 'save') entry.saves = row.total;
    if (row.kind === 'recommend') entry.recommends = row.total;
    counts.set(row.profileId, entry);
  }

  return counts;
}

/**
 * Avatars of the panas who recommend each listing, for the face row.
 *
 * Recommendations only — saves are private, and publishing the faces of
 * everyone who bookmarked a business would turn a private act into a public
 * one after the fact. Mirrors getRecommenderAvatars on the profile page.
 *
 * Fetched for the whole page and sliced per listing in memory. Postgres can do
 * a per-group limit with a window function, but at four faces across twenty
 * listings the row count is small and the simpler query is easier to trust.
 */
export async function getRecommenderAvatarsForProfiles(
  profileIds: string[],
  perProfile = 4
): Promise<Map<string, string[]>> {
  const avatars = new Map<string, string[]>();
  if (profileIds.length === 0) return avatars;

  const rows = await db
    .select({
      profileId: profileSignals.profileId,
      image: profiles.primaryImageCdn,
    })
    .from(profileSignals)
    .innerJoin(profiles, eq(profiles.userId, profileSignals.userId))
    .where(
      and(
        inArray(profileSignals.profileId, profileIds),
        eq(profileSignals.kind, 'recommend'),
        isNotNull(profiles.primaryImageCdn)
      )
    )
    .orderBy(desc(profileSignals.createdAt));

  for (const row of rows) {
    if (!row.image) continue;
    const list = avatars.get(row.profileId) ?? [];
    if (list.length >= perProfile) continue;
    list.push(row.image);
    avatars.set(row.profileId, list);
  }

  return avatars;
}

export interface DirectoryEvent {
  slug: string;
  title: string;
  startsAt: Date;
  timezone: string;
  online: boolean;
  venueCity: string | null;
}

/**
 * The next public event each listing is hosting, within three months.
 *
 * Same horizon as the profile page, for the same reason: "upcoming" with no
 * bound is a promise the card cannot keep, and a date eleven months out tells
 * a visitor nothing about whether to go this weekend.
 *
 * Only the soonest event per host — a search result has room for one line, and
 * the next one is the one that decides whether you click.
 */
export async function getNextEventForHosts(
  hostProfileIds: string[],
  options: { withinMonths?: number } = {}
): Promise<Map<string, DirectoryEvent>> {
  const nextEvents = new Map<string, DirectoryEvent>();
  if (hostProfileIds.length === 0) return nextEvents;

  const { withinMonths = 3 } = options;
  const now = new Date();
  const horizon = new Date(now);
  horizon.setMonth(horizon.getMonth() + withinMonths);

  const rows = await db
    .select({
      hostProfileId: events.hostProfileId,
      slug: events.slug,
      title: events.title,
      startsAt: events.startsAt,
      timezone: events.timezone,
      mode: events.mode,
      venueCity: venues.city,
    })
    .from(events)
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(
      and(
        inArray(events.hostProfileId, hostProfileIds),
        eq(events.status, 'published'),
        eq(events.visibility, 'public'),
        gte(events.startsAt, now),
        lte(events.startsAt, horizon)
      )
    )
    .orderBy(asc(events.startsAt));

  // Ascending by start, so the first row seen for a host is its soonest.
  for (const row of rows) {
    if (!row.hostProfileId) continue;
    if (nextEvents.has(row.hostProfileId)) continue;
    nextEvents.set(row.hostProfileId, {
      slug: row.slug,
      title: row.title,
      startsAt: row.startsAt,
      timezone: row.timezone,
      online: row.mode === 'online',
      venueCity: row.venueCity ?? null,
    });
  }

  return nextEvents;
}

/**
 * Every listing with a public event in the horizon, as a set of ids.
 *
 * The "has events coming up" filter has to be applied before pagination, so it
 * cannot use getNextEventForHosts — that one only knows about the page it was
 * handed. This asks the opposite question and returns ids only, which keeps it
 * to a single small query no matter how large the filtered set is.
 */
export async function getHostsWithUpcomingEvents(
  options: { withinMonths?: number } = {}
): Promise<Set<string>> {
  const { withinMonths = 3 } = options;
  const now = new Date();
  const horizon = new Date(now);
  horizon.setMonth(horizon.getMonth() + withinMonths);

  const rows = await db
    .selectDistinct({ hostProfileId: events.hostProfileId })
    .from(events)
    .where(
      and(
        isNotNull(events.hostProfileId),
        eq(events.status, 'published'),
        eq(events.visibility, 'public'),
        gte(events.startsAt, now),
        lte(events.startsAt, horizon)
      )
    );

  return new Set(
    rows
      .map((row) => row.hostProfileId)
      .filter((id): id is string => id !== null)
  );
}

/**
 * Fixtures for the host mock at `/mock/events/host`.
 *
 * Almost nothing here is typed out. The tag vocabulary, the venue list and
 * every count beside them are derived from `MOCK_EVENTS` — the same fixtures
 * the discovery mock renders — because the whole claim this page makes is that
 * what a host fills in decides where their event lands on that page. A host
 * page with its own invented tags and its own invented venues could not make
 * that claim honestly: it would be two unrelated screens that happen to share
 * a colour scheme.
 *
 * The only genuinely new fixture is `HOST_IDENTITIES`, because "who am I
 * posting as" is a question the discovery page never has to ask.
 */

import {
  HOSTS,
  MOCK_EVENTS,
  type EventCounty,
  type EventType,
  type MockEvent,
  type WhenBucket,
} from '../_data';

/**
 * The profiles and groups this account may post as — the real form's
 * "Hosting as" select, which lists your own profile plus any group you admin.
 *
 * Two entries rather than one, and that is the point of the fixture: Lucía has
 * hosted once, Taller Lucía has hosted fourteen times, so switching identity
 * flips the "New hosts, small rooms" lane on and off in front of the host.
 * Which identity you post as is currently the least conspicuous control on the
 * form and the one with the largest effect on who sees the result.
 *
 * `followers` is a count of `socialFollows` rows pointing at the profile or
 * group. It is the one number on this page not derivable from `MOCK_EVENTS`,
 * because following is a social-graph fact rather than an events fact.
 */
export interface HostIdentity {
  /** HOSTS.id */
  id: string;
  /** socialFollows rows pointing at this profile or group. */
  followers: number;
}

export const HOST_IDENTITIES: HostIdentity[] = [
  { id: 'lucia', followers: 34 },
  { id: 'taller', followers: 212 },
];

/** The host record behind an identity, so the mock never carries a second copy
 *  of a name or a `pastEvents` count that could drift from `HOSTS`. */
export function hostFor(id: string) {
  const host = HOSTS.find((h) => h.id === id);
  if (!host) throw new Error(`Unknown host identity: ${id}`);
  return host;
}

export function followersFor(id: string): number {
  return HOST_IDENTITIES.find((h) => h.id === id)?.followers ?? 0;
}

/**
 * Every tag already in use this week, with how many events carry it.
 *
 * Derived rather than listed, so the picker cannot offer a tag that would
 * match nothing, and the hint beside each one ("on 2 others") is a fact about
 * the page the host is about to appear on rather than an encouragement.
 */
export const TAG_VOCABULARY: { tag: string; used: number }[] = Array.from(
  MOCK_EVENTS.reduce((acc, event) => {
    for (const tag of event.tags) acc.set(tag, (acc.get(tag) ?? 0) + 1);
    return acc;
  }, new Map<string, number>())
)
  .map(([tag, used]) => ({ tag, used }))
  .sort((a, b) => b.used - a.used || a.tag.localeCompare(b.tag));

/**
 * The venues already hosting something this week.
 *
 * Derived from the events themselves for the same reason as the tags: a venue
 * picker is where a host is most likely to be told something false about the
 * county their event gets filtered into, and deriving it means the county
 * travels with the venue instead of being chosen twice.
 */
export const VENUES: { where: string; county: EventCounty }[] = Array.from(
  MOCK_EVENTS.filter((event) => event.county !== 'online').reduce(
    (acc, event) => {
      if (!acc.has(event.where)) acc.set(event.where, event.county);
      return acc;
    },
    new Map<string, EventCounty>()
  )
).map(([where, county]) => ({ where, county }));

/** The form's own fields, named for the columns they write to. One per control
 *  in `components/events/EventForm.tsx`, so the mock cannot quietly propose a
 *  field the product does not have or drop one it does. */
export interface HostDraft {
  /** events.hostProfileId or events.hostGroupId. */
  hostId: string;
  /** events.title */
  title: string;
  /** events.description */
  blurb: string;
  /** events.startsAt, pre-formatted the way `MockEvent.when` is. */
  when: string;
  /** Which When chip that start time answers to. */
  bucket: WhenBucket;
  /** Short label for the date strip. */
  day: string;
  /** events.endsAt. Optional in the real form, so optional here. */
  endsAt: string;
  /** events.mode */
  mode: MockEvent['mode'];
  /** venues.name · venues.city, or "Online". */
  where: string;
  /** venues.county */
  county: EventCounty;
  /** events.attendeeCap. Null means uncapped. */
  cap: number | null;
  /** events.tags */
  tags: string[];
  /** events.coverImage */
  cover: string | null;
  /** events.coverAlt */
  coverAlt: string;
  /** events.visibility */
  visibility: 'public' | 'unlisted';
  type: EventType;
}

/**
 * The draft as the current form would let it be submitted.
 *
 * This is the starting state on purpose. `EventForm` validates exactly one
 * thing — "A title and start time are required" — so this object is a legal,
 * publishable event today, and it qualifies for none of the lanes a reader
 * will ever browse. The gap between what the form accepts and what the
 * discovery page can do anything with is the whole argument of this mock, and
 * it is easier to agree with when the page opens already standing in it.
 */
export const INITIAL_DRAFT: HostDraft = {
  hostId: 'lucia',
  title: 'Risograph open studio',
  blurb: '',
  when: 'Sat 21 Feb, 2:00 PM',
  bucket: 'weekend',
  day: 'Sat 21',
  endsAt: '',
  mode: 'offline',
  where: 'Taller Lucía · Little Havana',
  county: 'miami_dade',
  cap: null,
  tags: [],
  cover: null,
  coverAlt: '',
  visibility: 'public',
  type: 'workshop',
};

/** A cover the host could actually pick, reused from the fixtures so the
 *  preview shows a real image at the real aspect ratio rather than a grey box
 *  standing in for one. */
export const SAMPLE_COVER = '/img/impact/culture-zines-right.webp';

/**
 * The draft as a row of `events`.
 *
 * One function, used by both the preview card and the lane readout, so the
 * card the host is shown and the lanes they are promised are computed from the
 * same object. Anything that could be true in only one of those two places is
 * a bug this mock exists to make visible.
 */
export function draftAsEvent(draft: HostDraft): MockEvent {
  return {
    id: 'draft',
    slug: 'draft',
    title: draft.title.trim() || 'Untitled event',
    cover: draft.cover,
    blurb: draft.blurb.trim(),
    mode: draft.mode,
    when: draft.when,
    bucket: draft.bucket,
    day: draft.day,
    where: draft.mode === 'online' ? 'Online' : draft.where,
    county: draft.mode === 'online' ? 'online' : draft.county,
    /* Zero, and left zero. A preview that invents attendance to look healthy
       is showing the host a card that does not exist. */
    going: 0,
    cap: draft.cap,
    tags: draft.tags,
    type: draft.type,
    host: draft.hostId,
    panasGoing: [],
  };
}

export const MOCK_PATH = '/e/new';

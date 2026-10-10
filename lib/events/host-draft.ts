/**
 * A draft, and what filling it in actually buys.
 *
 * Pure, and importing only `./lanes`, because every function here runs in the
 * browser on every keystroke. The slow half — follower counts, past events,
 * which tags readers have turned up for — is resolved once on the server by
 * `./host-context` and passed in, because none of it changes in response to
 * anything a host types.
 *
 * Two rules keep the readout honest.
 *
 * **It calls the real matcher.** `reasonsFor` is the function `/e` ranks with,
 * so the tag lane and the new-host lane are not re-derived here against
 * thresholds that could drift. Where this file decides something itself — the
 * follow lane, the panas lane — it is because those depend on the *reader*,
 * and a reader-shaped question cannot be answered from the host's side at all.
 * Saying so is the useful answer.
 *
 * **It never promises attendance.** Every lane says who can reach it and on
 * what evidence. None of them say an event will be popular, because a host
 * page that implies "fill this in and people will come" is a worse lie than
 * the blank form it replaced.
 *
 * What was rejected, recorded so it is not re-proposed:
 *
 * - *A score.* "Event strength: 62%" compresses four unrelated questions into
 *   one number, and a number cannot be argued with, so a host optimises the
 *   number instead of describing their event. Every readout here names a lane,
 *   the evidence, and the edit.
 * - *Required tags.* Tempting, since the tag lane is the one most often lost.
 *   But a required field produces "Event" and "Thing" as tags within a week,
 *   which poisons the lane for everyone. It stays optional and the cost of
 *   skipping it is stated instead.
 */

import {
  LANE_COPY,
  SITE_TIMEZONE,
  bucketFor,
  formatDay,
  formatWhen,
  reasonsFor,
  type DiscoveryEvent,
  type Reason,
} from './lanes';

/**
 * One identity a host may post as.
 *
 * `id` is empty string for the host's own profile, which is exactly what
 * `POST /api/events` expects: the create route treats a missing `hostGroupId`
 * as "host as myself", so the sentinel and the wire format agree and nothing
 * has to translate between them.
 */
export interface HostIdentity {
  id: string;
  name: string;
  kind: 'self' | 'group';
  followers: number;
  pastEvents: number;
}

/** A tag, with both reasons a host might pick it. */
export interface TagOption {
  tag: string;
  /** Upcoming events already carrying it. Says the tag is alive. */
  upcoming: number;
  /** Distinct panas who turned up to a past event carrying it. Says the tag
   *  can actually win the match lane. */
  provenBy: number;
}

export interface VenueOption {
  id: string;
  name: string;
  city: string;
  state: string;
}

/**
 * Everything the form needs that only the database knows.
 *
 * Declared here rather than in `./host-context` so the dependency runs one
 * way: the pure module has no edge at all to the module that imports
 * `@/lib/db`. A `import type` would be erased too, but it is an edge somebody
 * can turn into a value import without noticing, and the failure mode is a
 * Postgres driver in the browser bundle dying on `Buffer`.
 */
export interface HostContext {
  identities: HostIdentity[];
  venues: VenueOption[];
  tags: TagOption[];
  /** Mean blurb length across upcoming cards. Derived so the page cannot
   *  advise a host to match a norm no card on `/e` meets. */
  typicalBlurb: number;
  /** Upcoming cards carrying a cover, and how many there are in total. */
  withCover: number;
  upcoming: number;
}

/**
 * The form's state, field for field.
 *
 * Deliberately the same twelve values `POST /api/events` accepts — none added,
 * none dropped. The redesign is in what the page says about them, not in
 * collecting more.
 */
export interface HostDraft {
  /** '' hosts as the signed-in pana; otherwise a group id. */
  hostId: string;
  title: string;
  description: string;
  /** `datetime-local` strings, in the host's own timezone. */
  startsAt: string;
  endsAt: string;
  timezone: string;
  mode: 'offline' | 'online' | 'hybrid';
  venueId: string;
  attendeeCap: number | null;
  tags: string[];
  coverImage: string;
  coverImageAlt: string;
  visibility: 'public' | 'unlisted';
}

export function emptyDraft(timezone: string): HostDraft {
  return {
    hostId: '',
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    timezone,
    mode: 'offline',
    venueId: '',
    attendeeCap: null,
    tags: [],
    coverImage: '',
    coverImageAlt: '',
    visibility: 'public',
  };
}

export function identityFor(
  context: HostContext,
  hostId: string
): HostIdentity {
  return (
    context.identities.find((identity) => identity.id === hostId) ??
    context.identities[0]
  );
}

/**
 * The draft as the discovery page would see it.
 *
 * The single mapping from form fields to a row, used by both the preview and
 * the reach readout, so the card a host is shown and the lanes they are
 * promised cannot be computed from two different readings of the same draft.
 *
 * `going: 0` is the truth and worth leaving visible. Nothing is published yet,
 * nobody has RSVPed, and a preview that invented an attendance figure would be
 * the first lie on a page whose argument is that the form should tell you what
 * will really happen.
 */
export function draftAsEvent(
  draft: HostDraft,
  context: HostContext,
  now: Date = new Date()
): DiscoveryEvent {
  const identity = identityFor(context, draft.hostId);
  const venue = context.venues.find((v) => v.id === draft.venueId);

  /* An empty or half-typed datetime-local parses to Invalid Date, which would
     render as "Invalid Date" on the card. Falling back to now keeps the
     preview a plausible card while the field is still being filled in; the
     form states separately that a start time is required. */
  const parsed = draft.startsAt ? new Date(draft.startsAt) : null;
  const startsAt =
    parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(now);

  const timezone = draft.timezone || SITE_TIMEZONE;

  return {
    id: 'draft',
    slug: '',
    title: draft.title.trim() || 'Untitled event',
    blurb: draft.description.trim(),
    cover: draft.coverImage.trim() || null,
    coverAlt: draft.coverImageAlt.trim() || null,
    mode: draft.mode,
    startsAt: startsAt.toISOString(),
    when: formatWhen(startsAt, timezone),
    day: formatDay(startsAt, timezone),
    bucket: bucketFor(startsAt, now),
    timezone,
    where:
      draft.mode === 'online'
        ? 'Online'
        : venue
          ? [venue.name, venue.city].filter(Boolean).join(' · ')
          : 'Location to be announced',
    going: 0,
    cap: draft.attendeeCap,
    tags: draft.tags,
    host: { id: identity.id, name: identity.name, isGroup: identity.id !== '' },
    reasons: [],
  };
}

export interface LaneProspect {
  id: string;
  /** The lane heading, taken from `LANE_COPY` so it matches what a reader
   *  sees rather than a name invented for the host's benefit. */
  title: string;
  qualifies: boolean;
  /** Who this reaches and on what evidence, in specifics. Never a score. */
  detail: string;
  /**
   * Whether the form can still change the answer.
   *
   * The split is the most useful thing on this page. Two of these lanes are
   * decided by fields the host is looking at right now; two are decided by
   * other people after the event is posted. Presenting all four as one
   * checklist would tell a first-time host to go and fix something that is not
   * theirs to fix.
   */
  decidedBy: 'form' | 'people';
  /** The edit that would earn the lane, when there is one. */
  fix?: string;
}

/** Tags that have actually earned somebody a lane before, best first. Used to
 *  make the "add a tag" prompt name real tags rather than invite invention. */
export function provenTags(context: HostContext): TagOption[] {
  return context.tags.filter((tag) => tag.provenBy > 0);
}

function find<K extends Reason['kind']>(
  reasons: Reason[],
  kind: K
): Extract<Reason, { kind: K }> | undefined {
  return reasons.find((r) => r.kind === kind) as
    Extract<Reason, { kind: K }> | undefined;
}

/**
 * Every lane, whether or not this draft reaches it.
 *
 * All four always, including the ones it fails. A readout that only listed
 * what the draft had won would be a congratulation; the useful page is the one
 * that shows the lane it is missing and what would earn it — and shows the
 * lane no form can reach, so a host stops looking for the field that buys it.
 */
export function prospectsFor(
  draft: HostDraft,
  context: HostContext,
  now: Date = new Date()
): LaneProspect[] {
  const identity = identityFor(context, draft.hostId);
  const event = draftAsEvent(draft, context, now);

  /* The viewer this is reckoned against is a hypothetical reader who has
     turned up to something tagged the way this draft is tagged. That is the
     weakest reader who could possibly match, which makes the answer a floor
     rather than a boast: if even they do not match, nobody does. */
  const matchable = draft.tags
    .map((tag) => context.tags.find((option) => option.tag === tag))
    .filter((option): option is TagOption => option !== undefined)
    .filter((option) => option.provenBy > 0)
    .sort((a, b) => b.provenBy - a.provenBy);

  const reasons = reasonsFor(event, {
    pastEvents: identity.pastEvents,
    followsHost: identity.followers > 0,
    panas: [],
    attended: matchable.length
      ? [{ title: 'an event you went to', tags: matchable.map((t) => t.tag) }]
      : [],
  });

  const follow = find(reasons, 'follow-host');
  const tagMatch = find(reasons, 'tag-match');
  const newHost = find(reasons, 'new-host');

  const untested = draft.tags.filter(
    (tag) => !matchable.some((option) => option.tag === tag)
  );
  const suggestions = provenTags(context)
    .slice(0, 3)
    .map((option) => option.tag);

  return [
    {
      id: LANE_COPY['follow-host'].id,
      title: LANE_COPY['follow-host'].title,
      qualifies: follow !== undefined,
      detail: follow
        ? `${identity.followers} ${identity.followers === 1 ? 'pana follows' : 'panas follow'} ${identity.name}. They get it at the top of their page because they asked for it, not because anything was guessed.`
        : `Nobody follows ${identity.name} yet, so this lane is empty for now.`,
      decidedBy: 'form',
      fix: follow
        ? undefined
        : context.identities.length > 1
          ? 'Posting as a group you already run reaches its followers instead.'
          : undefined,
    },
    {
      id: LANE_COPY['tag-match'].id,
      title: LANE_COPY['tag-match'].title,
      qualifies: tagMatch !== undefined,
      detail: tagMatch
        ? `${matchable[0].provenBy} ${matchable[0].provenBy === 1 ? 'pana has' : 'panas have'} turned up to something tagged ${matchable[0].tag}. This lane can see the event, and reaches each of them only if it is their own history that matches.`
        : draft.tags.length === 0
          ? 'With no tags there is nothing to match on, so this lane cannot see the event at all.'
          : `Nobody has turned up to a past event tagged ${untested.join(' or ')} yet, so there is no history for this lane to match against.`,
      decidedBy: 'form',
      fix: tagMatch
        ? undefined
        : suggestions.length
          ? `Add a tag. ${suggestions.join(', ')} ${suggestions.length === 1 ? 'is what readers' : 'are what readers'} here have turned up for before.`
          : 'Add a tag. Nothing has been attended here yet, so any tag you pick is the one that starts the history.',
    },
    {
      id: LANE_COPY['new-host'].id,
      title: LANE_COPY['new-host'].title,
      qualifies: newHost !== undefined,
      detail: newHost
        ? `${identity.name} has hosted ${identity.pastEvents === 0 ? 'nothing' : 'one thing'} before, so the page argues for this one on purpose. Ranking by attendance would bury it.`
        : `${identity.name} has hosted ${identity.pastEvents} times. This lane is for hosts nobody has heard of, and that is no longer you.`,
      decidedBy: 'form',
    },
    {
      id: LANE_COPY['panas-going'].id,
      title: LANE_COPY['panas-going'].title,
      qualifies: false,
      detail:
        'Needs three people a reader follows to RSVP. Nothing on this form brings that forward, and anything here that implied otherwise would be selling you something.',
      decidedBy: 'people',
    },
  ];
}

/**
 * The one promise the page can make unconditionally.
 *
 * A public event is always on the calendar tab for its day, lane or no lane.
 * Worth saying out loud next to four lanes it may not qualify for, so the
 * readout reads as "here is the rest of what you could reach" rather than as a
 * gate the host has failed.
 */
export function baselineReach(
  draft: HostDraft,
  context: HostContext,
  now?: Date
): string {
  if (draft.visibility !== 'public') {
    return 'Unlisted. Reachable by link only: no calendar, no lanes, no search.';
  }
  const day = draftAsEvent(draft, context, now).day;
  return `On the calendar for ${day} either way — everyone browsing that day sees it.`;
}

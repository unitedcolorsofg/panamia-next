/**
 * Why an event is on the page.
 *
 * This file is the actual proposal. Everything else in /mock/events is markup
 * around it.
 *
 * A discover page lives or dies on one question: *why am I being shown this?*
 * The failure mode is familiar from every "For You" surface ever shipped — a
 * ranked list with no stated cause, which the viewer has no way to check and
 * no way to correct, so it is trusted for about a week and then ignored. The
 * fix is not a better ranking. It is making the cause a first-class value that
 * the card has to render.
 *
 * So a `Reason` is not a label the fixtures carry. It is computed from the
 * same columns the production query would have in hand, and if it cannot be
 * computed the event does not get a lane. That constraint is doing real work:
 * it is what stops a lane heading from promising a relationship the data
 * cannot actually demonstrate.
 *
 * Signals, with the table each comes from:
 *
 *   follow-host   social_follows → events.host_profile_id / host_group_id
 *   panas-going   event_attendees ∩ social_follows, status 'going'
 *   tag-match     events.tags ∩ tags of events the viewer already attended
 *   new-host      count(events) by the same host, plus events.attendee_count
 *
 * Deliberately *not* a signal: raw popularity. It is the one thing every
 * ranker reaches for first and it is self-reinforcing — the big event is shown
 * because it is big, so it gets bigger. On a directory whose whole purpose is
 * small local makers that is not a neutral default, it is the opposite of the
 * product. Attendance appears here only inverted, in `new-host`, which looks
 * for the small room rather than the full one. The genuinely big events still
 * get a lane, at the bottom, under a heading that says you would have found
 * them anyway.
 */

import {
  HOSTS,
  MOCK_EVENTS,
  PANAS,
  VIEWER,
  type MockEvent,
  type MockPana,
  type WhenBucket,
} from './_data';

/**
 * Why one event is being shown, with the evidence attached.
 *
 * Each variant carries the material the card needs to state its case in
 * specifics — the host's name, the actual panas, the actual overlapping tags.
 * A reason that renders as "recommended for you" is not a reason, and the
 * shape of this union is what makes that impossible to write.
 */
export type Reason =
  | { kind: 'follow-host'; host: string }
  | { kind: 'panas-going'; panas: MockPana[] }
  | { kind: 'tag-match'; tags: string[]; from: string }
  | { kind: 'new-host'; host: string; pastEvents: number }
  | { kind: 'popular'; going: number };

/** A lane is a reason with its evidence, not a category. */
export interface Lane {
  id: string;
  /** The heading. Written as the reason itself, in the viewer's terms. */
  title: string;
  /** One line under it, saying what the lane is doing and why it exists. */
  note: string;
  events: { event: MockEvent; reason: Reason }[];
}

/** Panas the viewer follows who have a going RSVP, resolved to records. */
export function panasGoing(event: MockEvent): MockPana[] {
  return event.panasGoing
    .map((id) => PANAS.find((p) => p.id === id))
    .filter((p): p is MockPana => p !== undefined);
}

/** Tags this event shares with something the viewer actually turned up to,
 *  plus which past event earned the match. Returns null when there is no
 *  overlap, so the caller cannot accidentally render an empty claim. */
function tagMatch(event: MockEvent): { tags: string[]; from: string } | null {
  for (const past of VIEWER.attended) {
    const shared = event.tags.filter((tag) => past.tags.includes(tag));
    if (shared.length > 0) return { tags: shared, from: past.title };
  }
  return null;
}

/**
 * Every reason that holds for an event, strongest first.
 *
 * Order is the editorial judgement of the page and worth stating plainly:
 * a host you chose to follow beats people you know going, which beats a
 * subject you have turned up for before, which beats the page arguing on an
 * unknown host's behalf. Each event is then placed in exactly one lane, by its
 * strongest reason — the same event appearing under three headings is the
 * fastest way to make a page of four lanes feel like a page of one.
 */
export function reasonsFor(event: MockEvent): Reason[] {
  const out: Reason[] = [];
  const host = HOSTS.find((h) => h.id === event.host);

  if (host?.youFollow) out.push({ kind: 'follow-host', host: host.name });

  const panas = panasGoing(event);
  if (panas.length >= 3) out.push({ kind: 'panas-going', panas });

  const match = tagMatch(event);
  if (match) out.push({ kind: 'tag-match', ...match });

  if (host && host.pastEvents <= 1 && event.going < 50) {
    out.push({
      kind: 'new-host',
      host: host.name,
      pastEvents: host.pastEvents,
    });
  }

  return out;
}

/** How full an event is, or null when it is uncapped. Rendered as urgency on
 *  the card rather than as a lane: "three seats left" is a reason to hurry,
 *  never a reason the event suits you, and the two must not be dressed alike. */
export function seatsLeft(event: MockEvent): number | null {
  if (event.cap === null) return null;
  return Math.max(0, event.cap - event.going);
}

/* Exported so the host mock at /mock/events/host can name the lanes in the
   same words the reader will see them in. A host page that invented its own
   labels for these ("Followers feed", "Recommended") would be describing a
   page that does not exist. */
export const LANE_COPY: Record<
  Reason['kind'],
  { id: string; title: (r: Reason) => string; note: string }
> = {
  'follow-host': {
    id: 'following',
    title: () => 'From hosts you follow',
    note: 'You chose these people. Nothing is being guessed here.',
  },
  'panas-going': {
    id: 'panas',
    title: () => 'Your panas are going',
    note: 'Counted from RSVPs by people you follow — not from who is popular.',
  },
  'tag-match': {
    id: 'tags',
    title: () => 'Like things you have turned up to',
    note: 'Matched on the tags of events you actually attended, not browsed.',
  },
  'new-host': {
    id: 'new',
    title: () => 'New hosts, small rooms',
    note: 'First or second time hosting. Ranking by attendance would bury every one of these.',
  },
  popular: {
    id: 'popular',
    title: () => 'You would have found these anyway',
    note: 'The biggest things on. Last rather than first, because they do not need the help.',
  },
};

/**
 * Bucket the week into lanes.
 *
 * Signed out, `follow-host`, `panas-going` and `tag-match` are not zero — they
 * are unknowable, because every one of them is a join against the viewer. So
 * the signed-out page is not this page with empty sections; it is the subset
 * that can be computed for a stranger. That is the honest difference and the
 * caller renders a sign-in prompt alongside it rather than a sad empty state.
 *
 * Lanes under two events are dropped. A heading over a single card claims a
 * pattern that one row cannot evidence, and four such lanes is a page that
 * looks personalised while saying nothing.
 */
export function buildLanes(
  events: MockEvent[],
  { signedIn }: { signedIn: boolean }
): { lanes: Lane[]; leftovers: MockEvent[] } {
  const order: Reason['kind'][] = signedIn
    ? ['follow-host', 'panas-going', 'tag-match', 'new-host']
    : ['new-host'];

  const claimed = new Set<string>();
  const lanes: Lane[] = [];

  for (const kind of order) {
    /* Only events no earlier lane took, so the same card never appears twice.
       Re-offering the remainder at each step also means an event cut from a
       full lane cascades to its next-best reason rather than disappearing:
       the screenprint workshop that lost the three-slot "panas going" cut is
       still a tag match, and lands there. */
    const candidates = events
      .filter((event) => !claimed.has(event.id))
      .map((event) => ({
        event,
        reason: reasonsFor(event).find((r) => r.kind === kind),
      }))
      .filter(
        (entry): entry is { event: MockEvent; reason: Reason } =>
          entry.reason !== undefined
      );

    const picked = candidates
      .sort((a, b) => laneRank(b) - laneRank(a))
      .slice(0, 3);

    /* Claimed only once the lane is certain to render, and only the cards that
       survived the cut. Claiming earlier silently drops every event a lane
       gathered and then did not show — which is the worst failure available to
       a page whose entire promise is that it will surface things. */
    if (picked.length < 2) continue;

    for (const entry of picked) claimed.add(entry.event.id);
    const copy = LANE_COPY[kind];
    lanes.push({
      id: copy.id,
      title: copy.title(picked[0].reason),
      note: copy.note,
      events: picked,
    });
  }

  /* Whatever no lane spoke for, biggest first. These are the events a plain
     popularity sort would have led with, which is exactly why they are last. */
  const leftovers = events
    .filter((event) => !claimed.has(event.id))
    .sort((a, b) => b.going - a.going);

  return { lanes, leftovers };
}

/** Within a lane, lead with the strongest instance of that lane's own reason:
 *  the most panas, the most overlapping tags, the newest host. Sorting every
 *  lane by date instead would make four lanes read as four copies of the
 *  calendar. */
function laneRank({ reason, event }: { reason: Reason; event: MockEvent }) {
  switch (reason.kind) {
    case 'panas-going':
      return reason.panas.length;
    case 'tag-match':
      return reason.tags.length;
    case 'new-host':
      return 10 - reason.pastEvents;
    default:
      return -event.going;
  }
}

/** The full set for a chosen window, before lanes. */
export function eventsInWindow(when: WhenBucket | 'all'): MockEvent[] {
  if (when === 'all') return MOCK_EVENTS;
  return MOCK_EVENTS.filter((event) => event.bucket === when);
}

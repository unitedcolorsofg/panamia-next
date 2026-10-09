/**
 * What filling in this form actually buys: which lanes on `/e` the draft can
 * land in, and which ones no form field can reach.
 *
 * This is the piece the shipped page has nothing like. `EventForm` collects
 * twelve values in roughly the order the `events` table declares them and then
 * says "A title and start time are required" — which is true of the database
 * and useless to a host, because a title and a start time produce a card that
 * the discovery page can place in exactly one lane: the calendar, where it
 * sits among everything else happening that day.
 *
 * Two rules keep this honest.
 *
 * **It calls the real matcher.** `reasonsFor` from `../_reasons` is the same
 * function the discovery page ranks with, so the tag lane and the new-host
 * lane are not re-derived here against thresholds that could drift. Where this
 * file does decide something itself — the follow lane, the panas lane — it is
 * because those depend on the *reader*, and a reader-shaped question cannot be
 * answered from the host's side at all. Saying so is the useful answer.
 *
 * **It never promises attendance.** Every lane says who can reach it and on
 * what evidence. None of them say an event will be popular, because a host
 * page that implies "fill this in and people will come" is a worse lie than
 * the blank form it replaced.
 */

import { VIEWER } from '../_data';
import { LANE_COPY, reasonsFor, type Reason } from '../_reasons';
import {
  TAG_VOCABULARY,
  draftAsEvent,
  followersFor,
  hostFor,
  type HostDraft,
} from './_data';

export interface LaneProspect {
  id: string;
  /** The lane heading, taken from `LANE_COPY` so it matches what a reader
   *  sees rather than a name invented for the host's benefit. */
  title: string;
  /** The lane's own one-liner from the discovery page. */
  note: string;
  qualifies: boolean;
  /**
   * Who this reaches and on what evidence, in specifics. Never a score.
   */
  detail: string;
  /**
   * Whether the form can still change the answer.
   *
   * The split is the most useful thing on this page. Two of these lanes are
   * decided by fields the host is looking at right now; two are decided by
   * other people after the event is posted. Presenting all four as a checklist
   * would tell a first-time host to go and fix something that is not theirs to
   * fix.
   */
  decidedBy: 'form' | 'people';
  /** The edit that would earn the lane, when there is one. */
  fix?: string;
}

/** Tags readers here have actually turned up for, narrowed to ones already in
 *  use this week. Derived twice over — from `VIEWER.attended` and from the
 *  live vocabulary — so the suggestion cannot name a dead tag. */
export const PROVEN_TAGS: string[] = Array.from(
  new Set(VIEWER.attended.flatMap((past) => past.tags))
).filter((tag) => TAG_VOCABULARY.some((entry) => entry.tag === tag));

function find<K extends Reason['kind']>(
  reasons: Reason[],
  kind: K
): Extract<Reason, { kind: K }> | undefined {
  return reasons.find((r) => r.kind === kind) as
    Extract<Reason, { kind: K }> | undefined;
}

export function prospectsFor(draft: HostDraft): LaneProspect[] {
  const host = hostFor(draft.hostId);
  const followers = followersFor(draft.hostId);
  const reasons = reasonsFor(draftAsEvent(draft));

  const tagMatch = find(reasons, 'tag-match');
  const newHost = find(reasons, 'new-host');

  return [
    {
      id: 'following',
      title: LANE_COPY['follow-host'].title({
        kind: 'follow-host',
        host: host.name,
      }),
      note: LANE_COPY['follow-host'].note,
      qualifies: followers > 0,
      detail:
        followers > 0
          ? `${followers} ${followers === 1 ? 'pana' : 'panas'} follow ${host.name}. They get it at the top of the page because they asked for it, not because anything was guessed.`
          : `Nobody follows ${host.name} yet, so this lane is empty for now.`,
      decidedBy: 'form',
      fix:
        followers > 0
          ? undefined
          : 'Posting as a group you already run reaches its followers instead.',
    },
    {
      id: 'tags',
      title: LANE_COPY['tag-match'].title({
        kind: 'tag-match',
        tags: [],
        from: '',
      }),
      note: LANE_COPY['tag-match'].note,
      qualifies: tagMatch !== undefined,
      detail: tagMatch
        ? `Anyone who went to the ${tagMatch.from} gets this under that heading, because you both say ${tagMatch.tags.join(' and ')}.`
        : 'With no tags there is nothing to match on, so this lane cannot see the event at all.',
      decidedBy: 'form',
      fix: tagMatch
        ? undefined
        : `Add a tag. ${PROVEN_TAGS.join(', ')} are what readers here have turned up for before.`,
    },
    {
      id: 'new',
      title: LANE_COPY['new-host'].title({
        kind: 'new-host',
        host: host.name,
        pastEvents: host.pastEvents,
      }),
      note: LANE_COPY['new-host'].note,
      qualifies: newHost !== undefined,
      detail: newHost
        ? `${host.name} has hosted ${host.pastEvents === 0 ? 'nothing' : `${host.pastEvents} thing`} before, so the page argues for this one on purpose. Ranking by attendance would bury it.`
        : `${host.name} has hosted ${host.pastEvents} times. This lane is for hosts nobody has heard of, and that is no longer you.`,
      decidedBy: 'form',
    },
    {
      id: 'panas',
      title: LANE_COPY['panas-going'].title({ kind: 'panas-going', panas: [] }),
      note: LANE_COPY['panas-going'].note,
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
export function baselineReach(draft: HostDraft): string {
  return draft.visibility === 'public'
    ? `On the calendar for ${draft.day} either way — everyone browsing that day sees it.`
    : 'Unlisted. It is reachable by link only: no calendar, no lanes, no search.';
}

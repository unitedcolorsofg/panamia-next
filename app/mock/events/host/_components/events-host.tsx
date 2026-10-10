'use client';

/**
 * Host an event, redesigned around the page it feeds.
 *
 * **What is wrong with the shipped page.** `/e/new` is `<EventForm />` inside a
 * generic card titled "Host an Event". Twelve controls, in roughly the order
 * `events` declares its columns, with one piece of validation — "A title and
 * start time are required." Nothing on it says what the result will look like,
 * where it will appear, or who will see it. A host fills in two required
 * fields, publishes, and finds out weeks later that the card they made is on
 * the calendar for its day and nowhere else.
 *
 * That is not a form problem. It is that the form and the discovery page were
 * designed as separate screens: `/e` ranks events by *reasons* — a host you
 * follow, panas going, tags you have turned up for, a new host in a small room
 * — and `/e/new` collects none of those on purpose, because it was written
 * against the table rather than against the reader.
 *
 * **The proposal, in one line:** the form's job is not to fill in a row, it is
 * to earn a card a lane. So the page shows the host two things the old one
 * never did, both live:
 *
 * 1. **The actual card.** Not a styled approximation — `EventCard`, the same
 *    component `/e` renders, fed by `draftAsEvent`. If the preview and the
 *    real page ever disagree, it is because one of them changed, and that is
 *    worth finding out here rather than after publishing.
 * 2. **Which lanes it reaches, and which it cannot.** Computed by
 *    `prospectsFor` through the real `reasonsFor` matcher. Crucially this is
 *    split: two lanes are decided by fields on this form, two are decided by
 *    other people afterwards. A flat checklist would tell a first-time host to
 *    go and fix the one thing that is not theirs to fix.
 *
 * **What was rejected.**
 *
 * - *A score.* "Event strength: 62%" is the obvious move and it is the wrong
 *   one. A number cannot be argued with and compresses four unrelated
 *   questions into one, so a host optimises the number instead of describing
 *   their event. Every readout here names a lane, the evidence, and the edit.
 * - *A wizard with blocking steps.* The three groups are headings on one
 *   scrolling page, not gates. Hosts arrive knowing some fields and not others,
 *   and a stepper that will not let you type the title until you have chosen a
 *   venue is slower than the wall it replaced.
 * - *Required tags.* Tempting, since the tag lane is the one most often lost.
 *   But a required field produces "Event" and "Thing" as tags within a week,
 *   which poisons the lane for everyone. It stays optional and the cost of
 *   skipping it is stated instead.
 * - *Promising attendance.* Nothing here says an event will be popular. The
 *   panas lane is shown precisely so it can say that no field reaches it.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Image as ImageIcon,
  Lock,
  Minus,
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BrowserFrame } from '../../../_components/browser-frame';
import { DirectoryMasthead } from '../../_components/events-discover';
import { EventCard } from '../../_components/event-card';
import { MOCK_EVENTS, MOCK_HOST } from '../../_data';
import {
  HOST_IDENTITIES,
  INITIAL_DRAFT,
  MOCK_PATH,
  SAMPLE_COVER,
  TAG_VOCABULARY,
  VENUES,
  draftAsEvent,
  hostFor,
  type HostDraft,
} from '../_data';
import { baselineReach, prospectsFor } from '../_reach';

/* Every number this page quotes back at the host, derived from the fixtures it
   shares with the discovery mock. Typed constants would let the page advise a
   host to match a norm that no card on `/e` actually meets. */
const TYPICAL_BLURB = Math.round(
  MOCK_EVENTS.reduce((n, event) => n + event.blurb.length, 0) /
    MOCK_EVENTS.length
);
const WITH_COVER = MOCK_EVENTS.filter((event) => event.cover !== null).length;

const MODES: { value: HostDraft['mode']; label: string; hint: string }[] = [
  { value: 'offline', label: 'In person', hint: 'Filtered by county' },
  { value: 'online', label: 'Online', hint: 'Shows under Online' },
  { value: 'hybrid', label: 'Both', hint: 'Appears in both' },
];

/** A labelled control with its consequence underneath. The consequence line is
 *  the whole difference from the shipped form, which labels every field with
 *  its column name and explains none of them. */
function Field({
  id,
  label,
  optional,
  note,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <Label htmlFor={id} className="text-pana-ink text-[0.8125rem] font-black">
        {label}
        {optional && (
          <span className="text-pana-ink/45 ml-1.5 font-semibold">
            optional
          </span>
        )}
      </Label>
      <div className="mt-1.5">{children}</div>
      {note && (
        <p className="text-pana-ink/60 mt-1.5 text-[0.8125rem] font-semibold">
          {note}
        </p>
      )}
    </div>
  );
}

function Step({
  n,
  question,
  note,
  children,
}: {
  n: number;
  question: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dirsearch-card mt-5 !block p-5 sm:p-6">
      <div className="flex items-baseline gap-2.5">
        <span className="bg-pana-ink/85 text-pana-cream grid h-6 w-6 flex-none place-items-center rounded-full text-[0.75rem] font-black">
          {n}
        </span>
        <div>
          <h2 className="text-pana-ink text-[1.125rem] leading-tight font-black tracking-[-0.01em]">
            {question}
          </h2>
          <p className="text-pana-ink/60 mt-1 text-[0.8125rem] font-semibold">
            {note}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** A chip-style toggle. Same shape as the directory's filter chips so the
 *  controls a host uses to describe an event look like the controls a reader
 *  uses to find one — which is the relationship the page is arguing for. */
function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-on={on}
      className="border-pana-ink/15 text-pana-ink/75 data-[on=true]:border-pana-ink/85 data-[on=true]:bg-pana-ink/85 data-[on=true]:text-pana-cream inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.8125rem] font-bold transition-colors"
    >
      {children}
    </button>
  );
}

export function EventsHost() {
  const [draft, setDraft] = useState<HostDraft>(INITIAL_DRAFT);
  const [menuOpen, setMenuOpen] = useState(false);

  function set<K extends keyof HostDraft>(key: K, value: HostDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const event = useMemo(() => draftAsEvent(draft), [draft]);
  const prospects = useMemo(() => prospectsFor(draft), [draft]);

  const live = draft.visibility === 'public';
  const fromForm = prospects.filter((p) => p.decidedBy === 'form');
  const fromPeople = prospects.filter((p) => p.decidedBy === 'people');
  const earned = fromForm.filter((p) => p.qualifies && live).length;

  return (
    <>
      <div className="mock-toolbar">
        <span className="mock-toolbar-badge">Mock</span>

        <span className="mock-toolbar-host">
          <Lock className="h-3 w-3 flex-none" aria-hidden="true" />
          {MOCK_HOST}
          {MOCK_PATH}
        </span>

        <Link href="/mock/events" className="mock-toolbar-link ml-auto">
          The page this feeds
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <BrowserFrame hostname={MOCK_HOST} path={MOCK_PATH}>
        {/* Signed in, always. Hosting is the one events route that genuinely
            requires an account — the shipped page redirects to /signin — so a
            signed-out variant here would be mocking the sign-in page. */}
        <DirectoryMasthead
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((open) => !open)}
          signedIn
          onSignIn={() => undefined}
        />

        {/* `.dirscope` carries the --story-* palette, scoped in globals.css to
            `body:has(.dirsearch), body:has(.dirscope)`. Without it the page
            renders on a transparent background and nothing says why. */}
        <main className="dirscope">
          <div className="dirsearch-band">
            <div className="container mx-auto px-4">
              <div className="mx-auto max-w-[72rem]">
                <span className="section-eyebrow">Events</span>
                <h1 className="text-pana-ink mt-2 text-[1.75rem] leading-tight font-black tracking-[-0.02em]">
                  Put something on
                </h1>
                <p className="text-pana-ink/60 mt-2 max-w-[42rem] text-[0.9375rem] font-semibold">
                  Everything you fill in decides who finds it. The card below is
                  the one people will see, and beside the form is every lane it
                  can reach — including the ones no form can.
                </p>
              </div>
            </div>
          </div>

          {/* The preview is a strip across the top rather than a tile in the
              rail, because `.dirsearch-grid` is a single 58rem column: on `/e`
              this card is a wide horizontal row with a 15rem cover beside the
              text. Shrunk into a sidebar it would stack, which is the mobile
              arrangement, and a host would be shown a layout no desktop reader
              gets. Sticky so it follows the form down — the point is to answer
              the field being edited at the moment it is edited. */}
          <div className="border-pana-ink/10 bg-pana-cream/95 sticky top-0 z-20 border-b py-3 backdrop-blur-sm">
            <div className="container mx-auto px-4">
              <div className="mx-auto max-w-[58rem]">
                <p className="text-pana-ink/45 text-[0.6875rem] font-black tracking-[0.06em] uppercase">
                  What a reader sees — the card from <code>/e</code>, not an
                  impression of it
                </p>
                {/* Inert on purpose: this is somebody else's view of the
                    event, and a Going button that worked here would be the
                    host RSVPing to their own unpublished draft. */}
                <div
                  className="pointer-events-none mt-2 select-none"
                  aria-hidden="true"
                >
                  <EventCard
                    event={event}
                    going={false}
                    onToggleGoing={() => undefined}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 pb-14">
            <div className="mx-auto grid max-w-[58rem] gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <div>
                <Step
                  n={1}
                  question="Who is putting it on?"
                  note="The quietest control on the old form and the one that changes the most."
                >
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {HOST_IDENTITIES.map((identity) => {
                      const host = hostFor(identity.id);
                      const on = draft.hostId === identity.id;
                      return (
                        <button
                          key={identity.id}
                          type="button"
                          onClick={() => set('hostId', identity.id)}
                          data-on={on}
                          className="border-pana-ink/15 data-[on=true]:border-pana-ink/85 data-[on=true]:bg-pana-ink/[0.04] rounded-xl border p-3 text-left transition-colors"
                        >
                          <span className="text-pana-ink block text-[0.9375rem] font-black">
                            {host.name}
                          </span>
                          <span className="text-pana-ink/60 mt-0.5 block text-[0.8125rem] font-semibold">
                            {identity.followers} followers ·{' '}
                            {host.pastEvents === 0
                              ? 'never hosted'
                              : `${host.pastEvents} past event${host.pastEvents === 1 ? '' : 's'}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <Field
                    id="title"
                    label="Title"
                    note="The only line that is read in full on every card."
                  >
                    <Input
                      id="title"
                      value={draft.title}
                      onChange={(e) => set('title', e.target.value)}
                    />
                  </Field>

                  <Field
                    id="blurb"
                    label="Description"
                    optional
                    note={
                      draft.blurb.trim().length === 0
                        ? `Cards here run about ${TYPICAL_BLURB} characters. Yours is empty, so the card has a title and a date and nothing to argue with.`
                        : `${draft.blurb.trim().length} characters. Cards here run about ${TYPICAL_BLURB}; the card clamps to two lines, so the first sentence is the one that counts.`
                    }
                  >
                    <Textarea
                      id="blurb"
                      rows={3}
                      value={draft.blurb}
                      onChange={(e) => set('blurb', e.target.value)}
                      placeholder="What happens, and who it is for."
                    />
                  </Field>
                </Step>

                <Step
                  n={2}
                  question="When and where?"
                  note="The two fields that decide which day strip and which county filter it answers to."
                >
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    <Field id="starts" label="Starts">
                      <Input
                        id="starts"
                        value={draft.when}
                        onChange={(e) => set('when', e.target.value)}
                      />
                    </Field>
                    <Field
                      id="ends"
                      label="Ends"
                      optional
                      note="Left blank, the card shows a start time only."
                    >
                      <Input
                        id="ends"
                        value={draft.endsAt}
                        onChange={(e) => set('endsAt', e.target.value)}
                        placeholder="—"
                      />
                    </Field>
                  </div>

                  <Field id="mode" label="Format">
                    <div className="flex flex-wrap gap-2">
                      {MODES.map((mode) => (
                        <Chip
                          key={mode.value}
                          on={draft.mode === mode.value}
                          onClick={() => set('mode', mode.value)}
                        >
                          {mode.label}
                          <span className="opacity-60">{mode.hint}</span>
                        </Chip>
                      ))}
                    </div>
                  </Field>

                  {draft.mode !== 'online' && (
                    <Field
                      id="venue"
                      label="Venue"
                      note="The county comes with the venue, so nobody picks it twice."
                    >
                      <select
                        id="venue"
                        value={draft.where}
                        onChange={(e) => {
                          const venue = VENUES.find(
                            (v) => v.where === e.target.value
                          );
                          if (!venue) return;
                          set('where', venue.where);
                          set('county', venue.county);
                        }}
                        className="border-pana-ink/15 text-pana-ink h-9 w-full rounded-md border bg-white px-3 text-[0.875rem] font-semibold"
                      >
                        {VENUES.map((venue) => (
                          <option key={venue.where} value={venue.where}>
                            {venue.where}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}

                  <Field
                    id="cap"
                    label="Attendee cap"
                    optional
                    note={
                      draft.cap === null
                        ? 'Uncapped. The card shows how many are going and no urgency.'
                        : `Capped at ${draft.cap}. Once it is nearly full the card says so, which is a reason to hurry — never a reason the event suits anyone.`
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip
                        on={draft.cap === null}
                        onClick={() => set('cap', null)}
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        No limit
                      </Chip>
                      {[12, 30, 80].map((cap) => (
                        <Chip
                          key={cap}
                          on={draft.cap === cap}
                          onClick={() => set('cap', cap)}
                        >
                          <Users className="h-3.5 w-3.5" aria-hidden="true" />
                          {cap}
                        </Chip>
                      ))}
                    </div>
                  </Field>
                </Step>

                <Step
                  n={3}
                  question="How will anyone find it?"
                  note="Optional on the old form, and the reason most events only ever reach the calendar."
                >
                  <Field
                    id="tags"
                    label="Tags"
                    optional
                    note="Matched against what readers have turned up to before, not what they browsed."
                  >
                    <div className="flex flex-wrap gap-2">
                      {TAG_VOCABULARY.map(({ tag, used }) => (
                        <Chip
                          key={tag}
                          on={draft.tags.includes(tag)}
                          onClick={() =>
                            set(
                              'tags',
                              draft.tags.includes(tag)
                                ? draft.tags.filter((t) => t !== tag)
                                : [...draft.tags, tag]
                            )
                          }
                        >
                          {tag}
                          <span className="opacity-60">on {used}</span>
                        </Chip>
                      ))}
                    </div>
                  </Field>

                  <Field
                    id="cover"
                    label="Cover image"
                    optional
                    note={`${WITH_COVER} of ${MOCK_EVENTS.length} cards on this week have one. Without it yours draws the tinted panel.`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip
                        on={draft.cover !== null}
                        onClick={() =>
                          set(
                            'cover',
                            draft.cover === null ? SAMPLE_COVER : null
                          )
                        }
                      >
                        <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {draft.cover === null ? 'Add a cover' : 'Cover added'}
                      </Chip>
                    </div>
                  </Field>

                  {draft.cover !== null && (
                    <Field
                      id="alt"
                      label="Cover alt text"
                      optional
                      note="Described for anyone who cannot see it. The card itself never prints this."
                    >
                      <Input
                        id="alt"
                        value={draft.coverAlt}
                        onChange={(e) => set('coverAlt', e.target.value)}
                        placeholder="Hands pulling a squeegee across a screen."
                      />
                    </Field>
                  )}

                  <Field id="visibility" label="Visibility">
                    <div className="flex flex-wrap gap-2">
                      <Chip
                        on={live}
                        onClick={() => set('visibility', 'public')}
                      >
                        Public
                      </Chip>
                      <Chip
                        on={!live}
                        onClick={() => set('visibility', 'unlisted')}
                      >
                        Unlisted
                      </Chip>
                    </div>
                  </Field>
                </Step>
              </div>

              {/* The rail. Sticky because its whole job is to answer the field
                  the host is editing at the moment they edit it; scrolled away
                  it is a summary, and a summary is what the publish button
                  already is. */}
              {/* Offset clears the sticky preview strip above. Capped and
                  scrollable so a long readout can never outgrow the viewport
                  and strand the publish button below the fold. */}
              <aside className="lg:sticky lg:top-[14rem] lg:max-h-[calc(100vh-15rem)] lg:self-start lg:overflow-y-auto">
                <div className="dirsearch-card mt-5 !block p-5">
                  <h2 className="text-pana-ink text-[0.9375rem] font-black">
                    Where it shows up
                  </h2>
                  <p className="text-pana-ink/60 mt-1 text-[0.8125rem] font-semibold">
                    {baselineReach(draft)}
                  </p>
                  <p className="text-pana-ink/60 mt-1 text-[0.8125rem] font-semibold">
                    Nobody is going yet, and the card above says so. Which lane
                    it lands in is what changes that.
                  </p>

                  {live ? (
                    <>
                      <p className="text-pana-ink/45 mt-4 text-[0.6875rem] font-black tracking-[0.06em] uppercase">
                        Decided by this form — {earned} of {fromForm.length}
                      </p>
                      <ul className="mt-2 space-y-3">
                        {fromForm.map((lane) => (
                          <li key={lane.id} className="flex gap-2.5">
                            <span
                              data-on={lane.qualifies}
                              className="border-pana-ink/20 text-pana-ink/30 data-[on=true]:border-pana-pink data-[on=true]:bg-pana-pink mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full border data-[on=true]:text-white"
                            >
                              {lane.qualifies && (
                                <Check
                                  className="h-2.5 w-2.5"
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                            <span>
                              <span className="text-pana-ink block text-[0.8125rem] font-black">
                                {lane.title}
                              </span>
                              <span className="text-pana-ink/65 mt-0.5 block text-[0.8125rem] font-semibold">
                                {lane.detail}
                              </span>
                              {lane.fix && (
                                <span className="text-pana-pink mt-0.5 block text-[0.8125rem] font-bold">
                                  {lane.fix}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <p className="text-pana-ink/45 mt-5 text-[0.6875rem] font-black tracking-[0.06em] uppercase">
                        Decided by people, after you post
                      </p>
                      <ul className="mt-2 space-y-3">
                        {fromPeople.map((lane) => (
                          <li key={lane.id}>
                            <span className="text-pana-ink/55 block text-[0.8125rem] font-black">
                              {lane.title}
                            </span>
                            <span className="text-pana-ink/55 mt-0.5 block text-[0.8125rem] font-semibold">
                              {lane.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-pana-ink/65 mt-3 text-[0.8125rem] font-semibold">
                      Unlisted events are not ranked at all, so none of the four
                      lanes apply. Share the link yourself and it works exactly
                      as well as it ever would.
                    </p>
                  )}

                  <div className="border-pana-ink/10 mt-5 border-t pt-4">
                    <button
                      type="button"
                      className="dirsearch-tail-primary w-full justify-center"
                    >
                      Publish
                    </button>
                    <p className="text-pana-ink/55 mt-2 text-center text-[0.75rem] font-semibold">
                      You can edit all of this after posting. Lanes are
                      recalculated every time.
                    </p>
                  </div>
                </div>
              </aside>
            </div>

            {/* Per app/mock/README.md, a mock names its own route so a
                screenshot taken out of context still says where it came from. */}
            <p className="mx-auto mt-8 max-w-[58rem] text-center text-xs opacity-60">
              Design mock — <code>/mock/events/host</code>, drawn as{' '}
              <code>
                {MOCK_HOST}
                {MOCK_PATH}
              </code>
              , the route <code>app/e/new/page.tsx</code> serves today. Nothing
              here reads or writes the database. The twelve fields are the ones{' '}
              <code>components/events/EventForm.tsx</code> already collects —
              none added, none dropped. The preview is the real{' '}
              <code>EventCard</code>, and the lane readout runs the real{' '}
              <code>reasonsFor</code> matcher from the discovery mock, so the
              tags, venues and counts offered here are derived from the events
              on <code>/mock/events</code> rather than typed.
            </p>
          </div>
        </main>
      </BrowserFrame>
    </>
  );
}

'use client';

/**
 * Host an event, built around the page it feeds.
 *
 * **What was wrong with the page this replaces.** `/e/new` was `<EventForm />`
 * inside a generic card titled "Host an Event": twelve controls in roughly the
 * order `events` declares its columns, with one piece of validation — "A title
 * and start time are required." Nothing on it said what the result would look
 * like, where it would appear, or who would see it. A host filled in two
 * required fields, posted, and found out weeks later that the card they made
 * was on the calendar for its day and nowhere else.
 *
 * That was not a form problem. It was that the form and the discovery page
 * were designed as separate screens: `/e` ranks events by *reasons* — a host
 * you follow, panas going, tags you have turned up for, a new host in a small
 * room — and the form collected none of those on purpose, because it was
 * written against the table rather than against the reader.
 *
 * **The change, in one line:** the form's job is not to fill in a row, it is
 * to earn a card a lane. So the page shows two things the old one never did,
 * both live as you type:
 *
 * 1. **The actual card.** Not a styled approximation — `EventCard`, the same
 *    component `/e` renders, fed by `draftAsEvent`. If the preview and the
 *    real page ever disagree it is because one of them changed, and that is
 *    worth finding out here rather than after posting.
 * 2. **Which lanes it reaches, and which it cannot.** Computed by
 *    `prospectsFor` through the real `reasonsFor` matcher, against real
 *    follower and attendance counts resolved on the server. Crucially this is
 *    split: two lanes are decided by fields on this form, two are decided by
 *    other people afterwards. A flat checklist would tell a first-time host to
 *    go and fix the one thing that is not theirs to fix.
 *
 * **Why there is no round trip.** Every number the readout needs — followers,
 * past events, which tags readers have actually turned up for — is resolved
 * once in `getHostContext` and handed down as a prop, because nothing a host
 * can type changes any of them. So the recomputation is pure and synchronous,
 * and a readout whose entire job is to answer instantly never shows a spinner.
 *
 * **What was rejected.**
 *
 * - *A score.* "Event strength: 62%" is the obvious move and the wrong one. A
 *   number cannot be argued with and compresses four unrelated questions into
 *   one, so a host optimises the number instead of describing their event.
 *   Every readout here names a lane, the evidence, and the edit.
 * - *A wizard with blocking steps.* The three groups are headings on one
 *   scrolling page, not gates. Hosts arrive knowing some fields and not
 *   others, and a stepper that will not let you type the title until you have
 *   chosen a venue is slower than the wall it replaced.
 * - *Required tags.* Tempting, since the tag lane is the one most often lost.
 *   But a required field produces "Event" and "Thing" as tags within a week,
 *   which poisons the lane for everyone. It stays optional and the cost of
 *   skipping it is stated instead.
 * - *Promising attendance.* Nothing here says an event will be popular. The
 *   panas lane is shown precisely so it can say that no field reaches it.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Minus, Plus, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EventCard } from '@/app/e/_components/event-card';
import { SITE_TIMEZONE } from '@/lib/events/lanes';
import {
  baselineReach,
  draftAsEvent,
  emptyDraft,
  prospectsFor,
  type HostContext,
  type HostDraft,
} from '@/lib/events/host-draft';

const MODES: { value: HostDraft['mode']; label: string; hint: string }[] = [
  { value: 'offline', label: 'In person', hint: 'Filtered by county' },
  { value: 'online', label: 'Online', hint: 'Shows under Online' },
  { value: 'hybrid', label: 'Both', hint: 'Appears in both' },
];

/** A labelled control with its consequence underneath. The consequence line is
 *  the whole difference from the form this replaces, which labelled every
 *  field with its column name and explained none of them. */
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

export function EventsHost({ context }: { context: HostContext }) {
  const router = useRouter();
  const [draft, setDraft] = useState<HostDraft>(() =>
    emptyDraft(SITE_TIMEZONE)
  );
  const [customTag, setCustomTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* Resolved after mount rather than in the initial state, because
     `Intl.DateTimeFormat()` answers with the server's zone during SSR and the
     reader's in the browser, and a value that differs across those two is a
     hydration mismatch. Starting from the site zone and correcting is a
     flicker in one sentence; the alternative is a console error on every
     load. */
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) setDraft((prev) => ({ ...prev, timezone: zone }));
  }, []);

  function set<K extends keyof HostDraft>(key: K, value: HostDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTag(tag: string) {
    setDraft((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  }

  function addCustomTag() {
    const tag = customTag.trim().toLowerCase();
    if (!tag) return;
    setCustomTag('');
    if (draft.tags.includes(tag)) return;
    set('tags', [...draft.tags, tag]);
  }

  const event = useMemo(() => draftAsEvent(draft, context), [draft, context]);
  const prospects = useMemo(
    () => prospectsFor(draft, context),
    [draft, context]
  );

  const live = draft.visibility === 'public';
  const fromForm = prospects.filter((p) => p.decidedBy === 'form');
  const fromPeople = prospects.filter((p) => p.decidedBy === 'people');
  const earned = fromForm.filter((p) => p.qualifies && live).length;

  const suggestions = context.tags.filter(
    (option) => !draft.tags.includes(option.tag)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!draft.title.trim() || !draft.startsAt) {
      setError('A title and start time are required.');
      return;
    }
    /* Checked here as well as on the server so a host who has scrolled past
       the venue select is told at the control rather than after a round trip
       that throws away the form state. */
    if (draft.mode !== 'online' && !draft.venueId) {
      setError('In-person events need a venue. Pick one, or switch to Online.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          coverImage: draft.coverImage.trim() || null,
          coverImageAlt: draft.coverImageAlt.trim() || null,
          mode: draft.mode,
          venueId: draft.mode === 'online' ? null : draft.venueId || null,
          startsAt: new Date(draft.startsAt).toISOString(),
          endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
          timezone: draft.timezone,
          attendeeCap: draft.attendeeCap,
          tags: draft.tags,
          visibility: draft.visibility,
          /* Omitted entirely when hosting as yourself: the create route reads
             a missing `hostGroupId` as "host as me", and sending an empty
             string instead would look like a group that does not exist. */
          ...(draft.hostId ? { hostGroupId: draft.hostId } : {}),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Something went wrong');
      router.push(`/e/${data.data.slug}/manage`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
      setSaving(false);
    }
  }

  return (
    /* `.dirscope` carries the --story-* palette, scoped in globals.css to
       `body:has(.dirsearch), body:has(.dirscope)`. Without it the page renders
       on a transparent background and nothing says why. */
    <main className="dirscope">
      <div className="surface-indigo dirsearch-band">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-[72rem]">
            <span className="section-eyebrow">Events</span>
            <h1 className="text-pana-ink mt-2 text-[1.75rem] leading-tight font-black tracking-[-0.02em]">
              Put something on
            </h1>
            <p className="text-pana-ink/60 mt-2 max-w-[42rem] text-[0.9375rem] font-semibold">
              Everything you fill in decides who finds it. The card below is the
              one people will see, and beside the form is every lane it can
              reach — including the ones no form can.
            </p>
          </div>
        </div>
      </div>

      {/* The preview is a strip across the top rather than a tile in the rail,
          because `.dirsearch-grid` is a single 58rem column: on `/e` this card
          is a wide horizontal row with a 15rem cover beside the text. Shrunk
          into a sidebar it would stack, which is the mobile arrangement, and a
          host would be shown a layout no desktop reader gets. Sticky so it
          follows the form down — the point is to answer the field being edited
          at the moment it is edited. */}
      <div className="border-pana-ink/10 bg-pana-cream/95 sticky top-0 z-20 border-b py-3 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-[58rem]">
            <p className="text-pana-ink/45 text-[0.6875rem] font-black tracking-[0.06em] uppercase">
              What a reader sees — the card from <code>/e</code>, not an
              impression of it
            </p>
            {/* Inert on purpose: this is somebody else's view of the event,
                and a working link here would navigate to a draft that has no
                slug yet. */}
            <div
              className="pointer-events-none mt-2 select-none"
              aria-hidden="true"
            >
              <EventCard event={event} />
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="container mx-auto px-4 pb-14">
        <div className="mx-auto grid max-w-[58rem] gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div>
            <Step
              n={1}
              question="Who is putting it on?"
              note="The quietest control on the old form and the one that changes the most."
            >
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {context.identities.map((identity) => {
                  const on = draft.hostId === identity.id;
                  return (
                    <button
                      key={identity.id || 'self'}
                      type="button"
                      onClick={() => set('hostId', identity.id)}
                      data-on={on}
                      className="border-pana-ink/15 data-[on=true]:border-pana-ink/85 data-[on=true]:bg-pana-ink/[0.04] rounded-xl border p-3 text-left transition-colors"
                    >
                      <span className="text-pana-ink block text-[0.9375rem] font-black">
                        {identity.name}
                      </span>
                      <span className="text-pana-ink/60 mt-0.5 block text-[0.8125rem] font-semibold">
                        {identity.followers}{' '}
                        {identity.followers === 1 ? 'follower' : 'followers'} ·{' '}
                        {identity.pastEvents === 0
                          ? 'never hosted'
                          : `${identity.pastEvents} past event${identity.pastEvents === 1 ? '' : 's'}`}
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
                  placeholder="Screenprint night"
                />
              </Field>

              <Field
                id="description"
                label="Description"
                optional
                note={
                  draft.description.trim().length === 0
                    ? `Cards here run about ${context.typicalBlurb} characters. Yours is empty, so the card has a title and a date and nothing to argue with.`
                    : `${draft.description.trim().length} characters. Cards here run about ${context.typicalBlurb}; the card clamps to two lines, so the first sentence is the one that counts.`
                }
              >
                <Textarea
                  id="description"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => set('description', e.target.value)}
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
                    type="datetime-local"
                    value={draft.startsAt}
                    onChange={(e) => set('startsAt', e.target.value)}
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
                    type="datetime-local"
                    value={draft.endsAt}
                    onChange={(e) => set('endsAt', e.target.value)}
                  />
                </Field>
              </div>
              <p className="text-pana-ink/55 mt-1 text-[0.75rem] font-semibold">
                Times are in {draft.timezone}.
              </p>

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
                    value={draft.venueId}
                    onChange={(e) => set('venueId', e.target.value)}
                    className="border-pana-ink/15 text-pana-ink h-9 w-full rounded-md border bg-white px-3 text-[0.875rem] font-semibold"
                  >
                    <option value="">Choose a venue…</option>
                    {context.venues.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name}
                        {venue.city ? ` — ${venue.city}` : ''}
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
                  draft.attendeeCap === null
                    ? 'Uncapped. The card shows how many are going and no urgency.'
                    : `Capped at ${draft.attendeeCap}. Once it is nearly full the card says so, which is a reason to hurry — never a reason the event suits anyone.`
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Chip
                    on={draft.attendeeCap === null}
                    onClick={() => set('attendeeCap', null)}
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                    No limit
                  </Chip>
                  {[12, 30, 80].map((cap) => (
                    <Chip
                      key={cap}
                      on={draft.attendeeCap === cap}
                      onClick={() => set('attendeeCap', cap)}
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
                  {draft.tags.map((tag) => (
                    <Chip key={tag} on onClick={() => toggleTag(tag)}>
                      {tag}
                    </Chip>
                  ))}
                  {suggestions.map((option) => (
                    <Chip
                      key={option.tag}
                      on={false}
                      onClick={() => toggleTag(option.tag)}
                    >
                      {option.tag}
                      <span className="opacity-60">
                        {option.provenBy > 0
                          ? `${option.provenBy} turned up`
                          : `on ${option.upcoming}`}
                      </span>
                    </Chip>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    id="tags"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      /* Enter in a one-line field inside a form submits it.
                         Here it means "add this tag", which is the opposite of
                         posting the event. */
                      e.preventDefault();
                      addCustomTag();
                    }}
                    placeholder="Or add your own"
                    className="h-9"
                  />
                  <button
                    type="button"
                    onClick={addCustomTag}
                    className="border-pana-ink/15 text-pana-ink/75 inline-flex h-9 flex-none items-center gap-1.5 rounded-md border px-3 text-[0.8125rem] font-bold"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add
                  </button>
                </div>
              </Field>

              <Field
                id="cover"
                label="Cover image"
                optional
                note={
                  context.upcoming > 0
                    ? `${context.withCover} of ${context.upcoming} cards coming up have one. Without it yours draws the tinted panel.`
                    : 'Without one the card draws the tinted panel, which is a perfectly good card.'
                }
              >
                <Input
                  id="cover"
                  value={draft.coverImage}
                  onChange={(e) => set('coverImage', e.target.value)}
                  placeholder="https://…"
                />
              </Field>

              {draft.coverImage.trim() !== '' && (
                <Field
                  id="alt"
                  label="Cover alt text"
                  optional
                  note="Described for anyone who cannot see it. The card itself never prints this."
                >
                  <Input
                    id="alt"
                    value={draft.coverImageAlt}
                    onChange={(e) => set('coverImageAlt', e.target.value)}
                    placeholder="Hands pulling a squeegee across a screen."
                  />
                </Field>
              )}

              <Field id="visibility" label="Visibility">
                <div className="flex flex-wrap gap-2">
                  <Chip on={live} onClick={() => set('visibility', 'public')}>
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

          {/* The rail. Sticky because its whole job is to answer the field the
              host is editing at the moment they edit it; scrolled away it is a
              summary, and a summary is what the button already is. The offset
              clears the sticky preview strip above, and it is capped and
              scrollable so a long readout can never outgrow the viewport and
              strand the button below the fold. */}
          <aside className="lg:sticky lg:top-[14rem] lg:max-h-[calc(100vh-15rem)] lg:self-start lg:overflow-y-auto">
            <div className="dirsearch-card mt-5 !block p-5">
              <h2 className="text-pana-ink text-[0.9375rem] font-black">
                Where it shows up
              </h2>
              <p className="text-pana-ink/60 mt-1 text-[0.8125rem] font-semibold">
                {baselineReach(draft, context)}
              </p>
              <p className="text-pana-ink/60 mt-1 text-[0.8125rem] font-semibold">
                Nobody is going yet, and the card above says so. Which lane it
                lands in is what changes that.
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
                            <Check className="h-2.5 w-2.5" aria-hidden="true" />
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
                  lanes apply. Share the link yourself and it works exactly as
                  well as it ever would.
                </p>
              )}

              <div className="border-pana-ink/10 mt-5 border-t pt-4">
                {error && (
                  <p
                    role="alert"
                    className="mb-3 rounded-md bg-red-50 px-3 py-2 text-[0.8125rem] font-semibold text-red-700"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="dirsearch-tail-primary w-full justify-center disabled:opacity-60"
                >
                  {saving && (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {saving ? 'Saving…' : 'Save as draft'}
                </button>
                {/* Says draft because it makes a draft. The old page's button
                    said "Create Event", which reads as publishing, and then
                    dropped the host on a manage page wondering why nothing was
                    on `/e`. */}
                <p className="text-pana-ink/55 mt-2 text-center text-[0.75rem] font-semibold">
                  Nothing goes public yet. The next page is where you look it
                  over and publish — and you can edit all of this afterwards,
                  with the lanes recalculated every time.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </main>
  );
}

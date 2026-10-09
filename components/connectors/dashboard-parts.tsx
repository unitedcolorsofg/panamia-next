import type { ReactNode } from 'react';

import {
  type CommitmentProgress,
  type HouseId,
  getHouse,
  getTier,
} from '@/lib/connectors/model';
import type { Cadence, ConnectorEvent } from '@/lib/connectors/events-model';
import { CONNECTORS_CHROME } from '@/lib/connectors/theme';
import type { ChromeTokens } from '@/lib/panaverse/chrome-tokens';

/**
 * A counted group — a pod, a house, a tier.
 *
 * Lives here rather than in a data module because it is a shape the bars
 * render, not a shape the database has. `lib/connectors/roster.ts` produces
 * these from real rows; it used to come from the fixture file, which is why
 * it was defined there.
 */
export interface Tally {
  id: string;
  label: string;
  count: number;
  /** Colour token, where the thing being counted has one. */
  color?: string;
}

/** One big number in the band across the top of a dashboard. */
export interface HeadlineStat {
  id: string;
  label: string;
  value: number;
  /** The small line under the number — context, not a second metric. */
  detail: string;
}

/**
 * The pieces both Connector dashboards are built from.
 *
 * The visual language is lifted from the Connector Dashboard the panas already
 * keep in a spreadsheet — 2px black rules, black header bars, a band of big
 * numbers across the top, pill badges for status — but re-cut in the site's
 * own palette so it reads as part of Pana MIA rather than as an embedded
 * Google Sheet. That is the point of replacing it: the data stops living
 * somewhere that looks like a different product.
 *
 * All server components. Nothing here is interactive yet, and keeping them off
 * the client means the dashboards ship no JavaScript for what is, today,
 * a lot of text in boxes.
 */

/**
 * Everything is stamped in Eastern time rather than the reader's locale.
 *
 * This is a South Florida programme — a food share is at 5pm in West Palm
 * Beach whether or not the person reading about it is currently in Lisbon.
 * Rendering in the viewer's zone would quietly move every event.
 */
const TZ = 'America/New_York';

const dayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: TZ,
});

const monthDayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: TZ,
});

export function formatDay(date: Date): string {
  return dayFormat.format(date);
}

/** `MM-DD` → "Oct 11", without inventing a year. */
export function formatMonthDay(monthDay: string): string {
  const [month, day] = monthDay.split('-').map(Number);
  return monthDayFormat.format(new Date(2000, month - 1, day));
}

export function formatCountdown(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export function daysUntil(date: Date): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

const CADENCE_BADGE: Record<Cadence, string> = {
  once: 'One-time',
  weekly: 'Recurring · Weekly',
  weekends: 'Recurring · Weekends',
  monthly: 'Recurring · Monthly',
};

// ---------------------------------------------------------------------------

/** A bordered panel with a solid header bar. The sheet's basic unit. */
export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border-2 border-pana-ink ${CONNECTORS_CHROME.SURFACE} ${className}`}
    >
      <header
        className={`flex items-center justify-between gap-4 ${CONNECTORS_CHROME.FILL} px-5 py-3`}
      >
        <h2
          className={`text-sm font-extrabold uppercase tracking-wide ${CONNECTORS_CHROME.ON_FILL}`}
        >
          {title}
        </h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * The band of headline numbers.
 *
 * One strip divided by rules rather than five separate cards, because these
 * are five readings of one programme and not five unrelated facts.
 */
export function StatBand({ stats }: { stats: readonly HeadlineStat[] }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border-2 border-pana-ink ${CONNECTORS_CHROME.FILL}`}
    >
      <dl
        className={`grid ${CONNECTORS_CHROME.DIVIDE} divide-y-2 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5`}
      >
        {stats.map((stat, index) => (
          <div
            key={stat.id}
            className={`px-5 py-4 ${
              index > 0 ? `lg:border-l-2 ${CONNECTORS_CHROME.RULE_LG}` : ''
            }`}
          >
            <dd
              className={`text-4xl font-extrabold leading-none ${CONNECTORS_CHROME.ACCENT}`}
            >
              {stat.value}
            </dd>
            <dt
              className={`mt-2 text-sm font-bold ${CONNECTORS_CHROME.ON_FILL}`}
            >
              {stat.label}
            </dt>
            <p className="text-xs text-pana-cream/60">{stat.detail}</p>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * A horizontal bar chart of counts.
 *
 * Bars are scaled against the largest row rather than against the total, so a
 * distribution where one bucket holds most of the roster still shows the small
 * buckets as something you can see and compare. Scaled against the total, the
 * four houses would all be slivers next to "Not chosen yet" and the chart
 * would answer no question at all.
 */
export function TallyBars({ rows }: { rows: readonly Tally[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-bold text-pana-ink">{row.label}</span>
            <span className="font-extrabold tabular-nums text-pana-ink">
              {row.count}
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full border-2 border-pana-ink bg-pana-cream">
            <div
              className="h-full"
              style={{
                width: `${Math.round((row.count / max) * 100)}%`,
                backgroundColor: row.color
                  ? `var(--color-${row.color})`
                  : 'var(--color-pana-ink)',
                // The unassigned bucket is the only row without a house colour,
                // and it gets a hatch so it reads as an absence rather than as
                // a fifth house drawn in black.
                opacity: row.color ? 1 : 0.25,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HousePill({ houseId }: { houseId: HouseId }) {
  const house = getHouse(houseId);
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold"
      style={{
        backgroundColor: `var(--color-${house.color})`,
        color: `var(--color-${house.onColor})`,
      }}
    >
      {house.name}
    </span>
  );
}

const PROGRESS_LABEL: Record<CommitmentProgress, string> = {
  notSet: 'Not set',
  inProgress: 'In progress',
  done: 'Done',
};

const PROGRESS_CLASS: Record<CommitmentProgress, string> = {
  notSet: 'border-pana-ink bg-pana-cream text-pana-ink',
  inProgress: 'border-pana-orange bg-pana-orange text-pana-ink',
  done: 'border-pana-indigo bg-pana-indigo text-pana-cream',
};

export function ProgressPill({ progress }: { progress: CommitmentProgress }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border-2 px-2.5 py-0.5 text-xs font-bold ${PROGRESS_CLASS[progress]}`}
    >
      {PROGRESS_LABEL[progress]}
    </span>
  );
}

/**
 * One upcoming event.
 *
 * "Needs" is the field that does the work here — it is the difference between
 * an announcement and an ask. When the sheet says "no cap!" it is rendered as
 * an open door, because a cap of zero and no cap at all are opposite answers
 * and collapsing them would turn the most welcoming events into the ones that
 * look full.
 */
export function EventCard({
  event,
  action,
}: {
  event: ConnectorEvent;
  /**
   * An optional control in a footer under the card.
   *
   * HQ puts a sign-up here, because "Needs: 3 more of 8" is an ask and a card
   * that states an ask without offering a way to answer it is a poster. The
   * admin console passes nothing: staff set events up, they do not volunteer
   * for them from this screen, and a button that did both would be lying
   * about one of them.
   */
  action?: ReactNode;
}) {
  const startsAt = new Date(event.startsAt);
  const countdown = daysUntil(startsAt);
  const cancelled = event.cancelledAt !== null;

  return (
    <article
      className={`flex flex-col gap-3 rounded-xl border-2 border-pana-ink bg-pana-cream p-5 ${
        cancelled ? 'opacity-70' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* A cancelled event keeps its place in the list rather than
            disappearing. Somebody who was planning to come needs to be told
            it is off; removing the row just lets them turn up to an empty
            park. So the badge replaces the countdown — "in 2 days" next to
            "cancelled" is two answers to the same question. */}
        {cancelled ? (
          <span className="rounded-full bg-pana-red px-2.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-pana-cream">
            Cancelled
          </span>
        ) : (
          <>
            <span className="rounded-full border-2 border-pana-ink px-2.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-pana-ink">
              {CADENCE_BADGE[event.cadence]}
            </span>
            {countdown >= 0 && countdown <= 7 && (
              <span className="rounded-full bg-pana-orange px-2.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-pana-ink">
                {formatCountdown(countdown)}
              </span>
            )}
          </>
        )}
      </div>

      <h3 className="text-lg font-extrabold leading-tight text-pana-ink">
        {event.title}
      </h3>

      <dl className="grid gap-x-4 gap-y-1.5 text-sm text-pana-ink sm:grid-cols-[auto_1fr]">
        <dt className="font-bold">When</dt>
        <dd>
          {formatDay(startsAt)}
          {event.when ? ` · ${event.when}` : ''}
        </dd>

        {event.location && (
          <>
            <dt className="font-bold">Where</dt>
            <dd>{event.location}</dd>
          </>
        )}

        {event.lead && (
          <>
            <dt className="font-bold">Lead</dt>
            <dd>{event.lead}</dd>
          </>
        )}

        <dt className="font-bold">Needs</dt>
        <dd>
          {/* Every warm accent in the palette fails AA as text on cream
              (burnt 3.44, red 3.86, pink 3.54, flame 2.42, orange 2.36); only
              ink, navy and indigo clear it. So a warm colour is only
              available on a filled chip, which is what the countdown above
              already does.

              There is no sign-up table, so this says how many are wanted and
              does not claim to know how many have come forward. The mock read
              "3 more of 8", which is a different and more useful sentence —
              and an invented one, because nothing records the 5. */}
          {event.volunteersNeeded === null ? (
            <span className="font-bold">No cap — bring whoever</span>
          ) : (
            <span className="inline-block rounded-full bg-pana-burnt px-2.5 py-0.5 text-xs font-extrabold text-pana-ink">
              {event.volunteersNeeded} volunteer
              {event.volunteersNeeded === 1 ? '' : 's'} wanted
            </span>
          )}
        </dd>

        {event.details && (
          <>
            <dt className="font-bold">Notes</dt>
            <dd>{event.details}</dd>
          </>
        )}
      </dl>

      {action && (
        <div className="mt-auto border-t-2 border-dashed border-pana-ink/25 pt-3">
          {action}
        </div>
      )}
    </article>
  );
}

/**
 * The commitments table — who said they would do what, by when.
 *
 * Columns match the sheet exactly, so somebody who has been reading this in
 * Google Sheets for a year does not have to relearn where to look.
 *
 * A commitment can span more than one house, which the sheet handles by
 * stuffing two names into a cell. It is modelled as a list here instead,
 * because "Relationship Building, Narrative Shifting" is two facts and
 * filtering by house has to be able to find it under both.
 */
export interface CommitmentRow {
  id: string;
  what: string;
  when: string | null;
  house: HouseId;
  progress: CommitmentProgress;
  /** Present on the admin console's cross-programme view. */
  ownerName?: string;
  /** Set when staff put this on somebody's board. */
  assignedBy?: string | null;
  /**
   * The event this is work for, if it is work for one.
   *
   * A title rather than an id, resolved by whoever built the row. Most
   * commitments have none — "drop off zines at four shops" is real work with
   * nothing on the calendar — so the column is absent, not empty.
   */
  eventTitle?: string | null;
}

export function CommitmentsTable({
  rows,
  showWho = true,
  chrome = CONNECTORS_CHROME,
}: {
  rows: readonly CommitmentRow[];
  showWho?: boolean;
  /** Which surface's header fill to wear.
   *
   *  Defaults to Connectors, so HQ is unchanged. The admin console renders
   *  this table on the admin surface, where an indigo header under a blue
   *  masthead reads as a bug rather than as a theme. The table is about
   *  connectors; the furniture belongs to whichever tool is showing it. */
  chrome?: ChromeTokens;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-pana-ink/70">
        Nothing on the board yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* The min-width follows the column count. It was a flat 40rem, which
          is right for the admin console's five columns and too wide for HQ's
          four — HQ renders this in a two-thirds column, so the extra 8rem
          bought nothing and pushed Progress, the column a connector opens the
          page for, behind a horizontal scrollbar. */}
      <table
        className={`w-full ${
          showWho ? 'min-w-[40rem]' : 'min-w-[32rem]'
        } border-collapse text-left text-sm`}
      >
        <thead>
          <tr className={`${chrome.FILL} ${chrome.ON_FILL}`}>
            {showWho && <Th>Who</Th>}
            <Th>What</Th>
            <Th>When</Th>
            <Th>House</Th>
            <Th>Progress</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b-2 border-pana-ink/15 align-top last:border-b-0"
            >
              {showWho && (
                <Td className="font-bold whitespace-nowrap">
                  {row.ownerName ?? 'Unknown'}
                </Td>
              )}
              <Td>
                {row.what}
                {/* Marked rather than separated. An assigned task and one you
                    took on yourself sit in the same board because they are
                    the same work — but which it is changes what you can do
                    with it, so the row has to say. */}
                {row.assignedBy && (
                  <span className="ml-2 inline-block whitespace-nowrap rounded-full border-2 border-pana-indigo px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-pana-indigo">
                    Assigned
                  </span>
                )}
                {/* A second line rather than a sixth column. Most rows have no
                    event, so a column would be mostly empty and would cost
                    every table another 8rem of min-width — which is what
                    pushed Progress off-screen on HQ once already. */}
                {row.eventTitle && (
                  <p className="mt-0.5 text-xs font-bold text-pana-ink/55">
                    for {row.eventTitle}
                  </p>
                )}
              </Td>
              <Td className="whitespace-nowrap text-pana-ink/70">
                {row.when ?? '—'}
              </Td>
              <Td>
                <HousePill houseId={row.house} />
              </Td>
              <Td>
                <ProgressPill progress={row.progress} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th scope="col" className="px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide">
      {children}
    </th>
  );
}

function Td({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-3 text-pana-ink ${className}`}>{children}</td>;
}

/* `BirthdayList` was here. It is gone rather than empty: there is no date of
 * birth anywhere on a profile — not in the schema, not on the join form — so
 * the panel could only ever have rendered the fixture roster's invented
 * birthdays. Collecting a real one is a product decision with a privacy
 * answer attached, not a gap to fill in quietly. */

/** Tier line used on the member dashboard: "Tier 1 — Assists the Builders". */
export function TierLabel({ tier }: { tier: 1 | 2 | 3 }) {
  const t = getTier(tier);
  return (
    <span>
      Tier {t.id} — {t.name}
    </span>
  );
}

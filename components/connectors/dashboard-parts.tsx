import type { ReactNode } from 'react';

import SurfaceLink from '@/components/panaverse/SurfaceLink';
import {
  type Birthday,
  type HeadlineStat,
  type Tally,
  connectorById,
} from '@/lib/connectors/fixtures';
import {
  type Commitment,
  type CommitmentProgress,
  type ConnectorEvent,
  type EventCadence,
  type HouseId,
  getHouse,
  getTier,
} from '@/lib/connectors/model';

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

const CADENCE_LABEL: Record<EventCadence, string> = {
  oneTime: 'One-time',
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
      className={`overflow-hidden rounded-xl border-2 border-pana-ink bg-pana-cream ${className}`}
    >
      <header className="flex items-center justify-between gap-4 bg-pana-ink px-5 py-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-pana-cream">
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
 * One black strip divided by rules rather than five separate cards, because
 * these are five readings of one programme and not five unrelated facts.
 * Orange on ink is the only pairing here that clears contrast at this size.
 */
export function StatBand({ stats }: { stats: readonly HeadlineStat[] }) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-pana-ink bg-pana-ink">
      <dl className="grid divide-y-2 divide-pana-cream/20 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5">
        {stats.map((stat, index) => (
          <div
            key={stat.id}
            className={`px-5 py-4 ${
              index > 0 ? 'lg:border-l-2 lg:border-pana-cream/20' : ''
            }`}
          >
            <dd className="text-4xl font-extrabold leading-none text-pana-orange">
              {stat.value}
            </dd>
            <dt className="mt-2 text-sm font-bold text-pana-cream">
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
export function EventCard({ event }: { event: ConnectorEvent }) {
  const countdown = daysUntil(event.startsAt);
  const short = event.volunteersNeeded === null
    ? null
    : Math.max(0, event.volunteersNeeded - event.volunteersFilled);

  return (
    <article className="flex flex-col gap-3 rounded-xl border-2 border-pana-ink bg-pana-cream p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border-2 border-pana-ink px-2.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-pana-ink">
          {CADENCE_LABEL[event.cadence]}
        </span>
        {countdown >= 0 && countdown <= 7 && (
          <span className="rounded-full bg-pana-orange px-2.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-pana-ink">
            {formatCountdown(countdown)}
          </span>
        )}
      </div>

      <h3 className="text-lg font-extrabold leading-tight text-pana-ink">
        {event.href ? (
          <SurfaceLink href={event.href} className="underline-offset-4 hover:underline">
            {event.title}
          </SurfaceLink>
        ) : (
          event.title
        )}
      </h3>

      <dl className="grid gap-x-4 gap-y-1.5 text-sm text-pana-ink sm:grid-cols-[auto_1fr]">
        <dt className="font-bold">When</dt>
        <dd>
          {formatDay(event.startsAt)} · {event.when}
        </dd>

        {event.where && (
          <>
            <dt className="font-bold">Where</dt>
            <dd>{event.where}</dd>
          </>
        )}

        <dt className="font-bold">Lead</dt>
        <dd>{event.lead}</dd>

        <dt className="font-bold">Needs</dt>
        <dd>
          {event.volunteersNeeded === null ? (
            <span className="font-bold text-pana-burnt">
              No cap — bring whoever
            </span>
          ) : short === 0 ? (
            <span>Covered ({event.volunteersFilled} signed up)</span>
          ) : (
            <span className="font-bold text-pana-burnt">
              {short} more of {event.volunteersNeeded}
            </span>
          )}
        </dd>

        {event.tasks.length > 0 && (
          <>
            <dt className="font-bold">Tasks</dt>
            <dd>{event.tasks.join(' · ')}</dd>
          </>
        )}

        <dt className="font-bold">Contact</dt>
        <dd>
          {event.contactName}
          {event.contactPhone ? ` · ${event.contactPhone}` : ''}
        </dd>
      </dl>
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
export function CommitmentsTable({
  rows,
  showWho = true,
}: {
  rows: readonly Commitment[];
  showWho?: boolean;
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
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-pana-ink text-pana-cream">
            {showWho && <Th>Who</Th>}
            <Th>What</Th>
            <Th>When</Th>
            <Th>House</Th>
            <Th>Tier</Th>
            <Th>Progress</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const who = connectorById(row.connectorId);
            return (
              <tr
                key={row.id}
                className="border-b-2 border-pana-ink/15 align-top last:border-b-0"
              >
                {showWho && (
                  <Td className="font-bold whitespace-nowrap">
                    {who?.name ?? 'Unknown'}
                  </Td>
                )}
                <Td>{row.what}</Td>
                <Td className="whitespace-nowrap text-pana-ink/70">
                  {row.when ?? '—'}
                </Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    {row.houseIds.length === 0
                      ? '—'
                      : row.houseIds.map((id) => (
                          <HousePill key={id} houseId={id} />
                        ))}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">
                  {row.tier ? `Tier ${row.tier}` : '—'}
                </Td>
                <Td>
                  <ProgressPill progress={row.progress} />
                </Td>
              </tr>
            );
          })}
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

export function BirthdayList({ rows }: { rows: readonly Birthday[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-pana-ink/70">No birthdays on file.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5 text-sm">
      {rows.map((row) => (
        <li
          key={row.connector.id}
          className="flex items-baseline justify-between gap-3"
        >
          <span className="font-bold text-pana-ink">{row.connector.name}</span>
          <span className="whitespace-nowrap text-pana-ink/70">
            {formatMonthDay(row.date)} · {formatCountdown(row.daysAway)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Tier line used on the member dashboard: "Tier 1 — Assists the Builders". */
export function TierLabel({ tier }: { tier: 1 | 2 | 3 }) {
  const t = getTier(tier);
  return (
    <span>
      Tier {t.id} — {t.name}
    </span>
  );
}

import { HOUSES } from '@/lib/connectors/model';
import {
  describeLoad,
  formatMinutes,
  loadBand,
  LOAD_BAND_LABEL,
  type ConnectorLoad,
} from '@/lib/connectors/hours';

/**
 * Who has room to take something on.
 *
 * ## It is a bar chart of other people, not a gauge
 *
 * There is no capacity figure anywhere in this programme — `lib/connectors/
 * model.ts` quotes the deck saying the tiers "do not correspond to how
 * developed someone is" and that "everyone starts in Tier 1", and the join
 * form's "what I can bring" is free prose. So nothing here can be divided by
 * anything, and a "72% full" meter would be quoting a denominator somebody
 * made up.
 *
 * The bar is therefore scaled against the busiest person on the roster. That
 * is a real comparison and it answers the real question — not "is Ana at
 * capacity" but "of these people, who is carrying least" — and it re-scales
 * itself as the programme's workload changes rather than ageing into a
 * fiction.
 *
 * ## Unestimated work is shown, never zeroed
 *
 * Every commitment written before drizzle/0059 has no size. Folding those to
 * zero would make somebody carrying six unsized errands look completely free,
 * which is the exact error this table exists to prevent — the staffer would
 * hand them a seventh. So the unsized count rides alongside the total, and a
 * row whose work is entirely unsized says so instead of showing "0h".
 *
 * ## Sorted by who is freest
 *
 * Ascending, because the page's job is finding somebody to assign to. A table
 * sorted busiest-first makes you read to the bottom for the answer. People
 * with nothing open sort first and are the point of the whole page.
 */

/* Typed as plain strings, not HouseId: `houses` comes off a JSON column, so a
 * value that is no longer a known house is possible and should render as
 * itself rather than fail a lookup. */
const HOUSE_LABEL = new Map<string, string>(HOUSES.map((h) => [h.id, h.name]));

export interface LoadRow {
  profileId: string;
  displayName: string;
  houses: string[];
  load: ConnectorLoad;
}

/* Ink on all four, so the chip never has to change its text colour. Butter
 * reads as "available" without being a green that implies a health check. */
const BAND_CLASS = {
  free: 'bg-pana-butter text-pana-ink',
  light: 'bg-pana-butter-2 text-pana-ink',
  steady: 'bg-pana-blue text-pana-ink',
  heaviest: 'bg-pana-flame text-pana-ink',
} as const;

export function LoadTable({ rows }: { rows: readonly LoadRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-pana-ink/60 text-sm leading-relaxed">
        Nobody on the roster yet. Accept an application and they will appear
        here.
      </p>
    );
  }

  const busiest = Math.max(...rows.map((r) => r.load.estimatedMinutes), 0);

  /* Copied before sorting: the caller's array is a prop, and sorting in place
   * mutates something React handed us. */
  const sorted = [...rows].sort((a, b) => {
    if (a.load.estimatedMinutes !== b.load.estimatedMinutes) {
      return a.load.estimatedMinutes - b.load.estimatedMinutes;
    }
    /* Same sized hours: the tie-break is unsized work, because somebody with
     * three unestimated jobs is not as free as somebody with none. */
    if (a.load.open !== b.load.open) return a.load.open - b.load.open;
    return a.displayName.localeCompare(b.displayName);
  });

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {sorted.map((row) => {
          const band = loadBand(row.load, busiest);
          /* Width comes off the same maximum the band does, so the bar and the
           * chip can never tell different stories. */
          const width =
            busiest > 0
              ? Math.round((row.load.estimatedMinutes / busiest) * 100)
              : 0;

          return (
            <li
              key={row.profileId}
              className="border-pana-ink/15 flex flex-col gap-1.5 border-b-2 border-dashed pb-2.5 last:border-b-0 last:pb-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-pana-ink text-sm font-extrabold">
                  {row.displayName}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-pana-ink/70 text-xs tabular-nums">
                    {describeLoad(row.load)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-extrabold ${BAND_CLASS[band]}`}
                  >
                    {LOAD_BAND_LABEL[band]}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="border-pana-ink bg-pana-cream h-3 flex-1 overflow-hidden rounded-full border-2">
                  <div
                    className="bg-pana-indigo h-full"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="text-pana-ink/60 w-16 shrink-0 text-right text-xs font-bold tabular-nums">
                  {row.load.estimatedMinutes > 0
                    ? formatMinutes(row.load.estimatedMinutes)
                    : '—'}
                </span>
              </div>

              {row.houses.length > 0 && (
                <p className="text-pana-ink/50 text-xs">
                  {row.houses
                    .map((h) => HOUSE_LABEL.get(h) ?? h)
                    .join(' · ')}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-pana-ink/60 border-pana-ink/20 mt-1 border-t-2 border-dashed pt-3 text-xs leading-relaxed">
        Bars are scaled against the busiest connector
        {busiest > 0 ? ` (${formatMinutes(busiest)})` : ''}, not against a
        capacity — the programme has never set one, and the tiers are
        explicitly not a ranking. A dash means nothing open has been sized, not
        that there is nothing to do.
      </p>
    </div>
  );
}

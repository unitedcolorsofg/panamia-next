import { formatDay } from '@/components/connectors/dashboard-parts';
import { formatMinutes } from '@/lib/connectors/hours';
import {
  describeStaffing,
  isUnderstaffed,
} from '@/lib/connectors/event-link';
import type { AssignableEvent, EventStaffing } from '@/lib/connectors/event-link';

/**
 * What is coming up and who is on it.
 *
 * The mirror of `LoadTable`. That one asks "who has room"; this asks "what
 * still needs people". They are the same rows counted on different axes, and
 * both have to be on the scheduling page because assigning well needs both
 * halves — a free connector is only useful next to the thing nobody is doing.
 *
 * ## Why `volunteersNeeded` was a dead number until now
 *
 * `connector_events.volunteersNeeded` has existed since the table did, and
 * nothing ever counted up to it. An event could ask for five people and the
 * programme had no way to know whether it had one or none, because being
 * assigned to an event was not something the data could express. Commitments
 * can name an event as of drizzle/0061, so the denominator finally has a
 * numerator.
 *
 * ## Short events first, then chronological
 *
 * The page is read to decide what to do next, so the rows that need a decision
 * go on top. Within each group the order is by date, because between two
 * equally short-handed events the nearer one is the more urgent.
 *
 * Events that never asked for a crew are not "short" — see `isUnderstaffed`.
 * They sit in the lower group whatever their staffing, because an event with
 * no target cannot be behind one.
 */

export interface StaffingRow {
  event: AssignableEvent;
  staffing: EventStaffing;
}

export function StaffingTable({ rows }: { rows: StaffingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-pana-ink/60 text-sm leading-relaxed">
        Nothing on the calendar to staff.
      </p>
    );
  }

  const sorted = [...rows].sort((a, b) => {
    const aShort = isUnderstaffed(a.staffing, a.event.volunteersNeeded);
    const bShort = isUnderstaffed(b.staffing, b.event.volunteersNeeded);
    if (aShort !== bShort) return aShort ? -1 : 1;
    return a.event.startsAt.localeCompare(b.event.startsAt);
  });

  return (
    <ul className="divide-pana-ink/10 divide-y">
      {sorted.map(({ event, staffing }) => {
        const short = isUnderstaffed(staffing, event.volunteersNeeded);
        const missing = event.volunteersNeeded
          ? event.volunteersNeeded - staffing.connectors
          : 0;

        return (
          <li
            key={`${event.kind}:${event.id}`}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">
                {event.title}
                {event.kind === 'public' && (
                  <span className="text-pana-ink/50 ml-2 text-xs font-bold tracking-wide uppercase">
                    Pana event
                  </span>
                )}
              </p>
              <p className="text-pana-ink/60 mt-0.5 text-xs leading-relaxed">
                {formatDay(new Date(event.startsAt))}
                {event.where ? ` · ${event.where}` : ''}
              </p>
            </div>

            <div className="text-right">
              <p
                className={[
                  'text-sm font-extrabold',
                  short ? 'text-pana-red' : 'text-pana-ink/80',
                ].join(' ')}
              >
                {describeStaffing(
                  staffing,
                  event.volunteersNeeded,
                  formatMinutes
                )}
              </p>
              {short && (
                <p className="text-pana-red/80 mt-0.5 text-xs font-bold">
                  {missing} more {missing === 1 ? 'person' : 'people'} needed
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

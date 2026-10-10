import Link from 'next/link';

/**
 * The parts of /admin/livesite that only draw.
 *
 * Split from the page for the same reason `components/Admin/parts.tsx` exists:
 * the page is a server component that reads the database, and everything here
 * is a pure function of its props. Keeping them apart means the layout can be
 * rendered and checked without a connection string, which matters for a page
 * whose interesting state — queues backed up — is the state you cannot
 * conveniently produce on demand.
 *
 * Server components. Nothing here needs a client bundle.
 */

export interface WaitingItem {
  /** Singular noun. Pluralised by `plural`, not by appending an s. */
  label: string;
  plural: string;
  count: number;
  /** Where to clear it, or null when no tool owns this queue yet. */
  href: string | null;
  /** Completes the sentence after the noun: "3 abuse reports needing triage". */
  verb: string;
}

/**
 * The only part of the page that changes shape.
 *
 * Flame and a list when there is something to do; one quiet line when there
 * is not. The empty state is deliberately small — it is the state this page
 * should be in almost always, and a full-width all-clear panel would take up
 * the room the alarm needs to be startling in.
 *
 * Rows arrive in a fixed order rather than sorted by count or severity. A
 * strip that reorders itself between visits has to be re-read each time,
 * which costs more than the ranking saves.
 */
export function AttentionStrip({
  waiting,
}: {
  waiting: readonly WaitingItem[];
}) {
  if (!waiting.length) {
    return (
      <p className="rounded-xl border-2 border-dashed border-pana-ink/30 px-5 py-3 text-sm font-bold text-pana-ink/60">
        Nothing waiting. Every queue is clear.
      </p>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border-2 border-pana-ink bg-pana-flame">
      <header className="px-5 py-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-pana-ink">
          Needs attention
        </h2>
      </header>
      <ul className="divide-y-2 divide-pana-ink/20 border-t-2 border-pana-ink/20">
        {waiting.map((q) => {
          const text = `${q.count} ${q.count === 1 ? q.label : q.plural} ${q.verb}`;
          return (
            <li key={q.label} className="px-5 py-3">
              {q.href ? (
                <Link
                  href={q.href}
                  className="text-sm font-bold text-pana-ink underline underline-offset-2 hover:no-underline"
                >
                  {text}
                </Link>
              ) : (
                /* No screen owns this queue yet, so the row states the number
                   without pretending there is somewhere to go. Styling it as
                   a link would be the worse lie of the two.

                   Distinguished by weight rather than by fading the ink. The
                   obvious `text-pana-ink/70` composites to 4.49 against this
                   flame fill, which misses AA by a hundredth — and it is the
                   same trap as the load-table band chip, where the fix was
                   also to change shape instead of colour. Full ink at normal
                   weight reads as secondary and measures 7.50. */
                <span className="text-sm font-bold text-pana-ink">
                  {text}
                  <span className="font-normal text-pana-ink">
                    {' '}
                    — no tool for this yet
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * A band that is planned but cannot report yet, drawn so the gap is visible.
 *
 * Dashed and unfilled is the established "you cannot click this" shape on
 * this surface — same as the unbuilt tools on the overview. Stating what it
 * would take to fill in is the point: an empty panel reads as a bug, a
 * missing panel reads as nothing at all.
 */
export function Placeholder({
  title,
  lead,
  needs,
}: {
  title: string;
  lead: string;
  needs: string;
}) {
  return (
    <section className="rounded-xl border-2 border-dashed border-pana-ink/30 p-5">
      <h3 className="text-sm font-extrabold uppercase tracking-wide text-pana-ink/60">
        {title}
      </h3>
      <p className="mt-2 text-sm font-bold text-pana-ink/70">{lead}</p>
      <p className="mt-2 text-xs text-pana-ink/60">{needs}</p>
    </section>
  );
}

import type { ViewStatus } from '@/lib/admin/views';

/**
 * What a view's status looks like, everywhere it is shown.
 *
 * Its own file rather than a member of `parts.tsx` because the sidebar is a
 * client component and this is the one piece of admin furniture it needs.
 * Living in `parts.tsx` would pull `Panel` and `StatBand` — server-only
 * furniture, used by neither — into the client bundle of every admin page, and
 * would falsify that file's claim that nothing in it needs one.
 *
 * Shared at all because the sidebar and the overview drifting apart is how
 * "mock" ends up meaning one thing in the nav and another on the index.
 *
 * `live` renders nothing. Seven of the nine tools are live, so a badge saying
 * so would sit on almost every row and the eye would stop reading it — which
 * costs exactly the two rows where the badge matters. Absence is the default
 * state; the badge marks the exception.
 *
 * Measured on cream (see the CONTRAST RULE at the top of app/globals.css):
 *
 *   ink on flame      7.50  — mock
 *   ink/70 on cream  ~9.9   — stub, dashed
 *
 * Deliberately NOT the `.card-flag[data-tone='admin']` pattern from
 * globals.css, which puts burnt text on a 16% burnt tint: that measures
 * 2.87:1 over cream and fails AA. It is a pre-existing bug in that class, not
 * a style to copy.
 */
export function StatusPill({ status }: { status: ViewStatus }) {
  if (status === 'live') return null;

  const base =
    'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.625rem] font-black uppercase tracking-[0.1em]';

  if (status === 'mock') {
    return <span className={`${base} bg-pana-flame text-pana-ink`}>Mock</span>;
  }

  /* Dashed rather than filled: a stub is an absence, and the homepage already
     uses a dashed outline for "being built" on its pillar programmes. */
  return (
    <span
      className={`${base} border border-dashed border-pana-ink/40 text-pana-ink/70`}
    >
      Stub
    </span>
  );
}

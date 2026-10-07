import type { ReactNode } from 'react';

/**
 * Real-looking, deliberately inert controls.
 *
 * Lifted out of the connectors console so the listings queue does not grow a
 * second, slightly-different set, and since moved out of `components/Admin`
 * because the connector-facing pages need the same vocabulary. A mock of what
 * a connector can do and a mock of what staff can do are the same exercise:
 * settle what somebody should be able to reach for, and what they need in
 * front of them while they reach for it. Wiring writes before that is agreed
 * means building the wrong writes.
 *
 * Nothing in here is admin-flavoured — the palette is cream and ink, and the
 * callers supply their own surrounding chrome — so sharing it costs nothing.
 *
 * Every control is `disabled`, which does two jobs. It keeps them out of the
 * tab order, so a keyboard user is not marched through thirty dead selects to
 * reach the end of a table. And it makes the state visible, rather than
 * letting somebody type into a box that silently drops what they wrote.
 *
 * These are server components. Nothing here needs a client bundle, and a mock
 * that ships JavaScript to do nothing is worse than one that ships none.
 */

export function MockTag({ children = 'Mock' }: { children?: string }) {
  return (
    /* Orange on cream measures 2.37 at this size, which is a fail however
     * loudly it shouts. Filling the pill instead puts ink on orange at 7.47
     * and makes the tag louder, not quieter — which is the point of it. */
    <span className="rounded-full border-2 border-pana-orange bg-pana-orange px-2.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-pana-ink">
      {children}
    </span>
  );
}

export function MockSelect({
  label,
  placeholder,
  options,
}: {
  label: string;
  placeholder: string;
  options: readonly string[];
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        disabled
        aria-label={label}
        defaultValue=""
        className="w-full rounded-lg border-2 border-pana-ink/40 bg-pana-cream px-2.5 py-1.5 text-sm text-pana-ink/60"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export function MockInput({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        disabled
        aria-label={label}
        placeholder={placeholder}
        className="w-full rounded-lg border-2 border-pana-ink/40 bg-pana-cream px-2.5 py-1.5 text-sm text-pana-ink/60 placeholder:text-pana-ink/40"
      />
    </label>
  );
}

export function MockTextarea({
  label,
  placeholder,
  rows = 3,
}: {
  label: string;
  placeholder: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <textarea
        disabled
        rows={rows}
        aria-label={label}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border-2 border-pana-ink/40 bg-pana-cream px-2.5 py-1.5 text-sm text-pana-ink/60 placeholder:text-pana-ink/40"
      />
    </label>
  );
}

export function MockButton({
  children,
  tone = 'quiet',
  className = '',
}: {
  children: ReactNode;
  /**
   * `quiet` is the default outline. `danger` is for the one control on a
   * screen that cannot be undone.
   *
   * red is spent deliberately and sparingly. On an approval queue the decline
   * button is the only genuinely irreversible thing on the page, and if the
   * chrome had been red too there would be nothing left to say so. Measured:
   * red on cream is 3.86, which fails body copy, so the label stays ink and
   * only the border carries the colour.
   *
   * Both tones measure under 4.5 against cream — quiet is 2.83, danger 3.86.
   * That is deliberate, and it is not a contrast bug: WCAG 1.4.3 exempts text
   * that is "part of an inactive user interface component", and every control
   * in this file is `disabled`. The dimness is what says so. An audit that
   * walks computed styles will keep flagging these, so check for `:disabled`
   * before believing it.
   */
  tone?: 'quiet' | 'danger';
  className?: string;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-pana-red text-pana-ink/60'
      : 'border-pana-ink/40 text-pana-ink/40';

  return (
    <button
      disabled
      className={`rounded-full border-2 ${toneClass} px-4 py-1.5 text-sm font-extrabold ${className}`}
    >
      {children}
    </button>
  );
}

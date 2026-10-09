/**
 * `<input type="datetime-local">` values, converted correctly.
 *
 * The input hands back wall-clock text with no zone: `"2026-11-03T17:00"`.
 * What that instant *is* depends entirely on where it gets parsed, and that is
 * the bug this module exists to stop.
 *
 * ## The failure it fixes
 *
 * `new Date("2026-11-03T17:00")` is specified to be parsed in the **runtime's**
 * zone. In a browser that is the typist's own zone, which is what they meant.
 * On the server it is whatever the host is set to, and Cloudflare Workers runs
 * in UTC — so posting the raw string meant an admin in Miami typing 5pm stored
 * 17:00Z, and the dashboards, which pin their output to `America/New_York` on
 * purpose, rendered it back as 1pm. Four hours earlier than the thing was
 * scheduled, with no error anywhere and both halves behaving exactly as
 * written.
 *
 * The fix is to resolve the string where the ambiguity can actually be settled
 * — in the browser, against the typist's clock — and to put a real instant on
 * the wire. `components/events/EventForm.tsx` already did this inline; the
 * connectors console did not. Extracting it means the next form cannot get it
 * wrong by omission, and the behaviour is testable without a DOM.
 */

/**
 * A `datetime-local` value as a UTC instant, or `null` if it is not a date.
 *
 * **Must run client-side.** It is the caller's zone that resolves the string,
 * which is only the right answer in the browser. Calling this on the server
 * reintroduces precisely the bug described above.
 *
 * `null` rather than a throw or an Invalid Date: an empty field and a
 * half-typed one are both ordinary states of a form being filled in, and the
 * caller already has to decide what to say about them.
 */
export function localInputToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const date = new Date(trimmed);
  /* `new Date('tuesday')` is an Invalid Date, which is still a Date and
   * serialises to null — checked rather than trusted. */
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

/**
 * A UTC instant as the value a `datetime-local` input expects.
 *
 * The inverse, for populating a field from a stored date. Shifts by the local
 * offset before slicing because `toISOString` is UTC and the input wants wall
 * clock — without it, editing an event would show the time in the wrong zone
 * and then save that wrong time back.
 */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

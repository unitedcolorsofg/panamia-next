/**
 * The admin surface's chrome tokens.
 *
 * A sibling of `lib/connectors/theme.ts` and written for the same reason: the
 * fill, the text that sits on it and the accent are a set, and changing one of
 * them without the others produces something that looks fine in a screenshot
 * and fails contrast in a browser.
 *
 * ## Why light blue, when every other surface is warm or dark
 *
 * The palette offers exactly two fills that carry cream text — indigo and ink
 * (see the CONTRAST RULE at the top of app/globals.css). Connectors already
 * took indigo, and a second surface wearing it would say "same room". Ink was
 * ruled out directly: a black-chromed console was the thing that got rejected
 * on Connectors.
 *
 * So this surface inverts the arrangement instead of competing for the last
 * dark fill. `--color-pana-blue` is a light sky blue, so it carries *ink* text
 * rather than cream, and the result reads as a workbench stripe rather than as
 * a masthead. That is the correct register for a back office: staff should be
 * able to tell at a glance that they are not looking at a member page, and no
 * member surface is light-and-cool.
 *
 * It also keeps red free. An approval queue has genuinely destructive controls
 * in it, and `--color-pana-red` is the only thing in the palette that reads as
 * "this one is irreversible". A red chrome would have spent that signal on
 * decoration and left the decline button with nothing to say.
 *
 * ## Measured
 *
 *   ink / blue        8.24  — the fill pairing. Body copy safe.
 *   navy / blue       7.02  — headline figures sitting on the fill.
 *   navy / cream     15.54  — accent type on the page background.
 *   cream / blue      2.21  — FAILS. Never put cream on this fill.
 *   blue / cream      2.21  — FAILS. The accent is navy for this reason.
 *
 * Navy clearing on both grounds is what lets one accent serve the whole
 * surface, which the warm surfaces cannot do — Connectors needs butter on its
 * fill and something else entirely on cream.
 *
 * The last two are the trap. `bg-pana-blue` is light enough that cream text on
 * it is nearly invisible, which is the exact inverse of the mistake the warm
 * surfaces invite. Swapping this fill for a dark one means ON_FILL has to move
 * to cream in the same edit.
 *
 * `SURFACE_TONE.admin` is `'blue'` and resolves to this same
 * `--color-pana-blue`, so the masthead accent and the page chrome agree.
 * Connectors does not have that property — its tone is burnt while its chrome
 * is indigo — and keeping them equal here is deliberate.
 *
 * Shape matches `CONNECTORS_CHROME` key for key, so a component written
 * against one works with the other.
 */
export const ADMIN_CHROME = {
  /** Panel headers, table headers, active pills, primary buttons. */
  FILL: 'bg-pana-blue',
  /** Borders that match the fill, for buttons that carry both. */
  BORDER: 'border-pana-blue',
  /** Labels sitting on FILL. Ink, not cream — see the measured table above. */
  ON_FILL: 'text-pana-ink',
  /** Hairlines dividing content inside a filled surface. */
  DIVIDE: 'divide-pana-ink/20',
  /** The same hairline as a single border edge. */
  RULE: 'border-pana-ink/20',
  /* Spelled out rather than composed: Tailwind v4 only emits utilities it can
   * see as complete literals, so `lg:${RULE}` compiles to nothing at all. */
  RULE_LG: 'lg:border-pana-ink/20',
  /** Headline figures, eyebrows and section labels. Clears on fill and cream. */
  ACCENT: 'text-pana-navy',
  /**
   * Card and panel bodies. White, because the page ground is already cream.
   *
   * This furniture used to be `bg-pana-cream`, which is the *same value* as
   * the ground `app/admin/layout.tsx` paints — 1.00:1, no separation at all.
   * The 2px border was doing the entire job of saying "this is a card", and
   * on the overview, where several panels stack, the result read as rules
   * drawn on a flat page rather than as things sitting on it.
   *
   * White is the only lighter value available, and it is already what the
   * `--card` variable resolves to, so this furniture and the shadcn `Card`
   * used elsewhere on the surface now agree instead of being two different
   * notions of "card".
   *
   *   white / cream     1.06  — surface separation. Subtle by design.
   *   ink / white      19.32  — body copy. Was 18.18 on cream.
   *
   * 1.06 is deliberately low: this is two surfaces, not text on a surface, so
   * it is the border and shadow that carry the edge and this only has to stop
   * the fill from reading as a hole. Going darker to force the number up would
   * mean a third near-cream in the palette, which the note by the cream tokens
   * in app/globals.css already warns against.
   */
  SURFACE: 'bg-white',
} as const;

/**
 * The Connectors chrome palette.
 *
 * Every filled dark surface on this surface — the hero, card header bars,
 * table header rows, primary buttons, the active viewer pill — reads from
 * here rather than naming a colour inline, so the decision below is one edit
 * and not a search across five files.
 *
 * ## Why indigo and not ink
 *
 * These started as `bg-pana-ink`, which is what the rest of the site fills
 * with. On a surface whose whole job is to feel like a different room that
 * was too much black, and it left Connectors looking like the main site with
 * a different wordmark.
 *
 * Indigo is not a free choice. `app/globals.css` documents the rule the whole
 * palette is built on: warm surfaces (orange, burnt, red, butter, cream) must
 * carry ink text, and *only indigo and ink carry cream text*. Measured against
 * cream: indigo 9.01, burnt 3.44, red 3.86, flame 2.42, pink 3.54. So indigo
 * is the only fill that swaps in without also inverting every label sitting on
 * it. Navy clears it too (15.54) but navy is near-black, which is the thing
 * being moved away from.
 *
 * ## Why the stat numerals changed colour
 *
 * `StatBand` set its figures in pana-orange, which was 7.72 on ink. On indigo
 * that falls to 3.83 — still a pass for text this size, but thin enough that a
 * future size change would quietly break it. Butter is 8.13 on indigo and is
 * already in the palette, so the band keeps a warm accent with a real margin.
 *
 * ## Switching to a warm fill
 *
 * If Connectors should be burnt or flame instead, `FILL` is not the only edit:
 * every warm fill fails against cream, so `ON_FILL` has to become
 * `text-pana-ink` at the same time, and the band's `ACCENT` has to move to
 * something that survives on a light ground. Changing `FILL` alone will look
 * fine in a screenshot and fail contrast.
 *
 * Class strings are written out in full because Tailwind only emits utilities
 * it can see as complete literals — a template like `bg-pana-${tone}` compiles
 * to nothing.
 */
export const CONNECTORS_CHROME = {
  /** Filled dark surfaces: hero, card headers, table headers, buttons. */
  FILL: 'bg-pana-indigo',
  /** Borders that match the fill, for buttons that carry both. */
  BORDER: 'border-pana-indigo',
  /** Labels sitting on FILL. Valid only while FILL carries cream (see above). */
  ON_FILL: 'text-pana-cream',
  /** Hairlines dividing content inside a filled surface. */
  DIVIDE: 'divide-pana-cream/20',
  /** The same hairline as a single border edge. */
  RULE: 'border-pana-cream/20',
  /** The hairline again, pre-prefixed for the `lg:` breakpoint. Spelled out
   *  rather than composed, because Tailwind never sees `lg:${RULE}`. */
  RULE_LG: 'lg:border-pana-cream/20',
  /** Headline figures on FILL. Butter, not orange — see above. */
  ACCENT: 'text-pana-butter',
} as const;

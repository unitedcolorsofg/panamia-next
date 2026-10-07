/**
 * The shape a surface's chrome tokens have to take.
 *
 * Every surface keeps its own token object — `CONNECTORS_CHROME` in
 * `lib/connectors/theme.ts`, `ADMIN_CHROME` in `lib/admin/theme.ts` — holding
 * complete Tailwind class strings rather than colour names. That is not
 * stylistic: Tailwind v4 only emits a utility it can see written out in full,
 * so `bg-${name}` produces no CSS at all and a token has to carry the whole
 * literal, variant prefix included. Hence the separate `RULE_LG`.
 *
 * Those objects are `as const`, which makes each property a string *literal*
 * type, which in turn makes two surfaces' tokens mutually unassignable. This
 * interface is the widened version to annotate with when a component can be
 * handed either — see `CommitmentsTable`, which the Connectors HQ and the
 * admin console both render.
 *
 * Deliberately a pure type module with no imports and no runtime, so a theme
 * can conform to it without dragging anything into its bundle.
 */
export interface ChromeTokens {
  /** Solid background for header bars and filled pills. */
  readonly FILL: string;
  /** Border matching `FILL`, for outlined controls. */
  readonly BORDER: string;
  /** Text that sits *on* `FILL`. Not interchangeable between surfaces: the
   *  members' surfaces fill dark and set cream, admin fills light and sets
   *  ink. Swapping them is the single most likely contrast failure here. */
  readonly ON_FILL: string;
  /** Divider colour for a group sitting on `FILL`. */
  readonly DIVIDE: string;
  /** Rule colour for a single border on `FILL`. */
  readonly RULE: string;
  /** `RULE` with the `lg:` prefix already applied, written out in full
   *  because Tailwind will not compose one for us. */
  readonly RULE_LG: string;
  /** The one colour used for emphasis on both the fill and on cream. */
  readonly ACCENT: string;
}

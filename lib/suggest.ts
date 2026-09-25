// The shape the search typeahead speaks, shared by the API route that builds
// suggestions and the client component that renders them. Kept free of DB and
// server imports so the client bundle can hold it.

/**
 * What a suggestion *is*, which is the whole point of the row's icon.
 *
 * The four kinds do not come from one table and do not live under one route,
 * so a result list that showed only a name and a photo would be asking people
 * to guess where a click goes. A cafe, the pana who runs it, the group they
 * organise in, and this Saturday's event can all be called the same thing.
 */
export const SUGGESTION_KINDS = ['business', 'pana', 'group', 'event'] as const;

export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export interface Suggestion {
  kind: SuggestionKind;
  /** Unique within its own table, so rows are keyed by `kind:id` on the client. */
  id: string;
  name: string;
  /** One line of context under the name: a tagline, a city, a date. Optional. */
  subtitle: string | null;
  /** Where selecting the row goes. Built server-side so the client never
   *  has to know that businesses live at /p and groups at /r/groups. */
  href: string;
  imageUrl: string | null;
}

/**
 * How many rows the list holds, across every kind combined.
 *
 * Ten rather than the eight this started at, because the list now draws from
 * four sources instead of one: eight slots split four ways leaves too few of
 * each for the mix to read as a mix.
 */
export const SUGGEST_LIMIT = 10;

/** Matches the API's floor. Below it the list never opens. */
export const MIN_TERM_LENGTH = 2;

/** Long terms are always someone pasting; nothing past this narrows anything. */
export const MAX_TERM_LENGTH = 100;

/**
 * i18n key for a kind's human name, used in the row's screen-reader label.
 *
 * The icon carries this for sighted users; a screen reader gets the word,
 * because "Café Lucía, business" and "Café Lucía, event" are otherwise the
 * same announcement.
 */
export const kindLabelKey = (kind: SuggestionKind) => `search.kind.${kind}`;

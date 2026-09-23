/**
 * Reading a county out of profiles.counties.
 *
 * One definition, imported by everything that renders a county, because this
 * column has two storage shapes and a caller that knows about only one of them
 * fails silently: it renders no county rather than an error, which looks like
 * a member who never set their address instead of a reader that cannot parse
 * what they saved.
 *
 * The two shapes, both live in the same table:
 *   - `{ miami_dade: true }` — the address form's checkboxes, and what
 *     app/api/profile/saveAddress writes today.
 *   - `['miami_dade']` — older rows, predating the form. lib/server/directory
 *     has carried an array branch in jsonKeys for exactly this reason.
 *
 * NOTE ON TRUST: these values are self-declared. A member ticks the counties
 * they are in and nothing checks it. profiles.verification exists for the
 * billing-zip check that would make it an assertion, but nothing writes or
 * reads that column yet, so a county must not be rendered with a verification
 * check mark. Show it as a location, not as a credential.
 */

import { countyList } from '@/lib/lists';

/**
 * Every county set on a profile, canonicalised against countyList.
 *
 * Unknown keys are dropped rather than passed through, so a typo in stored
 * data cannot reach the page as a label.
 */
export function countyKeys(raw: unknown): string[] {
  const keys = Array.isArray(raw)
    ? raw.filter((entry): entry is string => typeof entry === 'string')
    : raw && typeof raw === 'object'
      ? Object.entries(raw as Record<string, unknown>)
          .filter(([, on]) => on === true)
          .map(([key]) => key)
      : [];

  return keys.filter((key) => countyList.some((entry) => entry.value === key));
}

/**
 * The single county to show beside a person's name.
 *
 * A business can serve several counties, but a byline has room for one and a
 * person lives in one, so the first match in countyList order wins rather than
 * rendering a list. Returns null when nothing is set, which every caller
 * should treat as "do not render the badge" rather than as an empty string.
 */
export function countyLabel(raw: unknown): string | null {
  const keys = countyKeys(raw);
  if (keys.length === 0) return null;

  const match = countyList.find((entry) => keys.includes(entry.value));
  return match?.desc ?? null;
}

/**
 * Short forms, for a byline rather than a form field.
 *
 * countyList.desc is written for the directory filter list, where a member is
 * choosing where to search and "Broward/Ft Lauderdale" is the helpful answer.
 * Beside a name in an 11px badge it is three words of chrome, so these are the
 * compact readings of the same counties.
 *
 * Keyed by the same canonical values, deliberately: a short form is an
 * abbreviation of a county the filters already know, never a new one. Anything
 * missing here falls back to the long form rather than disappearing -- a
 * county added to countyList and forgotten here should read oddly, not vanish.
 */
const COUNTY_SHORT_LABEL: Record<string, string> = {
  palm_beach: 'Palm Beach',
  broward: 'Broward',
  miami_dade: 'Miami-Dade',
};

/**
 * The county to show in a byline. Same selection rule as countyLabel, shorter
 * wording.
 */
export function countyShortLabel(raw: unknown): string | null {
  const keys = countyKeys(raw);
  if (keys.length === 0) return null;

  const match = countyList.find((entry) => keys.includes(entry.value));
  if (!match) return null;

  return COUNTY_SHORT_LABEL[match.value] ?? match.desc;
}

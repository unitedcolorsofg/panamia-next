import type { Metadata } from 'next';
import { DirectoryScopesMock } from './_components/directory-scopes-mock';

/* Design mock for a SCOPED directory search — the page Enter should land on.
 *
 * The typeahead shipped in the masthead offers four kinds: businesses, panas,
 * groups and events. Pressing Enter sends you to /directory/search, which
 * filters to DIRECTORY_ACCOUNT_TYPES and can therefore only ever return
 * businesses. Type "maria", see a pana in the dropdown, press Enter, get
 * nothing. The dropdown is not wrong and the results page is not broken —
 * they are answering two different questions.
 *
 * This mock proposes the fix the data actually supports: carry the scope
 * through the Enter, and give each kind the view its columns allow.
 *
 *   Businesses  list + map   address_lat / address_lng live on the profile
 *   Events      list + map   coordinates borrowed from the joined venue
 *   Panas       list only    personal accounts store no address, by policy
 *   Groups      list only    relay_groups has no location column at all
 *
 * The two list-only scopes are the load-bearing part of the argument. A map
 * of panas would mean storing where members live, which is exactly what
 * ADDRESS_FIELDS_CLEARED_ON_DOWNGRADE exists to prevent — so the absence of a
 * map there is a product decision being shown, not a feature left out.
 *
 * Noindex because it is a fixture route with invented businesses and people.
 */
export const metadata: Metadata = {
  title: 'Scoped directory search (mock) | Pana Mia',
  robots: { index: false, follow: false },
};

export default function MockDirectoryScopesPage() {
  return <DirectoryScopesMock />;
}

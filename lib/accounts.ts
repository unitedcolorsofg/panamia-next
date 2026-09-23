// Account-type policy shared by every surface that decides who is publicly
// listed. Kept free of DB/axios imports so both server queries and client
// components can use it.

/**
 * Account types published in the directory, search suggestions, and sitemap.
 *
 * Every signed-in user gets a profile row (see
 * app/api/user/screenname/set/route.ts), so `profiles.active` alone no longer
 * means "this is a listing" — it just means the row is usable. Listing is
 * decided by what the account says it is.
 *
 * 'personal' is excluded: those are members who search the directory rather
 * than appear in it. 'other' is excluded too — it is an unresolved
 * self-description, and defaulting it to public would leak accounts that never
 * asked to be listed. Opting in means choosing small_business or hybrid.
 */
export const DIRECTORY_ACCOUNT_TYPES = ['small_business', 'hybrid'] as const;

export type DirectoryAccountType = (typeof DIRECTORY_ACCOUNT_TYPES)[number];

export const isDirectoryAccountType = (
  value: string | null | undefined
): boolean =>
  !!value && (DIRECTORY_ACCOUNT_TYPES as readonly string[]).includes(value);

/**
 * Profile columns that must be cleared when an account reverts to 'personal'.
 *
 * Personal profiles must not retain street addresses — the rebuild notes in
 * app/form/become-a-pana/page.tsx set this to limit FIPA breach exposure. The
 * profile and its social identity survive a downgrade; only the listing data
 * goes.
 *
 * There is no downgrade path in the product yet — nothing currently writes
 * 'personal' back onto an account. This lives here so the policy is applied
 * when that path is built, instead of being rediscovered.
 */
export const ADDRESS_FIELDS_CLEARED_ON_DOWNGRADE = [
  'addressLine1',
  'addressLine2',
  'addressLine3',
  'addressLocality',
  'addressRegion',
  'addressPostalCode',
  'addressCountry',
  'addressLat',
  'addressLng',
  'addressGooglePlaceId',
] as const;

/** Patch that clears every address column, for `db.update(profiles).set(...)`. */
export const clearedAddressPatch = (): Record<string, null> =>
  Object.fromEntries(
    ADDRESS_FIELDS_CLEARED_ON_DOWNGRADE.map((field) => [field, null])
  );

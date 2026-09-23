#!/usr/bin/env npx tsx
/**
 * Seed Development Data
 *
 * The base data layer: users, profiles, and listing ownership. Everything the
 * app needs before anyone can sign in and look at something.
 *
 * WHY THIS FILE EXISTS
 *
 * Until now there was no committed seed. The local database was passed around
 * as untracked state, so every checkout had slightly different data and three
 * people debugging the same page were looking at three different realities.
 * That is not a tidiness problem — a fixture that differs from production in
 * the wrong field actively teaches you the wrong conclusion:
 *
 *   - The business listing carried `status = NULL` instead of the
 *     `business_intake` marker. `notBusinessListing` tests
 *     `status->>'source' IS DISTINCT FROM 'business_intake'`, so a NULL row
 *     PASSES the guard. The auto-claim protection in auth.ts, profile.ts,
 *     screenname/set and oauth/complete-verification was untestable locally in
 *     either direction: the listing got swallowed and the guard looked broken.
 *   - Every user was `personal`, so `DIRECTORY_ACCOUNT_TYPES` matched nothing
 *     and the directory, homepage featured strip and search typeahead all
 *     returned zero rows. Empty and broken look identical from the outside.
 *   - `counties` was set on 3 profiles out of 15, so the feed's county badge
 *     rendered for almost nobody.
 *
 * So this file's job is not "make some rows". It is to reproduce the SHAPES
 * that production writers actually produce, and each one below cites the
 * writer it mirrors. When those writers change, this must change with them.
 *
 * Usage:
 *   npx tsx scripts/seed-dev-data.ts        (or: yarn db:seed)
 *
 * Safe to re-run: every row is upserted by a stable `seed_`-prefixed id, so a
 * second run repairs drift rather than duplicating.
 *
 * Local databases only — it writes rows as other people's accounts.
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

/** Headshots and partner images that actually exist under public/img. */
const FACES = [
  '/img/about/anette_mago.jpg',
  '/img/about/bee_maria.jpg',
  '/img/about/claribel_avila.jpg',
  '/img/about/gbarrios.jpg',
  '/img/about/jdowns.jpg',
  '/img/about/bubbles_navy.jpg',
  '/img/about/clari_and_anette.webp',
];

type CountyKey = 'miami_dade' | 'broward' | 'palm_beach';

/** lib/interfaces.ts ProfileCountiesInterface: all three keys, booleans. */
function counties(on: CountyKey) {
  return {
    palm_beach: on === 'palm_beach',
    broward: on === 'broward',
    miami_dade: on === 'miami_dade',
  };
}

/**
 * The fourteen personal members.
 *
 * Real names and counties throughout, because "Pana 6" with no county and no
 * photograph renders as a placeholder and tells you nothing about whether the
 * page you are looking at works.
 */
const PEOPLE: {
  n: number;
  name: string;
  county: CountyKey;
  image: string | null;
}[] = [
  { n: 1, name: 'Anette M.', county: 'miami_dade', image: FACES[0] },
  { n: 2, name: 'Maria B.', county: 'broward', image: FACES[1] },
  { n: 3, name: 'Claribel A.', county: 'palm_beach', image: FACES[2] },
  { n: 4, name: 'G. Barrios', county: 'miami_dade', image: FACES[3] },
  { n: 5, name: 'J. Downs', county: 'broward', image: FACES[4] },
  { n: 6, name: 'Rosa Delgado', county: 'miami_dade', image: FACES[5] },
  { n: 7, name: 'Yunior Paz', county: 'miami_dade', image: FACES[6] },
  { n: 8, name: 'Tasha Willems', county: 'broward', image: FACES[0] },
  { n: 9, name: 'Ivan Castellanos', county: 'palm_beach', image: FACES[3] },
  // The tail deliberately has no photograph. Production is full of profiles
  // that never uploaded one, and a card that is all-photo needs a row that
  // proves it excludes them rather than rendering an empty box.
  { n: 10, name: 'Dee Okafor', county: 'miami_dade', image: null },
  { n: 11, name: 'Marisol Vega', county: 'broward', image: null },
  { n: 12, name: 'Andre Lemoine', county: 'miami_dade', image: null },
  { n: 13, name: 'Priya Raman', county: 'palm_beach', image: null },
  { n: 14, name: 'Beto Nuñez', county: 'broward', image: null },
];

function line(label: string, value: string | number): void {
  console.log(`  ${label.padEnd(30)} ${value}`);
}

async function main(): Promise<void> {
  const connectionString =
    process.env.POSTGRES_URL ?? process.env.POSTGRES_DIRECT_URL;
  if (!connectionString) {
    console.error('Error: POSTGRES_URL is required (check .env.local)');
    process.exit(1);
  }
  process.env.POSTGRES_URL = connectionString;

  const target = connectionString.replace(/\/\/[^@]*@/, '//***@').split('?')[0];
  if (!/localhost|127\.0\.0\.1/.test(connectionString)) {
    console.error('Refusing to run: this only targets a local database.');
    console.error('Database:', target);
    process.exit(1);
  }

  // Deferred for the same reason scripts/seed-test-account.ts defers: modules
  // under lib/federation read NEXT_PUBLIC_HOST_URL and FEDERATION_DOMAIN at
  // import time, so importing before config() above resolves them against a
  // different environment than the one the dev server will use.
  const [{ db }, schema, { createActorForProfile }] = await Promise.all([
    import('../lib/db'),
    import('../lib/schema'),
    import('../lib/federation/wrappers/actor'),
  ]);
  const { BUSINESS_INTAKE_SOURCE } =
    await import('../lib/server/profile-owners');
  const { createUniqueString } = await import('../lib/standardized');
  const { eq, sql } = await import('drizzle-orm');

  console.log('SEED:start');
  console.log('Database:', target, '\n');

  const now = new Date();

  // ---------------------------------------------------------------- users --
  console.log('Users');

  const userRows = [
    ...PEOPLE.map((p) => ({
      id: `seed_u_${p.n}`,
      email: `pana${p.n}@example.test`,
      emailVerified: true,
      name: p.name,
      screenname: `pana${p.n}`,
      // Personal accounts search the directory; they do not appear in it.
      accountType: 'personal' as const,
    })),
    {
      // The branch nothing covered. app/api/directory/featured and getSearch
      // admit a row EITHER because it has no user at all (an intake listing)
      // OR because its user is small_business/hybrid. With every seeded user
      // personal, the second branch never ran and could not be distinguished
      // from dead code.
      id: 'seed_u_15',
      email: 'pana15@example.test',
      emailVerified: true,
      name: 'Lucia Ferrer',
      screenname: 'taller-lucia',
      accountType: 'small_business' as const,
    },
  ];

  for (const u of userRows) {
    await db
      .insert(schema.users)
      .values(u)
      .onConflictDoUpdate({ target: schema.users.id, set: u });
  }
  line('upserted', userRows.length);
  line('small_business / hybrid', 1);

  // ------------------------------------------------------------- profiles --
  console.log('\nProfiles');

  /** A member's own identity profile: userId set, no intake marker. */
  const personalProfiles = PEOPLE.map((p) => ({
    id: `seed_p_${p.n}`,
    userId: `seed_u_${p.n}`,
    screenname: `pana${p.n}`,
    email: `pana${p.n}@example.test`,
    name: p.name,
    active: true,
    primaryImageCdn: p.image,
    counties: counties(p.county),
    descriptions: {
      fiveWords: 'local, curious, around, building, here',
      details: `${p.name} is part of the Pana MIA community in South Florida.`,
    },
    // No `status` marker: this is a person, not a listing. These are exactly
    // the rows auto-claim is SUPPOSED to attach at sign-in.
    status: null,
  }));

  /**
   * A sole trader: their own identity profile IS their listing.
   *
   * Directory-eligible through users.accountType rather than through having no
   * user, which is the other half of the `or()` in the featured query.
   */
  const soleTrader = {
    id: 'seed_p_15',
    userId: 'seed_u_15',
    screenname: 'taller-lucia',
    email: 'pana15@example.test',
    name: 'Taller Lucía',
    active: true,
    primaryImageCdn: '/img/impact/partner-allpeep.webp',
    counties: counties('miami_dade'),
    addressLocality: 'Miami',
    // Canonical lib/lists values, which is what the account form writes today.
    categories: ['art', 'products'],
    descriptions: {
      fiveWords: 'Handbound books, paper, repair',
      details:
        'A one-person bindery in Little Haiti. Repairs, editions, and a standing Tuesday workshop.',
    },
    socials: { instagram: 'https://instagram.com/tallerlucia' },
    status: null,
  };

  /**
   * A claimed and approved business listing.
   *
   * Shape mirrors three writers in sequence, and the marker surviving all of
   * them is the point:
   *   1. app/api/listings/intake      -> userId NULL, active false,
   *                                      status.submitted/access/source
   *   2. app/api/listings/claim/verify-> addProfileOwner(), and notably does
   *                                      NOT set userId or touch status
   *   3. app/api/admin/profile/action -> active true, status spread + approved
   *
   * So `source: business_intake` is still here after claiming. That is what
   * makes notBusinessListing meaningful, and what the old fixture lost by
   * storing status = NULL.
   */
  const claimedListing = {
    id: 'seed_biz_bohemian',
    // Stays NULL forever. Ownership lives in profile_owners so one person can
    // run several listings; see lib/schema/index.ts on profiles.userId.
    userId: null,
    screenname: 'bohemian-kitchen',
    email: 'hello@bohemiankitchen.test',
    name: 'Bohemian Kitchen',
    active: true,
    primaryImageCdn: '/img/impact/partner-dale.webp',
    addressLocality: 'Miami',
    counties: counties('miami_dade'),
    // Deliberately the legacy MongoDB vocabulary rather than lib/lists values.
    // lib/server/directory.ts canonical() exists to map these, and production
    // is full of migrated rows shaped exactly like this — if every seeded row
    // used the modern vocabulary that mapping would never run locally.
    categories: ['Food & Drink', 'Catering'],
    descriptions: {
      fiveWords: 'Caribbean, plant-forward, loud, generous, local',
      details:
        'A plant-forward Caribbean kitchen run out of Little Havana since 2019. We cater community dinners, run pop-ups with local farmers, and teach a monthly croqueta workshop.',
      background:
        'Started as a supper club in a second-floor apartment. Two of us, one rice cooker, a lot of opinions about sofrito.',
      tags: 'catering, vegan, caribbean, pop-up, workshops, cuban',
    },
    socials: {
      instagram: 'https://instagram.com/bohemiankitchen',
      facebook: 'https://facebook.com/bohemiankitchen',
      tiktok: 'https://tiktok.com/@bohemiankitchen',
      website: 'https://example.com/bohemian-kitchen',
    },
    status: {
      submitted: new Date(now.getTime() - 86400000 * 30).toISOString(),
      approved: new Date(now.getTime() - 86400000 * 28).toISOString(),
      access: createUniqueString(),
      source: BUSINESS_INTAKE_SOURCE,
    },
  };

  /**
   * An unclaimed PERSONAL profile — the positive case for auto-claim.
   *
   * The MongoDB migration created profiles for people who had never signed up,
   * which is the whole reason implicit auto-claim exists: they sign in with a
   * matching email later and inherit their own row.
   *
   * It is here so the guard's discrimination is observable rather than assumed.
   * This row and `pendingListing` below are both unclaimed and both match on
   * email; they differ ONLY in `status.source`. One must attach at sign-in and
   * one must not. With just the business listing seeded, "nothing was claimed"
   * would prove nothing — it looks identical to auto-claim being broken.
   *
   * No screenname and no photograph, both realistic for a migrated row, and
   * both of which also keep it out of the directory: it is a person, not a
   * listing, and the `user_id IS NULL` branch of the featured query would
   * otherwise admit it.
   */
  const unclaimedPerson = {
    id: 'seed_p_legacy',
    userId: null,
    screenname: null,
    email: 'newcomer@example.test',
    name: 'Sofia Reyes',
    active: true,
    primaryImageCdn: null,
    counties: counties('palm_beach'),
    descriptions: {
      details: 'Imported from the old site. Has never signed in.',
    },
    status: null,
  };

  /**
   * An unclaimed, unapproved submission — straight out of the public form.
   *
   * Two jobs, both negative:
   *   - It is what auto-claim must refuse. With the old NULL-status fixture
   *     there was no row in the database that the guard would actually reject,
   *     so the protection could not be observed working.
   *   - active: false must keep it off the homepage. Anyone could otherwise
   *     put arbitrary text on the front page by filling in a public form.
   */
  const pendingListing = {
    id: 'seed_biz_pending',
    userId: null,
    // No handle yet: the owner picks one when they claim it.
    screenname: null,
    email: 'hola@ventanitacafe.test',
    name: 'Ventanita Café',
    active: false,
    primaryImageCdn: null,
    counties: counties('broward'),
    descriptions: {
      fiveWords: 'Coffee, pastelitos, early, cheap, corner',
      details: 'Walk-up window on Davie Blvd. Open from five.',
      tags: '',
      hearaboutus: '',
    },
    socials: { instagram: 'https://instagram.com/ventanitacafe', website: '' },
    status: {
      submitted: now.toISOString(),
      access: createUniqueString(),
      source: BUSINESS_INTAKE_SOURCE,
      // No `approved` key: staff have not actioned it.
    },
  };

  const profileRows = [
    ...personalProfiles,
    soleTrader,
    unclaimedPerson,
    claimedListing,
    pendingListing,
  ];

  for (const p of profileRows) {
    await db
      .insert(schema.profiles)
      .values(p)
      .onConflictDoUpdate({ target: schema.profiles.id, set: p });
  }
  line('upserted', profileRows.length);
  line('identity profiles', personalProfiles.length + 1);
  line('unclaimed (auto-claim bait)', 1);
  line('business listings', 2);

  // -------------------------------------------------------- listing owner --
  console.log('\nOwnership');

  // What claim/verify writes. Note it grants administration WITHOUT setting
  // profiles.userId — that separation is the thing the OAuth guard protects.
  const owner = {
    id: 'seed_owner_bohemian',
    profileId: 'seed_biz_bohemian',
    userId: 'seed_u_1',
    role: 'owner' as const,
  };
  await db
    .insert(schema.profileOwners)
    .values(owner)
    .onConflictDoUpdate({ target: schema.profileOwners.id, set: owner });
  line('profile_owners', 1);
  line('pana1 administers', 'Bohemian Kitchen');

  // --------------------------------------------------------------- actor ---
  console.log('\nFederation');

  // The old fixture inserted this actor by hand with private_key NULL, which
  // no code path produces: createActorForProfile always generates a keypair.
  // An actor that cannot sign fails only when something tries to federate, so
  // it is dropped here and rebuilt through the real writer instead.
  const existing = await db.query.socialActors.findFirst({
    where: eq(schema.socialActors.id, 'seed_actor_bohemian'),
  });
  if (existing) {
    await db
      .delete(schema.socialActors)
      .where(eq(schema.socialActors.id, 'seed_actor_bohemian'));
    line('removed keyless actor', 'seed_actor_bohemian');
  }

  const actorResult = await createActorForProfile('seed_biz_bohemian');
  line(
    'business actor',
    actorResult.success ? 'created (signing key present)' : actorResult.error
  );

  // -------------------------------------------------------------- verify ---
  // Re-query with the SAME predicates the application uses, rather than
  // trusting that the inserts above meant what they said. A seed that reports
  // its own intent is not evidence; these are the real filters.
  console.log('\nVerification (re-queried with production predicates)');

  // Mirrors app/api/directory/featured exactly: left join, handle from either
  // side, photograph required, and eligible EITHER by having no user at all or
  // by account type.
  const [{ eligible }] = (await db.execute(sql`
    SELECT count(*)::int AS eligible
    FROM profiles p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.active = true
      AND COALESCE(p.screenname, u.screenname) IS NOT NULL
      AND p.primary_image_cdn IS NOT NULL
      AND (p.user_id IS NULL OR u.account_type IN ('small_business', 'hybrid'))
  `)) as unknown as { eligible: number }[];

  const [{ marked }] = (await db.execute(sql`
    SELECT count(*)::int AS marked FROM profiles
    WHERE status->>'source' = ${BUSINESS_INTAKE_SOURCE}
  `)) as unknown as { marked: number }[];

  // The guard's own predicate, verbatim from lib/server/profile-owners.ts:
  // rows auto-claim would attach to a signing-in user. `IS DISTINCT FROM`
  // rather than `<>` because status is NULL on every personal profile and
  // NULL <> 'x' is NULL, not true — `<>` would filter out everything.
  //
  // Selected as ids rather than counted, because the count alone cannot tell
  // "the guard discriminates" from "the guard rejects everything".
  const claimableRows = (await db.execute(sql`
    SELECT id FROM profiles
    WHERE user_id IS NULL
      AND (status->>'source' IS DISTINCT FROM ${BUSINESS_INTAKE_SOURCE})
    ORDER BY id
  `)) as unknown as { id: string }[];
  const claimableIds = claimableRows.map((r) => r.id);

  const [{ unapproved }] = (await db.execute(sql`
    SELECT count(*)::int AS unapproved FROM profiles
    WHERE status->>'source' = ${BUSINESS_INTAKE_SOURCE} AND active = false
  `)) as unknown as { unapproved: number }[];

  line('directory-eligible', `${eligible}  (expect 2)`);
  line('marked business_intake', `${marked}  (expect 2)`);
  line('intake awaiting approval', `${unapproved}  (expect 1)`);
  line(
    'auto-claimable',
    `${claimableIds.join(', ') || '(none)'}  (expect seed_p_legacy only)`
  );

  // Both halves stated separately. A business listing absent from the list is
  // the guard working; the personal row present is auto-claim still working at
  // all. Asserting only the first would pass if the predicate matched nothing.
  const guardHolds = !claimableIds.some((id) => id.startsWith('seed_biz_'));
  const autoClaimAlive = claimableIds.includes('seed_p_legacy');

  const ok =
    eligible === 2 &&
    marked === 2 &&
    unapproved === 1 &&
    guardHolds &&
    autoClaimAlive &&
    claimableIds.length === 1;

  if (!ok) {
    console.error(
      '\n[fail] Seeded data does not match the expected shape above.\n' +
        'Either a production writer changed and this file has drifted, or the\n' +
        'database already held conflicting rows. Do not trust local results\n' +
        'until this agrees.'
    );
    console.log('SEED:done');
    process.exit(1);
  }

  console.log('\n[ok] Base data seeded and verified\n');
  console.log('Next, for the social graph (actors, Panas, posts):');
  console.log('  npx tsx scripts/seed-test-account.ts pana1');
  console.log('\nThen sign in as any member with:');
  console.log('  npx tsx scripts/create-signin-link.ts pana1@example.test');
  console.log('');
  console.log('SEED:done');
  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  console.log('SEED:done');
  process.exit(1);
});

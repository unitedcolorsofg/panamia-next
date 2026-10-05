/**
 * The profiles.email collision at screenname assignment
 *
 * app/api/user/screenname/set/route.ts creates a profile for any signed-in
 * member who does not have one yet. Before inserting, it looks for an unclaimed
 * profile already holding their email, and its own comment states the reason:
 *
 *   "re-check here so we can never trip the unique constraint on profiles.email"
 *
 * That lookup excludes business listings via `notBusinessListing`, and the
 * exclusion is correct — absorbing a listing into profiles.userId would make
 * the human *be* the business, burn their single 1:1 identity slot, and let an
 * attacker-supplied email from the public unauthenticated intake form be
 * absorbed into a real account. See lib/server/profile-owners.ts:17-28.
 *
 * But the exclusion also means the lookup misses the one row that will reject
 * the insert. A solo vendor who lists their business through the public intake
 * form using their own personal address creates a profile holding that address
 * with userId NULL. auth.ts skips it at sign-in for the same correct reason.
 * So when they set a screenname, the lookup returns nothing, control falls to
 * the bare insert, and Postgres rejects it on profiles_email_unique.
 *
 * These tests pin that mechanism to the data layer. They assert the *specific*
 * SQLSTATE and constraint rather than merely that something rejected, because
 * a test that only expects a throw passes just as happily when it throws for an
 * unrelated reason — a foreign key, a NOT NULL, a timeout.
 *
 * They deliberately do not assert what the route should do instead. Making the
 * collision survivable is a schema-semantics question (does profiles.email need
 * to be unique at all, when users.email is already unique and authoritative?)
 * and it belongs to the repo owner. What is pinned here is only that the
 * collision is real and that the route's guard can recognise it.
 *
 * Every fixture is created under a per-run random suffix and deleted in the
 * `after` hook, so this is safe against a shared or seeded database. It never
 * truncates anything.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from 'dotenv';

// lib/db reads POSTGRES_URL when the module is first evaluated, and static
// imports hoist above this call. The dynamic imports below are what keep the
// env in place before the connection is built.
config({ path: '.env.local' });

const { db } = await import('@/lib/db');
const { and, eq, isNull } = await import('drizzle-orm');
const { profiles, users } = await import('@/lib/schema');
const { notBusinessListing, BUSINESS_INTAKE_SOURCE } = await import(
  '@/lib/server/profile-owners'
);
const { describeDbError, isUniqueViolation } = await import(
  '@/lib/server/db-error'
);

const suffix = Math.random().toString(36).slice(2, 8);

// The solo vendor's one and only address. It is on their user row *and* on the
// business listing they submitted, which is the whole shape of the bug.
const vendorEmail = `sn-vendor-${suffix}@test.invalid`;
// A legacy personal profile, for the control case.
const legacyEmail = `sn-legacy-${suffix}@test.invalid`;

let vendorUserId: string;
let legacyProfileId: string;

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];

before(async () => {
  // The human. Signed in, no profile of their own yet — exactly the state the
  // route's `if (!currentUser?.profile)` branch is written for.
  const [vendor] = await db
    .insert(users)
    .values({ email: vendorEmail, name: 'Solo Vendor' })
    .returning();
  vendorUserId = vendor.id;
  createdUserIds.push(vendor.id);

  // Their business, as app/api/listings/intake/route.ts writes it: no owner,
  // marked by status.source. The email is the vendor's own personal address,
  // because a one-person business has no other address to give.
  const [listing] = await db
    .insert(profiles)
    .values({
      userId: null,
      email: vendorEmail,
      name: 'Solo Vendor Bakery',
      status: { source: BUSINESS_INTAKE_SOURCE },
    })
    .returning();
  createdProfileIds.push(listing.id);

  // An admin-imported personal profile waiting for its owner to sign in.
  // Identical to the listing except for status.source, which is the point.
  const [legacy] = await db
    .insert(profiles)
    .values({ userId: null, email: legacyEmail, name: 'Legacy Person' })
    .returning();
  legacyProfileId = legacy.id;
  createdProfileIds.push(legacy.id);
});

after(async () => {
  for (const id of createdProfileIds) {
    await db.delete(profiles).where(eq(profiles.id, id));
  }
  for (const id of createdUserIds) {
    await db.delete(users).where(eq(users.id, id));
  }

  // postgres.js holds the process open otherwise, which hangs the runner.
  const client = (db as unknown as { $client?: { end?: () => Promise<void> } })
    .$client;
  await client?.end?.();
});

/**
 * The control. Without this, the reproduction below proves nothing: a lookup
 * that found nothing because the fixture was malformed would look identical to
 * one that found nothing because of the filter.
 */
test('the unclaimed lookup finds a legacy personal profile', async () => {
  const unclaimed = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.email, legacyEmail),
      isNull(profiles.userId),
      notBusinessListing
    ),
    columns: { id: true },
  });

  assert.equal(
    unclaimed?.id,
    legacyProfileId,
    'the lookup must still adopt legacy personal profiles — that is what it is for'
  );
});

/**
 * The gap. Same query, same unclaimed state, same matching email; the only
 * difference from the control is status.source.
 */
test('the unclaimed lookup misses a business listing holding the same email', async () => {
  const unclaimed = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.email, vendorEmail),
      isNull(profiles.userId),
      notBusinessListing
    ),
    columns: { id: true },
  });

  assert.equal(
    unclaimed,
    undefined,
    'notBusinessListing must keep excluding listings — the exclusion is load-bearing security, not the bug'
  );
});

/**
 * The 500. Having found nothing above, the route falls through to a bare insert
 * with no onConflict and, before this PR, no catch anywhere in the file.
 */
test('the insert the route falls through to is rejected on profiles_email_unique', async () => {
  // Mirrors app/api/user/screenname/set/route.ts exactly: userId, email, name,
  // active. profiles.userId is also unique, and this user has no profile, so it
  // is free — asserting the constraint name below is what proves the rejection
  // came from the email collision and not from something incidental.
  const rejection = await db
    .insert(profiles)
    .values({
      userId: vendorUserId,
      email: vendorEmail,
      name: 'solovendor',
      active: true,
    })
    .returning({ id: profiles.id })
    .then(
      (rows) => {
        // Should be unreachable. Registered for cleanup regardless, so a
        // non-reproduction does not also leak a row into a shared database.
        for (const row of rows) createdProfileIds.push(row.id);
        return null;
      },
      (err: unknown) => err
    );

  assert.ok(
    rejection,
    'the insert succeeded — profiles.email is no longer unique, and this analysis is stale'
  );

  const details = describeDbError(rejection);

  // Printed so the CI log carries the actual Postgres error, not just a green
  // tick. The evidence is the deliverable here; a passing assertion proves the
  // shape held but shows the reader nothing.
  console.log('[repro] profiles.email collision:', {
    code: details.code,
    constraint: details.constraint,
    table: details.table,
    detail: details.detail,
    message: details.message,
  });

  assert.equal(
    details.code,
    '23505',
    `expected a unique violation, got ${details.code}: ${details.message}`
  );
  assert.equal(
    details.constraint,
    'profiles_email_unique',
    `expected the email constraint to be the one that rejected this, got ${details.constraint}`
  );

  // The route's guard classifies with this helper, so pin it against the real
  // driver error rather than a synthetic one. If postgres.js ever stops
  // populating these fields, the guard degrades to a 500 and this catches it.
  assert.equal(
    isUniqueViolation(rejection),
    true,
    'the route guard would not recognise this error, so it would still 500'
  );
});

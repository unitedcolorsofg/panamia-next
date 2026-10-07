/**
 * Profile ownership tests
 *
 * Exercises lib/server/profile-owners.ts against a real Postgres, specifically
 * the question app/welcome/start asks before offering the "List your business"
 * door: does this member already run a listing?
 *
 * The invariant here is the one that is easy to get backwards. Migration 0035
 * backfilled an owner row for *every* profile already attached to a user, so
 * "has a profile_owners row" is true for essentially every member who has ever
 * signed in. A check written that way reports that everybody already runs a
 * business and hides the door from all of them — the exact inverse of the bug
 * it was meant to fix, and invisible without a backfilled row to prove it.
 *
 * Kept out of the Playwright suite (tests/) because there is no browser here:
 * this calls the helper directly, the same way the page does.
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
const { eq } = await import('drizzle-orm');
const { profiles, users, profileOwners } = await import('@/lib/schema');
const { administersOtherProfile, BUSINESS_INTAKE_SOURCE } =
  await import('@/lib/server/profile-owners');

const suffix = Math.random().toString(36).slice(2, 8);

let soloUserId: string;
let ownerUserId: string;
let editorUserId: string;
let barrenUserId: string;
let listingProfileId: string;

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];

/**
 * A plain member, exactly as the backfill left them: an identity profile plus
 * the owner row migration 0035 wrote for it. The owner row is the whole point
 * of the fixture — without it these tests pass against a broken check.
 */
async function makeMemberWithOwnProfile(label: string): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({ email: `po-${label}-${suffix}@test.invalid`, name: label })
    .returning();
  createdUserIds.push(user.id);

  const [profile] = await db
    .insert(profiles)
    .values({
      email: `po-${label}-${suffix}@test.invalid`,
      name: label,
      userId: user.id,
    })
    .returning();
  createdProfileIds.push(profile.id);

  await db
    .insert(profileOwners)
    .values({ profileId: profile.id, userId: user.id, role: 'owner' });

  return user.id;
}

before(async () => {
  soloUserId = await makeMemberWithOwnProfile('solo');
  ownerUserId = await makeMemberWithOwnProfile('owner');
  editorUserId = await makeMemberWithOwnProfile('editor');

  const [barren] = await db
    .insert(users)
    .values({ email: `po-barren-${suffix}@test.invalid`, name: 'Barren' })
    .returning();
  barrenUserId = barren.id;
  createdUserIds.push(barren.id);

  // A listing as the intake form writes it: no user attached, identified by
  // status.source. Ownership arrives separately, through the claim flow.
  const [listing] = await db
    .insert(profiles)
    .values({
      email: `po-listing-${suffix}@test.invalid`,
      name: 'Cafe Listing',
      status: { source: BUSINESS_INTAKE_SOURCE },
    })
    .returning();
  listingProfileId = listing.id;
  createdProfileIds.push(listing.id);

  await db.insert(profileOwners).values([
    { profileId: listingProfileId, userId: ownerUserId, role: 'owner' },
    { profileId: listingProfileId, userId: editorUserId, role: 'editor' },
  ]);
});

after(async () => {
  for (const id of createdProfileIds) {
    await db.delete(profiles).where(eq(profiles.id, id));
  }
  // profile_owners cascades from both sides, so the rows above go with them.
  for (const id of createdUserIds) {
    await db.delete(users).where(eq(users.id, id));
  }

  // postgres.js holds the process open otherwise, which hangs the runner.
  const client = (db as unknown as { $client?: { end?: () => Promise<void> } })
    .$client;
  await client?.end?.();
});

test('a member with only their own profile administers nothing else', async () => {
  // The backfilled owner row on their identity profile must not count. If it
  // does, every signed-in member looks like a business owner.
  assert.equal(await administersOtherProfile(soloUserId), false);
});

test('owning a claimed listing counts', async () => {
  assert.equal(await administersOtherProfile(ownerUserId), true);
});

test('a non-owner role on a listing still counts', async () => {
  // Deliberate: anyone trusted to edit a listing is already connected to one,
  // so the onboarding nudge to create a first listing is noise for them. The
  // door is a shortcut, not a gate — /form/get-listed stays reachable
  // from the nav either way.
  assert.equal(await administersOtherProfile(editorUserId), true);
});

test('a user with no profile at all administers nothing', async () => {
  assert.equal(await administersOtherProfile(barrenUserId), false);
});

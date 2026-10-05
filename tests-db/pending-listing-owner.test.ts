/**
 * Pending listing invitation tests
 *
 * Exercises lib/server/pending-listing-owner.ts against a real Postgres.
 *
 * The invariant worth protecting is the one that is quiet when broken:
 * accepting a listing must grant a profile_owners row and must leave
 * profiles.userId NULL. profiles.userId is UNIQUE and is the human's own
 * identity profile, so writing a business into it would both make the person
 * *be* the business and consume the single slot that lets them run a second
 * listing later. Nothing in the API surface says which wire was used — only a
 * query can tell — so it is asserted directly here.
 *
 * The other half is that this is an invitation and not an automatic grant.
 * pending_owner_email is written by the public, unauthenticated intake form,
 * so a stranger can name any address they like. Declining has to be a real
 * outcome that withdraws the offer without touching the listing, and an
 * address that was never named must not be able to accept.
 *
 * Kept out of the Playwright suite (tests/) because there is no browser here:
 * this calls the helpers directly, the same way the route does.
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
const { BUSINESS_INTAKE_SOURCE } = await import('@/lib/server/profile-owners');
const {
  listPendingInvitations,
  acceptPendingInvitation,
  declinePendingInvitation,
} = await import('@/lib/server/pending-listing-owner');

const suffix = Math.random().toString(36).slice(2, 8);

const ownerEmail = `pending-owner-${suffix}@test.invalid`;
const strangerEmail = `pending-stranger-${suffix}@test.invalid`;

let ownerUserId: string;
let strangerUserId: string;
let squatterUserId: string;

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];

async function makeUser(label: string, email: string): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({ email, name: label })
    .returning();
  createdUserIds.push(user.id);
  return user.id;
}

/**
 * A listing exactly as intake writes one: no user attached, inactive pending
 * review, identified by status.source, with a personal address parked on it.
 */
async function makeListing(
  label: string,
  pendingOwnerEmail: string | null
): Promise<string> {
  const [listing] = await db
    .insert(profiles)
    .values({
      email: `pending-${label}-${suffix}@test.invalid`,
      name: `Listing ${label}`,
      active: false,
      pendingOwnerEmail,
      status: { source: BUSINESS_INTAKE_SOURCE },
    })
    .returning();
  createdProfileIds.push(listing.id);
  return listing.id;
}

before(async () => {
  ownerUserId = await makeUser('Owner', ownerEmail);
  strangerUserId = await makeUser('Stranger', strangerEmail);
  squatterUserId = await makeUser(
    'Squatter',
    `pending-squatter-${suffix}@test.invalid`
  );
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

test('an address named at intake sees the listing offered to it', async () => {
  const profileId = await makeListing('offered', ownerEmail);

  const invitations = await listPendingInvitations(ownerEmail);
  const found = invitations.find((i) => i.profileId === profileId);

  assert.ok(found, 'expected the listing to be offered');
  assert.equal(found.name, 'Listing offered');
  // Masked: the business address is not this account's to read until the
  // listing is actually theirs.
  assert.ok(
    found.businessEmail.includes('•'),
    `expected a masked address, got ${found.businessEmail}`
  );
});

test('the lookup is case- and whitespace-insensitive', async () => {
  const profileId = await makeListing('normalised', ownerEmail);

  const invitations = await listPendingInvitations(
    `  ${ownerEmail.toUpperCase()}  `
  );

  assert.ok(invitations.some((i) => i.profileId === profileId));
});

test('nobody else is offered the listing', async () => {
  const profileId = await makeListing('private', ownerEmail);

  const invitations = await listPendingInvitations(strangerEmail);

  assert.equal(
    invitations.some((i) => i.profileId === profileId),
    false
  );
});

test('an empty address is offered nothing', async () => {
  // Guards the case where a provider hands back an account with no email —
  // a blank must never match the blanks in anyone else's column.
  assert.deepEqual(await listPendingInvitations(null), []);
  assert.deepEqual(await listPendingInvitations(''), []);
  assert.deepEqual(await listPendingInvitations('   '), []);
});

test('accepting grants ownership and leaves userId NULL', async () => {
  const profileId = await makeListing('accepted', ownerEmail);

  const outcome = await acceptPendingInvitation(
    ownerUserId,
    ownerEmail,
    profileId
  );
  assert.equal(outcome, 'accepted');

  const [owner] = await db
    .select()
    .from(profileOwners)
    .where(eq(profileOwners.profileId, profileId));
  assert.ok(owner, 'expected a profile_owners row');
  assert.equal(owner.userId, ownerUserId);
  assert.equal(owner.role, 'owner');

  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId));

  // The whole point. A business must never occupy the single identity slot.
  assert.equal(row.userId, null);
  // The invitation is spent.
  assert.equal(row.pendingOwnerEmail, null);
  // Accepting does not publish anything — admin review still gates that.
  assert.equal(row.active, false);
});

test('an accepted listing is no longer offered', async () => {
  const profileId = await makeListing('spent', ownerEmail);
  await acceptPendingInvitation(ownerUserId, ownerEmail, profileId);

  const invitations = await listPendingInvitations(ownerEmail);

  assert.equal(
    invitations.some((i) => i.profileId === profileId),
    false
  );
});

test('declining withdraws the offer without granting anything', async () => {
  const profileId = await makeListing('declined', ownerEmail);

  const outcome = await declinePendingInvitation(ownerEmail, profileId);
  assert.equal(outcome, 'declined');

  const owners = await db
    .select()
    .from(profileOwners)
    .where(eq(profileOwners.profileId, profileId));
  assert.equal(owners.length, 0, 'declining must not grant ownership');

  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId));

  assert.equal(row.pendingOwnerEmail, null);
  // The listing itself is untouched — "not mine" is not "delete this".
  assert.equal(row.name, 'Listing declined');
  assert.equal(row.active, false);
});

test('someone the listing never named cannot accept it', async () => {
  const profileId = await makeListing('guarded', ownerEmail);

  // The authorisation is the email match, re-read from the row — a guessed or
  // leaked profileId is not enough.
  const outcome = await acceptPendingInvitation(
    strangerUserId,
    strangerEmail,
    profileId
  );
  assert.equal(outcome, 'not-found');

  const owners = await db
    .select()
    .from(profileOwners)
    .where(eq(profileOwners.profileId, profileId));
  assert.equal(owners.length, 0);

  // And the real invitation survives the attempt.
  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId));
  assert.equal(row.pendingOwnerEmail, ownerEmail);
});

test('someone the listing never named cannot decline it either', async () => {
  const profileId = await makeListing('undeclinable', ownerEmail);

  const outcome = await declinePendingInvitation(strangerEmail, profileId);
  assert.equal(outcome, 'not-found');

  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId));
  assert.equal(row.pendingOwnerEmail, ownerEmail);
});

test('a listing that already has an owner cannot be claimed', async () => {
  const profileId = await makeListing('taken', ownerEmail);
  await db
    .insert(profileOwners)
    .values({ profileId, userId: squatterUserId, role: 'owner' });

  const outcome = await acceptPendingInvitation(
    ownerUserId,
    ownerEmail,
    profileId
  );
  assert.equal(outcome, 'already-claimed');

  const owners = await db
    .select()
    .from(profileOwners)
    .where(eq(profileOwners.profileId, profileId));
  assert.equal(owners.length, 1, 'must not add a second owner');
  assert.equal(owners[0].userId, squatterUserId);

  // Closed rather than left to be re-offered on every page load.
  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId));
  assert.equal(row.pendingOwnerEmail, null);
});

test('a claimed listing is never offered in the first place', async () => {
  const profileId = await makeListing('claimed', ownerEmail);
  await db
    .insert(profileOwners)
    .values({ profileId, userId: squatterUserId, role: 'owner' });

  const invitations = await listPendingInvitations(ownerEmail);

  assert.equal(
    invitations.some((i) => i.profileId === profileId),
    false
  );
});

test('a personal profile is not reachable through this column', async () => {
  // Nothing writes pending_owner_email on a personal profile today. The guard
  // is asserted anyway: if something ever does, it must not become a quieter
  // route into somebody's identity.
  const [personal] = await db
    .insert(profiles)
    .values({
      email: `pending-personal-${suffix}@test.invalid`,
      name: 'A Person',
      userId: squatterUserId,
      pendingOwnerEmail: ownerEmail,
    })
    .returning();
  createdProfileIds.push(personal.id);

  const invitations = await listPendingInvitations(ownerEmail);
  assert.equal(
    invitations.some((i) => i.profileId === personal.id),
    false
  );

  const outcome = await acceptPendingInvitation(
    ownerUserId,
    ownerEmail,
    personal.id
  );
  assert.equal(outcome, 'not-found');
});

test('accepting twice is harmless', async () => {
  const profileId = await makeListing('idempotent', ownerEmail);

  assert.equal(
    await acceptPendingInvitation(ownerUserId, ownerEmail, profileId),
    'accepted'
  );
  // The invitation is spent, so the second attempt finds nothing to accept
  // rather than duplicating the grant.
  assert.equal(
    await acceptPendingInvitation(ownerUserId, ownerEmail, profileId),
    'not-found'
  );

  const owners = await db
    .select()
    .from(profileOwners)
    .where(eq(profileOwners.profileId, profileId));
  assert.equal(owners.length, 1);
});

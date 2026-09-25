/**
 * Group lifecycle tests
 *
 * Exercises lib/federation/wrappers/group.ts against a real Postgres. These
 * are the invariants the rest of the groups feature is built on: member counts
 * stay truthful, a group can never be stranded without an admin, and a ban
 * survives the member trying to walk out and back in.
 *
 * Kept out of the Playwright suite (tests/) because there is no browser here --
 * this calls the wrappers directly, the same way the API routes do.
 *
 * Every fixture is created under a per-run random suffix and deleted in the
 * `after` hook, so this is safe to run against a shared or seeded database. It
 * never truncates anything (scripts/reset-test-db.ts does that, and it is
 * destructive -- do not couple this suite to it).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from 'dotenv';

// lib/db reads POSTGRES_URL when the module is first evaluated, and static
// imports hoist above this call. The dynamic imports below are what keep the
// env in place before the connection is built. In CI there is no .env.local
// and POSTGRES_URL is already exported, which dotenv leaves alone.
config({ path: '.env.local' });

const { db } = await import('@/lib/db');
const { eq, sql } = await import('drizzle-orm');
const { profiles, socialActors, socialGroups, socialGroupMembers } =
  await import('@/lib/schema');
const { createGroup, joinGroup, leaveGroup, getGroupByHandle, getMembership } =
  await import('@/lib/federation/wrappers/group');

const suffix = Math.random().toString(36).slice(2, 8);
const handle = `tg${suffix}`;

/** Actor ids to delete in teardown. Group actors cascade to groups/members. */
const createdActorIds: string[] = [];

/**
 * social_actors has NOT NULL columns with no default (uri, public_key,
 * private_key, and the four *_url columns in practice), so a fixture has to
 * supply them all or the insert fails.
 */
const mkActor = (username: string) => ({
  username,
  domain: 'test.invalid',
  type: 'Person',
  uri: `https://test.invalid/users/${username}`,
  inboxUrl: `https://test.invalid/users/${username}/inbox`,
  outboxUrl: `https://test.invalid/users/${username}/outbox`,
  followersUrl: `https://test.invalid/users/${username}/followers`,
  followingUrl: `https://test.invalid/users/${username}/following`,
  publicKey: 'test-public-key',
  privateKey: 'test-private-key',
});

let founderId: string;
let joinerId: string;
let profileId: string;
let groupId: string;

before(async () => {
  // createGroup requires the profile behind the founder: a group is a
  // moderation surface, and "which human started this" has to survive even if
  // the founder later leaves. profiles needs only email and name.
  const [profile] = await db
    .insert(profiles)
    .values({ email: `tp${suffix}@test.invalid`, name: 'Test Founder' })
    .returning();
  profileId = profile.id;

  const [founder] = await db
    .insert(socialActors)
    .values(mkActor(`tf${suffix}`))
    .returning();
  const [joiner] = await db
    .insert(socialActors)
    .values(mkActor(`tj${suffix}`))
    .returning();
  founderId = founder.id;
  joinerId = joiner.id;
  createdActorIds.push(founder.id, joiner.id);
});

after(async () => {
  // Actors first: deleting a group actor cascades to the group, which clears
  // the reference to the profile removed below.
  for (const id of createdActorIds) {
    await db.delete(socialActors).where(eq(socialActors.id, id));
  }
  if (profileId) {
    await db.delete(profiles).where(eq(profiles.id, profileId));
  }

  // postgres.js holds the process open otherwise, which hangs the runner.
  const client = (db as unknown as { $client?: { end?: () => Promise<void> } })
    .$client;
  await client?.end?.();
});

test('createGroup creates a Group-typed actor with the founder as admin', async () => {
  const created = await createGroup({
    handle,
    name: 'Test Group',
    summary: 'temporary',
    topics: ['printmaking', 'zines'],
    rules: ['Be kind', 'No spam'],
    createdByProfileId: profileId,
    founderActorId: founderId,
  });

  assert.ok(created.success, created.success ? '' : created.error);
  createdActorIds.push(created.actor.id);
  groupId = created.group.id;

  assert.equal(created.actor.type, 'Group');
  assert.equal(created.group.memberCount, 1);
  // Moderation history: the human who started it, not just the group actor.
  assert.equal(created.group.createdByProfileId, profileId);

  const membership = await getMembership(groupId, founderId);
  assert.equal(membership?.role, 'admin');
  assert.equal(membership?.status, 'active');
});

test('topics are stored as a flag map and rules keep their order', async () => {
  const group = await db.query.socialGroups.findFirst({
    where: eq(socialGroups.id, groupId),
  });

  // JSONB does not preserve key insertion order, so compare topics as a set.
  const topics = group?.topics as Record<string, boolean>;
  assert.deepEqual(Object.keys(topics).sort(), ['printmaking', 'zines']);
  assert.ok(Object.values(topics).every((v) => v === true));

  // Rules are numbered when displayed, so order is meaningful and the column
  // is an array rather than a flag map.
  assert.deepEqual(group?.rules, ['Be kind', 'No spam']);
});

test('a handle cannot be claimed twice', async () => {
  const dup = await createGroup({
    handle,
    name: 'Dupe',
    createdByProfileId: profileId,
    founderActorId: joinerId,
  });
  assert.equal(dup.success, false);
});

test('getGroupByHandle resolves the group', async () => {
  const found = await getGroupByHandle(handle);
  assert.equal(found?.group.id, groupId);
});

test('getGroupByHandle does not leak the private key or nest the group', async () => {
  const found = await getGroupByHandle(handle);
  assert.ok(found);
  assert.equal('privateKey' in found.actor, false);
  // The group is returned alongside; nesting it again doubles every field.
  assert.equal('group' in found.actor, false);
});

test('joining an open group raises the member count', async () => {
  const joined = await joinGroup(groupId, joinerId);
  assert.ok(joined.success, joined.success ? '' : joined.error);
  assert.equal(joined.pending, false);

  const group = await db.query.socialGroups.findFirst({
    where: eq(socialGroups.id, groupId),
  });
  assert.equal(group?.memberCount, 2);
});

test('joining twice is idempotent and does not inflate the count', async () => {
  const again = await joinGroup(groupId, joinerId);
  assert.ok(again.success, again.success ? '' : again.error);

  const group = await db.query.socialGroups.findFirst({
    where: eq(socialGroups.id, groupId),
  });
  assert.equal(group?.memberCount, 2);
});

test('the last admin cannot leave and strand the group', async () => {
  const left = await leaveGroup(groupId, founderId);
  assert.equal(left.success, false);
});

test('a member leaving drops the count', async () => {
  const left = await leaveGroup(groupId, joinerId);
  assert.ok(left.success, left.success ? '' : left.error);

  const group = await db.query.socialGroups.findFirst({
    where: eq(socialGroups.id, groupId),
  });
  assert.equal(group?.memberCount, 1);
});

test('a banned member can neither leave nor rejoin', async () => {
  await joinGroup(groupId, joinerId);
  await db
    .update(socialGroupMembers)
    .set({ status: 'banned' })
    .where(eq(socialGroupMembers.actorId, joinerId));

  // The row *is* the ban. Letting them leave would delete it and hand them an
  // instant rejoin, so both directions have to refuse.
  const left = await leaveGroup(groupId, joinerId);
  assert.equal(left.success, false);

  const rejoined = await joinGroup(groupId, joinerId);
  assert.equal(rejoined.success, false);
});

test('a request-policy group yields a pending membership', async () => {
  const created = await createGroup({
    handle: `tr${suffix}`,
    name: 'Request Group',
    joinPolicy: 'request',
    visibility: 'private',
    createdByProfileId: profileId,
    founderActorId: founderId,
  });
  assert.ok(created.success, created.success ? '' : created.error);
  createdActorIds.push(created.actor.id);

  const asked = await joinGroup(created.group.id, joinerId);
  assert.ok(asked.success, asked.success ? '' : asked.error);
  assert.equal(asked.pending, true);

  // Pending is not membership: it must not show up in the count, and joinedAt
  // stays null until an admin approves.
  const group = await db.query.socialGroups.findFirst({
    where: eq(socialGroups.id, created.group.id),
  });
  assert.equal(group?.memberCount, 1);

  const membership = await getMembership(created.group.id, joinerId);
  assert.equal(membership?.status, 'pending');
  assert.equal(membership?.joinedAt, null);
});

test('an invite-only group refuses a self-serve join', async () => {
  const created = await createGroup({
    handle: `ti${suffix}`,
    name: 'Invite Group',
    joinPolicy: 'invite',
    createdByProfileId: profileId,
    founderActorId: founderId,
  });
  assert.ok(created.success, created.success ? '' : created.error);
  createdActorIds.push(created.actor.id);

  const joined = await joinGroup(created.group.id, joinerId);
  assert.equal(joined.success, false);
});

test('deleting a group actor cascades to its group and members', async () => {
  const created = await createGroup({
    handle: `tc${suffix}`,
    name: 'Cascade Group',
    createdByProfileId: profileId,
    founderActorId: founderId,
  });
  assert.ok(created.success, created.success ? '' : created.error);

  await joinGroup(created.group.id, joinerId);
  await db.delete(socialActors).where(eq(socialActors.id, created.actor.id));

  const [{ groups, members }] = (await db.execute(
    sql`select
          (select count(*)::int from social_groups where id = ${created.group.id}) groups,
          (select count(*)::int from social_group_members where group_id = ${created.group.id}) members`
  )) as unknown as Array<{ groups: number; members: number }>;

  assert.equal(groups, 0);
  assert.equal(members, 0);
});

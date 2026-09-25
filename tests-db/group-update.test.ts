/**
 * Group edit tests
 *
 * What is worth testing here, specifically:
 *
 *  1. Partial semantics. `updateGroup` takes an object where absence means
 *     "leave it alone" and `topics: []` means "clear it". Those two are
 *     indistinguishable at a glance in JavaScript and trivially confused in a
 *     refactor, and getting it wrong silently wipes lists an admin never
 *     touched. Most of this file exists for that one distinction.
 *  2. The split write. Name and description live on `social_actors`;
 *     topics, rules, visibility and join policy live on `social_groups`. A
 *     single edit spans two tables and has to land as one unit.
 *  3. The topic flag round trip. Topics are stored as a `{ topic: true }`
 *     map, lowercased and de-duplicated, so what comes back out is not what
 *     went in and the form depends on that being predictable.
 *  4. That the handle is untouched. It is deliberately not editable, and the
 *     cheapest way for that to stop being true is for someone to add it to
 *     the input type without noticing what it is for.
 *
 * Fixtures are suffixed per run and removed in `after`, so this is safe
 * against a shared or seeded database and never truncates.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from 'dotenv';

// See the note in group-search.test.ts: lib/db reads POSTGRES_URL at first
// evaluation, and static imports would hoist above this.
config({ path: '.env.local' });

const { db } = await import('@/lib/db');
const { eq } = await import('drizzle-orm');
const { profiles, socialActors, socialGroups, screennameHistory } =
  await import('@/lib/schema');
const { createGroup, updateGroup, fromTopicFlags } =
  await import('@/lib/federation/wrappers/group');

const suffix = Math.random().toString(36).slice(2, 8);
const groupHandle = `ug${suffix}`;

let adminProfileId: string;
let adminActorId: string;
let groupId: string;
let groupActorId: string;

const createdProfileIds: string[] = [];
const createdActorIds: string[] = [];

/** The group row and its actor, as the page would read them. */
async function readGroup() {
  const group = await db.query.socialGroups.findFirst({
    where: eq(socialGroups.id, groupId),
  });
  const actor = await db.query.socialActors.findFirst({
    where: eq(socialActors.id, groupActorId),
  });
  assert.ok(group);
  assert.ok(actor);
  return { group, actor };
}

before(async () => {
  const [adminProfile] = await db
    .insert(profiles)
    .values({ email: `ua${suffix}@test.invalid`, name: 'Update Admin' })
    .returning();
  adminProfileId = adminProfile.id;
  createdProfileIds.push(adminProfile.id);

  const [adminActor] = await db
    .insert(socialActors)
    .values({
      username: `ua${suffix}`,
      domain: 'test.invalid',
      type: 'Person',
      uri: `https://test.invalid/users/ua${suffix}`,
      inboxUrl: `https://test.invalid/users/ua${suffix}/inbox`,
      outboxUrl: `https://test.invalid/users/ua${suffix}/outbox`,
      followersUrl: `https://test.invalid/users/ua${suffix}/followers`,
      followingUrl: `https://test.invalid/users/ua${suffix}/following`,
      publicKey: 'test-public-key',
      privateKey: 'test-private-key',
      profileId: adminProfileId,
    })
    .returning();
  adminActorId = adminActor.id;
  createdActorIds.push(adminActor.id);

  const created = await createGroup({
    handle: groupHandle,
    name: `Editable Group ${suffix}`,
    summary: 'The original description',
    topics: ['zines', 'printmaking'],
    rules: ['Be kind.', 'No selling.'],
    createdByProfileId: adminProfileId,
    founderActorId: adminActorId,
  });
  assert.equal(created.success, true, created.success ? '' : created.error);
  if (!created.success) throw new Error('fixture group failed');
  groupId = created.group.id;
  groupActorId = created.actor.id;
  createdActorIds.push(created.actor.id);
});

after(async () => {
  for (const id of createdActorIds) {
    await db.delete(socialActors).where(eq(socialActors.id, id));
  }
  for (const id of createdProfileIds) {
    await db.delete(profiles).where(eq(profiles.id, id));
  }
  await db
    .delete(screennameHistory)
    .where(eq(screennameHistory.screenname, groupHandle));

  /* Without this the open postgres connection keeps the event loop alive and
     the runner never exits, even with every test green. */
  const client = (db as unknown as { $client?: { end?: () => Promise<void> } })
    .$client;
  await client?.end?.();
});

// ---------------------------------------------------------------------------
// The split write
// ---------------------------------------------------------------------------

test('editing the name writes to the actor, not the group', async () => {
  const result = await updateGroup(groupId, { name: 'Renamed Group' });
  assert.equal(result.success, true, result.success ? '' : result.error);

  const { actor } = await readGroup();
  assert.equal(actor.name, 'Renamed Group');
  // The handle is the group's address and is not part of a rename.
  assert.equal(actor.username, groupHandle);
});

test('editing the description writes to the actor', async () => {
  const result = await updateGroup(groupId, { summary: 'A new description' });
  assert.equal(result.success, true, result.success ? '' : result.error);

  const { actor } = await readGroup();
  assert.equal(actor.summary, 'A new description');
});

test('a name edit leaves topics, rules and policy alone', async () => {
  const before = await readGroup();

  const result = await updateGroup(groupId, { name: 'Renamed Again' });
  assert.equal(result.success, true, result.success ? '' : result.error);

  const after = await readGroup();
  assert.deepEqual(after.group.topics, before.group.topics);
  assert.deepEqual(after.group.rules, before.group.rules);
  assert.equal(after.group.visibility, before.group.visibility);
  assert.equal(after.group.joinPolicy, before.group.joinPolicy);
  // And the description it did not mention.
  assert.equal(after.actor.summary, before.actor.summary);
});

// ---------------------------------------------------------------------------
// Partial semantics: absence vs emptiness
// ---------------------------------------------------------------------------

test('an empty topic list clears the topics', async () => {
  const result = await updateGroup(groupId, { topics: [] });
  assert.equal(result.success, true, result.success ? '' : result.error);

  const { group } = await readGroup();
  assert.deepEqual(fromTopicFlags(group.topics ?? {}), []);
});

test('an empty rule list clears the rules', async () => {
  const result = await updateGroup(groupId, { rules: [] });
  assert.equal(result.success, true, result.success ? '' : result.error);

  const { group } = await readGroup();
  assert.deepEqual(group.rules, []);
});

test('a null description clears it; undefined does not', async () => {
  await updateGroup(groupId, { summary: 'Something to clear' });

  const cleared = await updateGroup(groupId, { summary: null });
  assert.equal(cleared.success, true, cleared.success ? '' : cleared.error);
  assert.equal((await readGroup()).actor.summary, null);

  await updateGroup(groupId, { summary: 'Back again' });
  const untouched = await updateGroup(groupId, { name: 'Still Here' });
  assert.equal(
    untouched.success,
    true,
    untouched.success ? '' : untouched.error
  );
  assert.equal((await readGroup()).actor.summary, 'Back again');
});

test('an empty string description clears it, the same as null', async () => {
  await updateGroup(groupId, { summary: 'Present' });

  const result = await updateGroup(groupId, { summary: '   ' });
  assert.equal(result.success, true, result.success ? '' : result.error);
  assert.equal((await readGroup()).actor.summary, null);
});

// ---------------------------------------------------------------------------
// Topics and rules
// ---------------------------------------------------------------------------

test('topics round trip through the flag map, lowercased', async () => {
  const result = await updateGroup(groupId, {
    topics: ['Printmaking', 'ZINES', 'printmaking'],
  });
  assert.equal(result.success, true, result.success ? '' : result.error);

  const { group } = await readGroup();
  // De-duplicated by the lowercased key, and sorted on the way out.
  assert.deepEqual(fromTopicFlags(group.topics ?? {}), [
    'printmaking',
    'zines',
  ]);
});

test('blank rules are dropped and the rest trimmed', async () => {
  const result = await updateGroup(groupId, {
    rules: ['  Be kind.  ', '   ', '', 'No selling.'],
  });
  assert.equal(result.success, true, result.success ? '' : result.error);

  const { group } = await readGroup();
  assert.deepEqual(group.rules, ['Be kind.', 'No selling.']);
});

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

test('visibility and join policy can both be changed at once', async () => {
  const result = await updateGroup(groupId, {
    visibility: 'private',
    joinPolicy: 'invite',
  });
  assert.equal(result.success, true, result.success ? '' : result.error);

  const { group } = await readGroup();
  assert.equal(group.visibility, 'private');
  assert.equal(group.joinPolicy, 'invite');

  await updateGroup(groupId, { visibility: 'public', joinPolicy: 'open' });
});

test('an unknown visibility is refused', async () => {
  const result = await updateGroup(groupId, {
    visibility: 'secret' as never,
  });
  assert.equal(result.success, false);
});

test('an unknown join policy is refused', async () => {
  const result = await updateGroup(groupId, {
    joinPolicy: 'auction' as never,
  });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test('an empty name is refused', async () => {
  const result = await updateGroup(groupId, { name: '   ' });
  assert.equal(result.success, false);

  // And the stored name is untouched by the attempt.
  const { actor } = await readGroup();
  assert.notEqual(actor.name, '');
});

test('an over-long name is refused', async () => {
  const result = await updateGroup(groupId, { name: 'x'.repeat(81) });
  assert.equal(result.success, false);
});

test('an over-long description is refused', async () => {
  const result = await updateGroup(groupId, { summary: 'x'.repeat(501) });
  assert.equal(result.success, false);
});

test('more than twelve topics is refused', async () => {
  const result = await updateGroup(groupId, {
    topics: Array.from({ length: 13 }, (_unused, i) => `topic-${i}`),
  });
  assert.equal(result.success, false);
});

test('more than twenty rules is refused', async () => {
  const result = await updateGroup(groupId, {
    rules: Array.from({ length: 21 }, (_unused, i) => `Rule ${i}`),
  });
  assert.equal(result.success, false);
});

test('an over-long rule is refused', async () => {
  const result = await updateGroup(groupId, { rules: ['x'.repeat(281)] });
  assert.equal(result.success, false);
});

test('a refused edit writes nothing', async () => {
  const before = await readGroup();

  const result = await updateGroup(groupId, {
    name: 'A Perfectly Good Name',
    rules: ['x'.repeat(281)],
  });
  assert.equal(result.success, false);

  const after = await readGroup();
  assert.equal(after.actor.name, before.actor.name);
  assert.deepEqual(after.group.rules, before.group.rules);
});

test('editing a group that does not exist fails rather than throwing', async () => {
  const result = await updateGroup('00000000-0000-0000-0000-000000000000', {
    name: 'Nobody',
  });
  assert.equal(result.success, false);
});

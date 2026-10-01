/**
 * Block and mute tests
 *
 * Covers lib/federation/wrappers/block.ts and block-filter.ts against a real
 * Postgres. The reason these need database tests rather than unit tests is
 * that almost every promise block and mute make is about a *side effect on
 * another table*: blocking severs follow rows, severing follow rows has to
 * move the cached counters, and mute has to provably touch none of it.
 *
 * The single most important assertion in this file is the one that says a mute
 * changed nothing. A mute that is detectable by the muted person is not a mute
 * — it is a block delivered rudely — and the only way to be sure is to read
 * back the rows and counters they can see and show they are untouched.
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
const { inArray, and, eq } = await import('drizzle-orm');
const { socialActors, socialFollows, socialBlocks } =
  await import('@/lib/schema');
const { socialConfig } = await import('@/lib/federation');
const { createFollow, countMutualFollows, listSuggestedActors } =
  await import('@/lib/federation/wrappers/follow');
const { createBlock, removeBlock, listBlocks } =
  await import('@/lib/federation/wrappers/block');
const { getHiddenActorIds, isBlockedEitherWay } =
  await import('@/lib/federation/wrappers/block-filter');

const suffix = Math.random().toString(36).slice(2, 8);

/** Local-only, because both suggestion tiers filter on the configured domain. */
const domain = socialConfig.domain;

const actorIds: Record<string, string> = {};
const createdActorIds: string[] = [];

async function makeActor(key: string): Promise<string> {
  const username = `blocktest_${key}_${suffix}`;
  const base = `https://${domain}/users/${username}`;

  const [row] = await db
    .insert(socialActors)
    .values({
      username,
      domain,
      uri: base,
      inboxUrl: `${base}/inbox`,
      outboxUrl: `${base}/outbox`,
      followersUrl: `${base}/followers`,
      followingUrl: `${base}/following`,
      publicKey: `test-public-key-${username}`,
      name: `Block Test ${key}`,
    })
    .returning({ id: socialActors.id });

  createdActorIds.push(row.id);
  actorIds[key] = row.id;
  return row.id;
}

async function counts(key: string) {
  const row = await db.query.socialActors.findFirst({
    where: eq(socialActors.id, actorIds[key]),
    columns: { followersCount: true, followingCount: true },
  });
  return {
    followers: row?.followersCount ?? -1,
    following: row?.followingCount ?? -1,
  };
}

async function followRowExists(fromKey: string, toKey: string) {
  const row = await db.query.socialFollows.findFirst({
    where: and(
      eq(socialFollows.actorId, actorIds[fromKey]),
      eq(socialFollows.targetActorId, actorIds[toKey])
    ),
  });
  return row != null;
}

before(async () => {
  await Promise.all(
    [
      'blocker',
      'blocked',
      'muter',
      'muted',
      'bystander',
      'mutualA',
      'mutualB',
    ].map(makeActor)
  );

  // blocker <-> blocked are Panas before the block. Using createFollow rather
  // than raw inserts on purpose: it is what moves the cached counters, so the
  // counters start in a state that deleteFollow can correctly unwind.
  await createFollow(actorIds.blocker, actorIds.blocked);
  await createFollow(actorIds.blocked, actorIds.blocker);

  // muter <-> muted are Panas too, and must still be Panas at the end.
  await createFollow(actorIds.muter, actorIds.muted);
  await createFollow(actorIds.muted, actorIds.muter);

  // A pair nobody blocks, as a control that the filters are not just
  // returning everything.
  await createFollow(actorIds.mutualA, actorIds.mutualB);
  await createFollow(actorIds.mutualB, actorIds.mutualA);
});

after(async () => {
  // Guard the deletes, not the pool close: if `before` threw before creating
  // anything, an early return here would leave postgres.js holding the process
  // open and `yarn test:db` (which has no --test-force-exit) would hang until
  // the job timeout rather than reporting the failure.
  if (createdActorIds.length > 0) {
    await db
      .delete(socialBlocks)
      .where(inArray(socialBlocks.actorId, createdActorIds));
    await db
      .delete(socialBlocks)
      .where(inArray(socialBlocks.targetActorId, createdActorIds));
    await db
      .delete(socialFollows)
      .where(inArray(socialFollows.actorId, createdActorIds));
    await db
      .delete(socialFollows)
      .where(inArray(socialFollows.targetActorId, createdActorIds));
    await db
      .delete(socialActors)
      .where(inArray(socialActors.id, createdActorIds));
  }

  const client = (db as unknown as { $client?: { end?: () => Promise<void> } })
    .$client;
  await client?.end?.();
});

test('the fixture pairs are Panas before anything is blocked', async () => {
  // If this fails the rest of the file proves nothing, because every
  // "blocking removed it" assertion would pass against an empty start.
  assert.equal(await countMutualFollows(actorIds.blocker), 1);
  assert.equal(await countMutualFollows(actorIds.muter), 1);
});

test('blocking severs the follow in both directions', async () => {
  const before = await counts('blocker');
  assert.equal(before.followers, 1);
  assert.equal(before.following, 1);

  const result = await createBlock(actorIds.blocker, actorIds.blocked, 'block');
  assert.equal(result.success, true);

  assert.equal(
    await followRowExists('blocker', 'blocked'),
    false,
    'the blocker should no longer follow the blocked actor'
  );
  assert.equal(
    await followRowExists('blocked', 'blocker'),
    false,
    'the blocked actor should no longer follow the blocker — this is the direction that actually matters'
  );
});

test('severing through deleteFollow keeps the cached counters correct', async () => {
  // The counters are maintained by hand. A raw delete in createBlock would
  // leave them overstated forever with no way to attribute the drift, so this
  // asserts the specific bug that routing through deleteFollow prevents.
  const blocker = await counts('blocker');
  const blocked = await counts('blocked');

  assert.equal(blocker.followers, 0);
  assert.equal(blocker.following, 0);
  assert.equal(blocked.followers, 0);
  assert.equal(blocked.following, 0);
});

test('blocking ends the Pana relationship', async () => {
  assert.equal(await countMutualFollows(actorIds.blocker), 0);
  assert.equal(await countMutualFollows(actorIds.blocked), 0);
});

test('a blocked actor cannot re-follow, and neither can the blocker', async () => {
  const inbound = await createFollow(actorIds.blocked, actorIds.blocker);
  assert.equal(inbound.success, false);

  const outbound = await createFollow(actorIds.blocker, actorIds.blocked);
  assert.equal(outbound.success, false);

  // Identical copy in both directions on purpose. A different message for the
  // blocked party would let them infer which way the block runs, which is the
  // one fact a block is supposed to withhold.
  assert.equal(
    inbound.success === false ? inbound.error : null,
    outbound.success === false ? outbound.error : null,
    'the refusal must read the same from both sides'
  );
});

test('a block hides each actor from the other', async () => {
  const blockerSees = await getHiddenActorIds(actorIds.blocker);
  const blockedSees = await getHiddenActorIds(actorIds.blocked);

  assert.ok(
    blockerSees.includes(actorIds.blocked),
    'the blocker should not see the blocked actor'
  );
  assert.ok(
    blockedSees.includes(actorIds.blocker),
    'the blocked actor should not see the blocker either — a one-sided block just relocates the harassment'
  );

  assert.equal(
    await isBlockedEitherWay(actorIds.blocker, actorIds.blocked),
    true
  );
  assert.equal(
    await isBlockedEitherWay(actorIds.blocked, actorIds.blocker),
    true
  );
});

test('a blocked actor does not come back as a suggestion', async () => {
  // The regression this guards: alreadyAsked is derived from follow rows, and
  // blocking deletes those. Without an explicit exclusion the first thing a
  // blocker sees after blocking somebody is that person in "Panas you may
  // know", which reads as the block having failed.
  const suggestions = await listSuggestedActors(actorIds.blocker, 50);
  assert.ok(
    !suggestions.some((s) => s.id === actorIds.blocked),
    'the blocked actor must not be suggested back to the blocker'
  );
});

test('an unrelated pair is untouched by somebody else\u2019s block', async () => {
  // Control: proves the filters are selective rather than just empty.
  assert.equal(await countMutualFollows(actorIds.mutualA), 1);
  const hidden = await getHiddenActorIds(actorIds.mutualA);
  assert.deepEqual(hidden, []);
});

test('muting changes nothing the muted actor can see', async () => {
  // The central mute assertion. A mute that is detectable is a block with
  // worse manners, so this reads back everything on the muted actor's side.
  const beforeCounts = await counts('muted');

  const result = await createBlock(actorIds.muter, actorIds.muted, 'mute');
  assert.equal(result.success, true);

  assert.equal(
    await followRowExists('muter', 'muted'),
    true,
    'a mute must not sever the follow'
  );
  assert.equal(
    await followRowExists('muted', 'muter'),
    true,
    'nor the reverse follow'
  );

  const afterCounts = await counts('muted');
  assert.deepEqual(
    afterCounts,
    beforeCounts,
    'the muted actor\u2019s follower count must not move — a drop is how they would notice'
  );

  assert.equal(
    await countMutualFollows(actorIds.muted),
    1,
    'they are still Panas, because mute is not a statement about the relationship'
  );
});

test('a mute is one-directional', async () => {
  const muterSees = await getHiddenActorIds(actorIds.muter);
  const mutedSees = await getHiddenActorIds(actorIds.muted);

  assert.ok(
    muterSees.includes(actorIds.muted),
    'the muter should stop seeing the muted actor'
  );
  assert.ok(
    !mutedSees.includes(actorIds.muter),
    'but the muted actor keeps seeing the muter exactly as before'
  );
});

test('a mute does not gate actions the way a block does', async () => {
  // isBlockedEitherWay is what the follow gate and the story fetch consult. If
  // a mute registered here, muting would quietly start refusing follows and
  // become detectable.
  assert.equal(await isBlockedEitherWay(actorIds.muter, actorIds.muted), false);
  assert.equal(await isBlockedEitherWay(actorIds.muted, actorIds.muter), false);
});

test('the block list shows only outgoing rows', async () => {
  const blockerList = await listBlocks(actorIds.blocker, 'block');
  assert.equal(blockerList.length, 1);
  assert.equal(blockerList[0].actor.id, actorIds.blocked);

  // The blocked actor must not be able to discover the block by reading their
  // own list. A list of people who blocked you is a notification, and
  // notifying someone that they were blocked is how a block escalates.
  const blockedList = await listBlocks(actorIds.blocked, 'block');
  assert.deepEqual(blockedList, []);
});

test('the block list and the mute list are separate', async () => {
  const mutes = await listBlocks(actorIds.muter, 'mute');
  assert.equal(mutes.length, 1);
  assert.equal(mutes[0].actor.id, actorIds.muted);

  const blocks = await listBlocks(actorIds.muter, 'block');
  assert.deepEqual(blocks, [], 'a mute must not appear in the block list');
});

test('unblocking is scoped to the kind', async () => {
  // Block someone already muted, then unblock. The mute is an independent
  // decision and must survive — silently unmuting here would undo a choice the
  // user never revisited.
  await createBlock(actorIds.muter, actorIds.muted, 'block');
  assert.equal(await isBlockedEitherWay(actorIds.muter, actorIds.muted), true);

  await removeBlock(actorIds.muter, actorIds.muted, 'block');

  assert.equal(
    await isBlockedEitherWay(actorIds.muter, actorIds.muted),
    false,
    'the block is gone'
  );

  const mutes = await listBlocks(actorIds.muter, 'mute');
  assert.equal(mutes.length, 1, 'the mute survived the unblock');
});

test('unblocking does not restore the severed follows', async () => {
  await removeBlock(actorIds.blocker, actorIds.blocked, 'block');

  assert.equal(
    await isBlockedEitherWay(actorIds.blocker, actorIds.blocked),
    false
  );

  // Deliberate: we keep no record of what was severed, and reconstructing it
  // would re-create a relationship the blocker ended. If they want it back
  // they can follow again.
  assert.equal(await followRowExists('blocker', 'blocked'), false);
  assert.equal(await followRowExists('blocked', 'blocker'), false);
  assert.equal(await countMutualFollows(actorIds.blocker), 0);
});

test('blocking yourself is refused', async () => {
  const result = await createBlock(
    actorIds.bystander,
    actorIds.bystander,
    'block'
  );
  assert.equal(result.success, false);
});

test('blocking twice is idempotent rather than an error', async () => {
  // The UI can double-submit, and a second block is not a new decision.
  const first = await createBlock(
    actorIds.bystander,
    actorIds.blocked,
    'block'
  );
  const second = await createBlock(
    actorIds.bystander,
    actorIds.blocked,
    'block'
  );

  assert.equal(first.success, true);
  assert.equal(second.success, true);

  const list = await listBlocks(actorIds.bystander, 'block');
  assert.equal(list.length, 1, 'no duplicate row');
});

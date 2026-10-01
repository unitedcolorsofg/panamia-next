/**
 * DM gating and the Requests folder
 *
 * Covers lib/federation/wrappers/dm-gate.ts and the `notHeldRequest` filter in
 * timeline.ts against a real Postgres.
 *
 * These need database tests rather than unit tests because the property under
 * test is not "the gate returned 'hold'" — it is what the recipient can
 * actually *see* afterwards. The gate deciding to hold a message is worth
 * nothing if the message still turns up in the ordinary inbox, and that is a
 * question only a real query against real rows can answer. The assertion that
 * matters most in this file is the one that reads getAtMeTimeline back and
 * shows the held message is absent from it, then present the moment the
 * request is accepted.
 *
 * The refusal assertions are the other half: block, 'nobody', and
 * 'panas'-without-a-mutual must all produce the *same* error string, because
 * distinguishable refusals let a sender infer which one applied.
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
const { inArray, eq, and } = await import('drizzle-orm');
const {
  socialActors,
  socialFollows,
  socialBlocks,
  socialStatuses,
  socialDmRequests,
} = await import('@/lib/schema');
const { socialConfig } = await import('@/lib/federation');
const { createFollow } = await import('@/lib/federation/wrappers/follow');
const { createBlock } = await import('@/lib/federation/wrappers/block');
const { createStatus } = await import('@/lib/federation/wrappers/status');
const { getAtMeTimeline } = await import('@/lib/federation/wrappers/timeline');
const {
  evaluateDirectThreads,
  acceptDirectThreadRequest,
  deleteDirectThreadRequest,
  listDirectThreadRequests,
  DIRECT_THREAD_REFUSED,
} = await import('@/lib/federation/wrappers/dm-gate');

const suffix = Math.random().toString(36).slice(2, 8);
const domain = socialConfig.domain;

const actorIds: Record<string, string> = {};
const createdActorIds: string[] = [];

async function makeActor(key: string): Promise<string> {
  const username = `dmtest_${key}_${suffix}`;
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
      name: `DM Test ${key}`,
    })
    .returning({ id: socialActors.id });

  createdActorIds.push(row.id);
  actorIds[key] = row.id;
  return row.id;
}

async function setPolicy(key: string, policy: 'everyone' | 'panas' | 'nobody') {
  await db
    .update(socialActors)
    .set({ dmPolicy: policy })
    .where(eq(socialActors.id, actorIds[key]));
}

async function sendDm(fromKey: string, toKey: string, content: string) {
  return createStatus(
    actorIds[fromKey],
    content,
    undefined, // contentWarning
    undefined, // inReplyToId
    'direct',
    undefined, // attachments
    [actorIds[toKey]]
  );
}

async function inboxContents(key: string): Promise<string[]> {
  const { statuses } = await getAtMeTimeline(actorIds[key], undefined, 50);
  return statuses.map((r) => r.content ?? '');
}

before(async () => {
  await Promise.all(
    [
      'openSender',
      'openRecipient',
      'panaSender',
      'panasOnly',
      'stranger',
      'nobodyRecipient',
      'blockedSender',
      'blocker',
      'tightening',
      'deleteSender',
      'deleteRecipient',
    ].map(makeActor)
  );

  // panaSender <-> panasOnly are Panas, so the 'panas' policy must let them
  // through. Using createFollow rather than raw inserts because the mutual
  // test in the gate reads accepted follow rows in both directions.
  await createFollow(actorIds.panaSender, actorIds.panasOnly);
  await createFollow(actorIds.panasOnly, actorIds.panaSender);

  await setPolicy('panasOnly', 'panas');
  await setPolicy('nobodyRecipient', 'nobody');

  await createBlock(actorIds.blocker, actorIds.blockedSender, 'block');
});

after(async () => {
  // Guard the deletes, not the pool close: if `before` threw before creating
  // anything, an early return here would leave postgres.js holding the process
  // open and `yarn test:db` (which has no --test-force-exit) would hang until
  // the job timeout rather than reporting the failure.
  if (createdActorIds.length > 0) {
    await db
      .delete(socialDmRequests)
      .where(inArray(socialDmRequests.senderActorId, createdActorIds));
    await db
      .delete(socialDmRequests)
      .where(inArray(socialDmRequests.recipientActorId, createdActorIds));
    await db
      .delete(socialStatuses)
      .where(inArray(socialStatuses.actorId, createdActorIds));
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

test('everyone: a stranger can write, but the message is held', async () => {
  const result = await sendDm('openSender', 'openRecipient', `hello ${suffix}`);
  assert.equal(result.success, true);

  // The send succeeds and the sender is told nothing about the hold. Telling
  // them "filed as a request" would disclose the recipient's settings.
  assert.ok(result.success && result.heldRecipientActorIds);
  assert.deepEqual(result.success && result.heldRecipientActorIds, [
    actorIds.openRecipient,
  ]);

  const pending = await listDirectThreadRequests(actorIds.openRecipient);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].senderActorId, actorIds.openSender);
});

test('a held message is absent from the ordinary inbox', async () => {
  // This is the assertion the whole feature rests on. Suppressing the
  // notification is not enough: if the status still matches getAtMeTimeline
  // the recipient reads it anyway and the Requests folder prevents nothing.
  const contents = await inboxContents('openRecipient');
  assert.equal(
    contents.some((c) => c.includes(`hello ${suffix}`)),
    false,
    'held request leaked into the ordinary inbox'
  );
});

test('accepting the request reveals the message', async () => {
  const accepted = await acceptDirectThreadRequest(
    actorIds.openRecipient,
    actorIds.openSender
  );
  assert.equal(accepted, true);

  const contents = await inboxContents('openRecipient');
  assert.equal(
    contents.some((c) => c.includes(`hello ${suffix}`)),
    true,
    'accepted message did not become visible'
  );

  // Accepting flips the row rather than deleting it, so first contact is
  // still on record.
  const stillPending = await listDirectThreadRequests(actorIds.openRecipient);
  assert.equal(stillPending.length, 0);
});

test('an accepted thread is not re-held by later messages', async () => {
  const result = await sendDm(
    'openSender',
    'openRecipient',
    `second ${suffix}`
  );
  assert.equal(result.success, true);
  assert.deepEqual(result.success && result.heldRecipientActorIds, []);

  const contents = await inboxContents('openRecipient');
  assert.equal(
    contents.some((c) => c.includes(`second ${suffix}`)),
    true
  );
});

test('panas: a mutual follow is allowed straight through, unheld', async () => {
  const result = await sendDm('panaSender', 'panasOnly', `pana ${suffix}`);
  assert.equal(result.success, true);
  assert.deepEqual(result.success && result.heldRecipientActorIds, []);

  const contents = await inboxContents('panasOnly');
  assert.equal(
    contents.some((c) => c.includes(`pana ${suffix}`)),
    true
  );
});

test('panas: a non-mutual sender is refused', async () => {
  const result = await sendDm('stranger', 'panasOnly', `nope ${suffix}`);
  assert.equal(result.success, false);
  assert.equal(result.success === false && result.error, DIRECT_THREAD_REFUSED);
});

test('nobody: everyone is refused', async () => {
  const result = await sendDm('stranger', 'nobodyRecipient', `nope ${suffix}`);
  assert.equal(result.success, false);
  assert.equal(result.success === false && result.error, DIRECT_THREAD_REFUSED);
});

test('a block refuses with the identical string', async () => {
  const result = await sendDm('blockedSender', 'blocker', `nope ${suffix}`);
  assert.equal(result.success, false);
  // Identical to the 'nobody' and 'panas' refusals on purpose. A distinct
  // message would let a blocked sender identify the block by contrast, which
  // is the one thing a block must not disclose.
  assert.equal(result.success === false && result.error, DIRECT_THREAD_REFUSED);
});

test('tightening the policy does not cut off an accepted correspondent', async () => {
  // openSender was accepted while the policy was 'everyone'. Moving to
  // 'nobody' must not retroactively sever a conversation already underway;
  // the accepted request is checked before the policy for exactly this.
  await setPolicy('openRecipient', 'nobody');

  const result = await sendDm('openSender', 'openRecipient', `after ${suffix}`);
  assert.equal(result.success, true);

  await setPolicy('openRecipient', 'everyone');
});

test('deleting a request leaves the sender able to try again', async () => {
  const first = await sendDm('stranger', 'openRecipient', `knock1 ${suffix}`);
  assert.equal(first.success, true);

  const deleted = await deleteDirectThreadRequest(
    actorIds.openRecipient,
    actorIds.stranger
  );
  assert.equal(deleted, true);
  assert.equal(
    (await listDirectThreadRequests(actorIds.openRecipient)).length,
    0
  );

  // "Not now" is not "never": there is deliberately no 'declined' state, so
  // the row simply goes and a later message opens a fresh request.
  const second = await sendDm('stranger', 'openRecipient', `knock2 ${suffix}`);
  assert.equal(second.success, true);
  assert.equal(
    (await listDirectThreadRequests(actorIds.openRecipient)).length,
    1
  );
});

test('deleting a request does not release the held message into the inbox', async () => {
  const body = `knock-delete ${suffix}`;
  const sent = await sendDm('deleteSender', 'deleteRecipient', body);
  assert.equal(sent.success, true);
  assert.equal(
    (await inboxContents('deleteRecipient')).some((c) => c.includes(body)),
    false,
    'held message should not be in the inbox while the request is pending'
  );

  assert.equal(
    await deleteDirectThreadRequest(
      actorIds.deleteRecipient,
      actorIds.deleteSender
    ),
    true
  );

  // The button says "delete without replying". If removing the request row
  // merely stops `notHeldRequest` from matching, the message the recipient
  // just refused lands in their inbox instead — the exact opposite.
  assert.equal(
    (await inboxContents('deleteRecipient')).some((c) => c.includes(body)),
    false,
    'deleting a request must not move the held message into the inbox'
  );
});

test('a mixed group DM fails whole rather than delivering partially', async () => {
  const result = await createStatus(
    actorIds.stranger,
    `group ${suffix}`,
    undefined, // contentWarning
    undefined, // inReplyToId
    'direct',
    undefined, // attachments
    [actorIds.openSender, actorIds.nobodyRecipient]
  );

  assert.equal(result.success, false);
  assert.equal(result.success === false && result.error, DIRECT_THREAD_REFUSED);

  // Nothing was written for the recipient who would have accepted it. Partial
  // delivery is worse than refusal here: the sender would believe all of them
  // saw it.
  const contents = await inboxContents('openSender');
  assert.equal(
    contents.some((c) => c.includes(`group ${suffix}`)),
    false
  );
});

test('a refusal leaves no orphan row behind', async () => {
  // Regression test for a real bug found by this file. The recipient checks
  // and the gate used to run *after* createStatus had already inserted a row
  // with the placeholder uri = '', so a refused send left that row behind.
  // uri is UNIQUE, so the orphan then collided with the next post by any
  // account on the instance — one unwanted DM could stop everybody posting.
  const refused = await sendDm('stranger', 'nobodyRecipient', `orph ${suffix}`);
  assert.equal(refused.success, false);

  const orphans = await db
    .select({ id: socialStatuses.id })
    .from(socialStatuses)
    .where(
      and(
        eq(socialStatuses.uri, ''),
        inArray(socialStatuses.actorId, createdActorIds)
      )
    );
  assert.equal(orphans.length, 0, 'refused send left a placeholder row');

  // The part that actually broke: posting still works afterwards.
  const after = await createStatus(
    actorIds.stranger,
    `still posting ${suffix}`,
    undefined, // contentWarning
    undefined, // inReplyToId
    'public'
  );
  assert.equal(after.success, true);
});

test('evaluateDirectThreads treats a message to yourself as allowed', async () => {
  const decisions = await evaluateDirectThreads(actorIds.nobodyRecipient, [
    actorIds.nobodyRecipient,
  ]);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].decision, 'allow');
});

/**
 * Social graph tests
 *
 * Exercises the Pana relationship model in lib/federation/wrappers/follow.ts
 * against a real Postgres. A Pana is a *derived* mutual follow — there is no
 * `isPana` column — so every promise the UI makes rests on these joins being
 * right, and nothing covered them before.
 *
 * The invariants here are the ones the badges and gates depend on: mutuality
 * requires `accepted` in both directions, a pending reverse follow is not a
 * Pana, the relationship is symmetric, the signing key never leaves the
 * database, and a suggestion knows whether it already follows the viewer.
 *
 * Kept out of the Playwright suite (tests/) because there is no browser here:
 * this calls the wrappers directly, the same way the API routes do.
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
const { inArray } = await import('drizzle-orm');
const { socialActors, socialFollows } = await import('@/lib/schema');
const { socialConfig } = await import('@/lib/federation');
const { countMutualFollows, listMutualFollows, listSuggestedActors } =
  await import('@/lib/federation/wrappers/follow');

const suffix = Math.random().toString(36).slice(2, 8);

/** Local-only, because both suggestion tiers filter on the configured domain. */
const domain = socialConfig.domain;

const actorIds: Record<string, string> = {};
const createdActorIds: string[] = [];

async function makeActor(key: string): Promise<string> {
  const username = `graphtest_${key}_${suffix}`;
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
      // Present so the projection test is meaningful: a wrapper that forgot to
      // drop it would have something real to leak.
      privateKey: `test-private-key-${username}`,
      name: `Graph Test ${key}`,
    })
    .returning({ id: socialActors.id });

  createdActorIds.push(row.id);
  actorIds[key] = row.id;
  return row.id;
}

async function follow(
  fromKey: string,
  toKey: string,
  status: 'pending' | 'accepted'
) {
  await db.insert(socialFollows).values({
    actorId: actorIds[fromKey],
    targetActorId: actorIds[toKey],
    status,
    acceptedAt: status === 'accepted' ? new Date() : null,
  });
}

before(async () => {
  await Promise.all(
    ['viewer', 'pana', 'oneWayIn', 'pendingIn', 'stranger'].map(makeActor)
  );

  // viewer <-> pana: both accepted, so a Pana.
  await follow('viewer', 'pana', 'accepted');
  await follow('pana', 'viewer', 'accepted');

  // oneWayIn -> viewer only. Not a Pana, but one tap from being one, which is
  // exactly the state the "Follows you" badge exists to surface.
  await follow('oneWayIn', 'viewer', 'accepted');

  // pendingIn -> viewer, unaccepted. Must not count as either.
  await follow('pendingIn', 'viewer', 'pending');

  // stranger has no edge in either direction.
});

after(async () => {
  // Guard the deletes, not the pool close: if `before` threw before creating
  // anything, an early return here would leave postgres.js holding the process
  // open and `yarn test:db` (which has no --test-force-exit) would hang until
  // the job timeout rather than reporting the failure.
  if (createdActorIds.length > 0) {
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

test('a mutual accepted follow counts as a Pana', async () => {
  assert.equal(await countMutualFollows(actorIds.viewer), 1);
});

test('a one-way follow is not a Pana', async () => {
  // oneWayIn follows viewer but viewer does not follow back.
  assert.equal(await countMutualFollows(actorIds.oneWayIn), 0);
});

test('a pending reverse follow is not a Pana', async () => {
  assert.equal(await countMutualFollows(actorIds.pendingIn), 0);
});

test('mutuality is symmetric', async () => {
  assert.equal(await countMutualFollows(actorIds.pana), 1);
});

test('the Panas list names the right actor and never projects the signing key', async () => {
  const panas = await listMutualFollows(actorIds.viewer);

  assert.equal(panas.length, 1);
  assert.equal(panas[0].id, actorIds.pana);
  assert.equal(
    'privateKey' in panas[0],
    false,
    'listMutualFollows must drop privateKey from the projection'
  );
});

test('suggestions mark whoever already follows the viewer', async () => {
  // A generous limit because the fallback tier is ordered by recency against a
  // shared database -- the fixtures are newest, but the page size is not the
  // thing under test.
  const suggestions = await listSuggestedActors(actorIds.viewer, 50);
  const byId = new Map(suggestions.map((s) => [s.id, s]));

  const oneWay = byId.get(actorIds.oneWayIn);
  assert.ok(oneWay, 'an actor who follows the viewer should be suggestible');
  assert.equal(oneWay.followsYou, true);

  const stranger = byId.get(actorIds.stranger);
  assert.ok(stranger, 'an unconnected local actor should be suggestible');
  assert.equal(stranger.followsYou, false);
});

test('a pending inbound follow does not read as Follows you', async () => {
  const suggestions = await listSuggestedActors(actorIds.viewer, 50);
  const pending = suggestions.find((s) => s.id === actorIds.pendingIn);

  assert.ok(pending, 'a pending follower is still a suggestion');
  assert.equal(
    pending.followsYou,
    false,
    'followsYou must require an accepted edge, matching the Pana join'
  );
});

test('suggestions exclude people the viewer already follows', async () => {
  const suggestions = await listSuggestedActors(actorIds.viewer, 50);

  assert.equal(
    suggestions.some((s) => s.id === actorIds.pana),
    false
  );
});

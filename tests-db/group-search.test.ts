/**
 * Group search tests
 *
 * Exercises lib/server/group-search.ts and the generated tsvectors from
 * migration 0044 against a real Postgres. Full-text behaviour cannot be
 * unit-tested away from the database -- the stemming, accent folding and
 * ranking under test are all Postgres doing the work -- so these run here
 * rather than in the Playwright suite.
 *
 * Also covers listPublicGroupsForActor, because the privacy filters on it are
 * the reason a profile can show group cards without leaking membership of a
 * private group.
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
const { eq } = await import('drizzle-orm');
const { profiles, socialActors } = await import('@/lib/schema');
const { createGroup, joinGroup, listPublicGroupsForActor } =
  await import('@/lib/federation/wrappers/group');
const { searchGroups } = await import('@/lib/server/group-search');

const suffix = Math.random().toString(36).slice(2, 8);

/**
 * A token that appears in every fixture's name, so "find all of mine" is a
 * single query that cannot collide with seeded data. Letters only: a token
 * with digits in it tokenizes differently across text search configurations.
 */
const token = `qzt${suffix.replace(/[^a-z]/g, 'x')}`;

const createdActorIds: string[] = [];

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

let profileId: string;
let founderId: string;
let joinerId: string;

/** name-match fixture: the token is in the name. */
let zineHandle: string;
/** topic-match fixture: the token is only in topics. */
let topicHandle: string;
/** summary-match fixture: the token is only in the summary. */
let summaryHandle: string;
/** private fixture, for the discoverability and profile-leak tests. */
let privateHandle: string;

before(async () => {
  const [profile] = await db
    .insert(profiles)
    .values({ email: `sp${suffix}@test.invalid`, name: 'Search Founder' })
    .returning();
  profileId = profile.id;

  const [founder] = await db
    .insert(socialActors)
    .values(mkActor(`sf${suffix}`))
    .returning();
  const [joiner] = await db
    .insert(socialActors)
    .values(mkActor(`sj${suffix}`))
    .returning();
  founderId = founder.id;
  joinerId = joiner.id;
  createdActorIds.push(founder.id, joiner.id);

  zineHandle = `sga${suffix}`;
  topicHandle = `sgb${suffix}`;
  summaryHandle = `sgc${suffix}`;
  privateHandle = `sgd${suffix}`;

  // Accented name on purpose: proves pana_unaccent is in the generated
  // column, which is invisible until someone searches without the accent.
  const zine = await createGroup({
    handle: zineHandle,
    name: `Sazón ${token} Zines`,
    summary: 'Risograph printing and paper crafts',
    topics: ['printmaking', 'zines'],
    createdByProfileId: profileId,
    founderActorId: founderId,
  });
  assert.equal(zine.success, true);
  if (zine.success) createdActorIds.push(zine.actor.id);

  const topical = await createGroup({
    handle: topicHandle,
    name: 'Neutral Name Alpha',
    summary: 'Nothing notable here',
    topics: [token, 'cooking'],
    createdByProfileId: profileId,
    founderActorId: founderId,
  });
  assert.equal(topical.success, true);
  if (topical.success) createdActorIds.push(topical.actor.id);

  const summarised = await createGroup({
    handle: summaryHandle,
    name: 'Neutral Name Beta',
    summary: `A quiet corner for ${token} enthusiasts`,
    topics: ['reading'],
    createdByProfileId: profileId,
    founderActorId: founderId,
  });
  assert.equal(summarised.success, true);
  if (summarised.success) createdActorIds.push(summarised.actor.id);

  const priv = await createGroup({
    handle: privateHandle,
    name: `Hidden ${token} Circle`,
    summary: 'Members only',
    topics: ['secret'],
    visibility: 'private',
    joinPolicy: 'request',
    createdByProfileId: profileId,
    founderActorId: founderId,
  });
  assert.equal(priv.success, true);
  if (priv.success) createdActorIds.push(priv.actor.id);
});

after(async () => {
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

test('finds a group by a word in its name', async () => {
  const results = await searchGroups({ term: `${token} Zines` });
  assert.ok(
    results.some((g) => g.handle === zineHandle),
    'expected the name-matching group in results'
  );
});

test('finds a group by one of its topics', async () => {
  const results = await searchGroups({ term: 'printmaking' });
  assert.ok(
    results.some((g) => g.handle === zineHandle),
    'expected a topic match to find the group'
  );
});

test('finds a group by a word in its summary', async () => {
  const results = await searchGroups({ term: 'risograph' });
  assert.ok(
    results.some((g) => g.handle === zineHandle),
    'expected a summary match to find the group'
  );
});

test('a word in the name outranks the same word in topics or summary', async () => {
  // All four fixtures carry the token, each in a different field, so the
  // ordering here is the whole point of the weighted vectors: it is what
  // stops a group that merely mentions a term burying the group named after
  // it. Ranks come from two separate tsvectors summed, so this is also the
  // regression test for that sum staying comparable.
  const results = await searchGroups({ term: token });
  const order = results.map((g) => g.handle);

  const nameIdx = order.indexOf(zineHandle);
  const topicIdx = order.indexOf(topicHandle);
  const summaryIdx = order.indexOf(summaryHandle);

  assert.ok(nameIdx >= 0, 'name match missing');
  assert.ok(topicIdx >= 0, 'topic match missing');
  assert.ok(summaryIdx >= 0, 'summary match missing');

  assert.ok(nameIdx < topicIdx, 'name match should outrank topic match');
  assert.ok(topicIdx < summaryIdx, 'topic match should outrank summary match');
});

test('search folds accents, so Sazon finds Sazón', async () => {
  const results = await searchGroups({ term: `Sazon ${token}` });
  assert.ok(
    results.some((g) => g.handle === zineHandle),
    'expected the unaccented spelling to match'
  );
});

test('search stems, so a singular topic finds a plural one', async () => {
  // The stored topic is "zines"; searching "zine" has to reach it, which is
  // the english arm of the group vector doing its job.
  const results = await searchGroups({ term: 'zine' });
  assert.ok(
    results.some((g) => g.handle === zineHandle),
    'expected "zine" to match the "zines" topic'
  );
});

test('a misspelled name still finds the group via the trigram fallback', async () => {
  // Drop a letter from the token. Full-text cannot match this at all -- every
  // arm is exact-after-stemming -- so a hit here proves the fallback fired.
  const typo = token.slice(0, -1);
  const results = await searchGroups({ term: `${typo} Zines` });
  assert.ok(
    results.some((g) => g.handle === zineHandle),
    `expected the trigram fallback to recover from "${typo}"`
  );
});

test('private groups are discoverable, so they can be asked to join', async () => {
  const results = await searchGroups({ term: token });
  const found = results.find((g) => g.handle === privateHandle);

  assert.ok(found, 'a private group must still be findable');
  assert.equal(found.visibility, 'private');
  assert.equal(found.joinPolicy, 'request');
});

test('search returns identity fields only, never content', async () => {
  const results = await searchGroups({ term: token });
  const found = results.find((g) => g.handle === zineHandle);

  assert.ok(found);
  assert.equal(found.name, `Sazón ${token} Zines`);
  assert.deepEqual(
    new Set(Object.keys(found.topics)),
    new Set(['printmaking', 'zines'])
  );
  assert.equal(found.memberCount, 1);
  // rules are deliberately neither indexed nor returned here.
  assert.ok(!('rules' in found));
});

test('an empty term browses rather than erroring', async () => {
  const results = await searchGroups({ term: '  ' });
  assert.ok(results.length > 0, 'browse should return groups');
});

test('limit is clamped rather than trusted', async () => {
  const results = await searchGroups({ term: token, limit: 1 });
  assert.equal(results.length, 1);

  // Junk falls back to the default instead of throwing or returning nothing.
  const junk = await searchGroups({ term: token, limit: Number.NaN });
  assert.ok(junk.length > 1);
});

test('listPublicGroupsForActor hides private groups', async () => {
  const groups = await listPublicGroupsForActor(founderId);
  const handles = groups.map((g) => g.handle);

  assert.ok(handles.includes(zineHandle), 'public group should be listed');
  assert.ok(
    !handles.includes(privateHandle),
    'a private group must not appear on a public profile'
  );
});

test('listPublicGroupsForActor hides pending membership', async () => {
  // Joining a 'request' group yields pending, which is not a membership and
  // must not advertise that someone asked.
  const before = await listPublicGroupsForActor(joinerId);
  assert.equal(before.length, 0);

  const requested = await createGroup({
    handle: `sge${suffix}`,
    name: `Gated ${token} Room`,
    summary: 'ask first',
    topics: ['gated'],
    visibility: 'public',
    joinPolicy: 'request',
    createdByProfileId: profileId,
    founderActorId: founderId,
  });
  assert.equal(requested.success, true);
  if (!requested.success) return;
  createdActorIds.push(requested.actor.id);

  const join = await joinGroup(requested.group.id, joinerId);
  assert.equal(join.success, true);
  if (join.success) assert.equal(join.pending, true);

  const after = await listPublicGroupsForActor(joinerId);
  assert.equal(after.length, 0, 'pending membership must not be listed');
});

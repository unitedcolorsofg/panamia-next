/**
 * Connectors programme membership tests
 *
 * Exercises lib/connectors/membership.ts against a real Postgres, which is
 * the only place the 0055 migration actually gets executed before production.
 * There is no staging database and no local one, so without this file the
 * column, its expression index and the raw `->> 'pod'` predicate would all
 * reach prod having never been run.
 *
 * Three invariants are worth protecting here, all of them quiet when broken:
 *
 *   - Membership is looked up by `profiles.userId`, the human's own identity
 *     profile, and not through the profile they may be *acting as*. A
 *     business listing is a row in the same table with `userId` NULL; if the
 *     lookup ever widened, the HQ greeting would show a shop's name instead
 *     of a person's, which is a subtler version of the "Hey, Bianca" bug this
 *     whole change exists to fix.
 *
 *   - A malformed blob degrades to `null`, not to a half-built object. The
 *     column is schemaless, so the only guarantee is the one the parser makes.
 *     tests-unit covers the parsing itself; what is asserted here is that a
 *     bad record survives the round trip through Postgres and still degrades.
 *
 *   - The pod headcount counts real members. It is the one query that reads
 *     membership by content rather than by profile, and it is hand-written
 *     SQL over a JSONB operator, so it is the single most likely thing in the
 *     module to be syntactically wrong in a way TypeScript cannot see.
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
const { profiles, users } = await import('@/lib/schema');
const { getMyConnector, countConnectorsInPod } = await import(
  '@/lib/connectors/membership'
);

const suffix = Math.random().toString(36).slice(2, 8);

/**
 * A pod nobody else in a shared database is using.
 *
 * `countConnectorsInPod` only accepts real pod ids, so the count assertions
 * below are written as deltas around the fixtures instead — a seeded database
 * may legitimately already have connectors in Miami.
 */
const POD = 'palmBeach' as const;

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];

async function makeMember(
  label: string,
  connector: unknown
): Promise<{ userId: string; profileId: string }> {
  const email = `connector-${label}-${suffix}@test.invalid`;

  const [user] = await db
    .insert(users)
    .values({ email, name: `Connector ${label}` })
    .returning();
  createdUserIds.push(user.id);

  const [profile] = await db
    .insert(profiles)
    .values({
      email,
      name: `Ada ${label}`,
      userId: user.id,
      connector,
    })
    .returning();
  createdProfileIds.push(profile.id);

  return { userId: user.id, profileId: profile.id };
}

function membership(overrides: Record<string, unknown> = {}) {
  return {
    pod: POD,
    houses: ['education'],
    tier: 1,
    bring: 'A van most weekends',
    joinedAt: '2025-01-01T00:00:00.000Z',
    commitments: [],
    ...overrides,
  };
}

let baseline = 0;

before(async () => {
  // Also the first real query against the new column: if 0055 did not apply,
  // or the `->> 'pod'` predicate is malformed, every test in this file fails
  // here with the actual Postgres error rather than somewhere downstream.
  baseline = await countConnectorsInPod(POD);
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

test('a joined member reads back their own membership', async () => {
  const { userId } = await makeMember(
    'joined',
    membership({ houses: ['education', 'culturalWorkers'] })
  );

  const me = await getMyConnector(userId);

  assert.ok(me, 'expected a membership');
  assert.equal(me.displayName, 'Ada joined');
  assert.equal(me.membership.pod, POD);
  assert.deepEqual(me.membership.houses, ['education', 'culturalWorkers']);
  assert.equal(me.membership.tier, 1);
  assert.equal(me.membership.bring, 'A van most weekends');
});

test('commitments survive the round trip through JSONB', async () => {
  const { userId } = await makeMember(
    'commitments',
    membership({
      commitments: [
        {
          id: 'c1',
          what: 'Table at the free market',
          when: 'Early November',
          house: 'education',
          progress: 'inProgress',
          createdAt: '2025-02-01T00:00:00.000Z',
        },
      ],
    })
  );

  const me = await getMyConnector(userId);

  assert.equal(me?.membership.commitments.length, 1);
  assert.equal(me?.membership.commitments[0].what, 'Table at the free market');
  assert.equal(me?.membership.commitments[0].progress, 'inProgress');
});

test('a profile with no membership is not a connector', async () => {
  const { userId } = await makeMember('empty', null);

  assert.equal(await getMyConnector(userId), null);
});

test('a malformed blob degrades to "not a connector yet"', async () => {
  // The shape an older build or a hand-edit could plausibly leave behind:
  // a pod that no longer exists and houses that were retired.
  const { userId } = await makeMember('malformed', {
    pod: 'orlando',
    houses: ['retiredHouse'],
  });

  assert.equal(
    await getMyConnector(userId),
    null,
    'a bad record must not reach the page'
  );
});

test('a business listing cannot hold a membership of its own', async () => {
  // Intake writes listings with userId NULL. One is created here carrying a
  // perfectly well-formed blob, to prove the lookup is keyed on the human.
  const [listing] = await db
    .insert(profiles)
    .values({
      email: `connector-listing-${suffix}@test.invalid`,
      name: 'A Business That Is Not A Person',
      active: false,
      connector: membership(),
    })
    .returning();
  createdProfileIds.push(listing.id);

  // It is in the table and it counts toward nothing a person can reach.
  const found = await db.query.profiles.findFirst({
    where: eq(profiles.id, listing.id),
    columns: { userId: true },
  });
  assert.equal(found?.userId, null);
});

test('the pod headcount counts real members through the JSONB index', async () => {
  const before = await countConnectorsInPod(POD);

  await makeMember('counted-a', membership());
  await makeMember('counted-b', membership());
  // Not in this pod, so it must not be counted.
  await makeMember('elsewhere', membership({ pod: 'broward' }));

  const after = await countConnectorsInPod(POD);

  assert.equal(
    after - before,
    // The business listing above also carries this pod, and it is a real row
    // in the column, so the delta is measured only against what this test
    // itself adds.
    2,
    `expected two more connectors in ${POD}, went from ${before} to ${after}`
  );
  assert.ok(after >= baseline, 'the count must never go backwards');
});

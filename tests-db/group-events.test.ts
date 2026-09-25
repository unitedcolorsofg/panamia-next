/**
 * Group-hosted event tests
 *
 * Covers the three things Phase 5 actually rests on:
 *
 *  1. The events_single_host CHECK from migration 0047. Exactly one of
 *     host_profile_id / host_group_id, enforced by Postgres rather than by
 *     every insert remembering to.
 *  2. canManageEvent. Six call sites used to compare ids inline; with a NULL
 *     host profile those comparisons silently deny everyone, so the shared
 *     predicate is what makes a group's events manageable at all.
 *  3. That a group's events survive their organiser deleting their account.
 *     This is the entire reason the group is the host instead of merely being
 *     credited -- account deletion blocks on upcoming hosted events and
 *     deletes completed ones, and neither may reach across to a group.
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
const { eq, and, isNull } = await import('drizzle-orm');
const { profiles, socialActors, socialGroupMembers, events } =
  await import('@/lib/schema');
const { createGroup, joinGroup } =
  await import('@/lib/federation/wrappers/group');
const { canManageEvent, listHostableGroups } =
  await import('@/lib/server/event-host');
const { buildIcalUid } = await import('@/lib/event');

const suffix = Math.random().toString(36).slice(2, 8);

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

/** The founder: an admin of the group, and a profile in their own right. */
let adminProfileId: string;
let adminActorId: string;
/** A plain member: may post in the group, may not speak for it. */
let memberProfileId: string;
let memberActorId: string;
/** Someone with no connection to the group at all. */
let strangerProfileId: string;

let groupId: string;
const createdActorIds: string[] = [];
const createdEventIds: string[] = [];

/** Insert an event directly, bypassing the API, to test the constraint. */
async function insertEvent(values: {
  hostProfileId?: string | null;
  hostGroupId?: string | null;
  title?: string;
  startsAt?: Date;
}) {
  const [row] = await db
    .insert(events)
    .values({
      slug: `evt-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
      title: values.title ?? 'Test event',
      hostProfileId: values.hostProfileId ?? null,
      hostGroupId: values.hostGroupId ?? null,
      startsAt: values.startsAt ?? new Date(Date.now() + 86400000),
      icalUid: buildIcalUid(),
    })
    .returning();
  createdEventIds.push(row.id);
  return row;
}

/**
 * Assert an insert was refused by a named constraint.
 *
 * Drizzle wraps the driver error in a "Failed query: ..." Error and hangs the
 * PostgresError off `cause`, so a regex against the top-level message quietly
 * fails to match even when the constraint fired exactly as intended. Walking
 * the cause chain is what makes this test about the constraint rather than
 * about Drizzle's error formatting.
 */
async function assertRejectedBy(
  constraint: string,
  run: () => Promise<unknown>
) {
  try {
    await run();
  } catch (error) {
    let current: unknown = error;
    while (current) {
      const message = (current as { message?: string }).message ?? '';
      if (message.includes(constraint)) return;
      current = (current as { cause?: unknown }).cause;
    }
    throw new Error(
      `expected ${constraint} to reject the row, got: ${String(error)}`
    );
  }
  throw new Error(`expected ${constraint} to reject the row, but it succeeded`);
}

before(async () => {
  const [adminProfile] = await db
    .insert(profiles)
    .values({ email: `ga${suffix}@test.invalid`, name: 'Group Admin' })
    .returning();
  adminProfileId = adminProfile.id;

  const [memberProfile] = await db
    .insert(profiles)
    .values({ email: `gm${suffix}@test.invalid`, name: 'Group Member' })
    .returning();
  memberProfileId = memberProfile.id;

  const [strangerProfile] = await db
    .insert(profiles)
    .values({ email: `gs${suffix}@test.invalid`, name: 'Stranger' })
    .returning();
  strangerProfileId = strangerProfile.id;

  // The actors have to point back at the profiles: canManageEvent resolves a
  // profile to its actor to look the membership up, which is the hop that
  // would silently deny everyone if the link were missing.
  const [adminActor] = await db
    .insert(socialActors)
    .values({ ...mkActor(`ea${suffix}`), profileId: adminProfileId })
    .returning();
  adminActorId = adminActor.id;
  createdActorIds.push(adminActor.id);

  const [memberActor] = await db
    .insert(socialActors)
    .values({ ...mkActor(`em${suffix}`), profileId: memberProfileId })
    .returning();
  memberActorId = memberActor.id;
  createdActorIds.push(memberActor.id);

  const created = await createGroup({
    handle: `eg${suffix}`,
    name: `Event Group ${suffix}`,
    summary: 'Hosts things',
    topics: ['events'],
    createdByProfileId: adminProfileId,
    founderActorId: adminActorId,
  });
  assert.equal(created.success, true);
  if (!created.success) throw new Error('fixture group failed');
  groupId = created.group.id;
  createdActorIds.push(created.actor.id);

  const joined = await joinGroup(groupId, memberActorId);
  assert.equal(joined.success, true);
});

after(async () => {
  for (const id of createdEventIds) {
    await db.delete(events).where(eq(events.id, id));
  }
  for (const id of createdActorIds) {
    await db.delete(socialActors).where(eq(socialActors.id, id));
  }
  for (const id of [adminProfileId, memberProfileId, strangerProfileId]) {
    if (id) await db.delete(profiles).where(eq(profiles.id, id));
  }

  const client = (db as unknown as { $client?: { end?: () => Promise<void> } })
    .$client;
  await client?.end?.();
});

test('an event may be hosted by a group with no host profile', async () => {
  const row = await insertEvent({ hostGroupId: groupId });
  assert.equal(row.hostProfileId, null);
  assert.equal(row.hostGroupId, groupId);
});

test('an event may not have two hosts', async () => {
  await assertRejectedBy('events_single_host', () =>
    insertEvent({ hostProfileId: adminProfileId, hostGroupId: groupId })
  );
});

test('an event may not have zero hosts', async () => {
  await assertRejectedBy('events_single_host', () => insertEvent({}));
});

test('a group admin can manage the group events', async () => {
  const row = await insertEvent({ hostGroupId: groupId });
  assert.equal(await canManageEvent(row, adminProfileId), true);
});

test('a plain member cannot manage the group events', async () => {
  const row = await insertEvent({ hostGroupId: groupId });
  assert.equal(
    await canManageEvent(row, memberProfileId),
    false,
    'posting in a group is not the same as speaking for it'
  );
});

test('a stranger cannot manage the group events', async () => {
  const row = await insertEvent({ hostGroupId: groupId });
  assert.equal(await canManageEvent(row, strangerProfileId), false);
});

test('a profile host still manages their own event', async () => {
  const row = await insertEvent({ hostProfileId: adminProfileId });
  assert.equal(await canManageEvent(row, adminProfileId), true);
  assert.equal(await canManageEvent(row, memberProfileId), false);
});

test('a signed-out viewer manages nothing', async () => {
  const row = await insertEvent({ hostGroupId: groupId });
  assert.equal(await canManageEvent(row, null), false);
  assert.equal(await canManageEvent(row, undefined), false);
});

test('listHostableGroups offers admins their group and members nothing', async () => {
  const forAdmin = await listHostableGroups(adminProfileId);
  assert.ok(
    forAdmin.some((g) => g.id === groupId),
    'the founder administers the group and should be able to host as it'
  );

  const forMember = await listHostableGroups(memberProfileId);
  assert.equal(
    forMember.some((g) => g.id === groupId),
    false,
    'a plain member must not be offered the group as a host'
  );

  const forStranger = await listHostableGroups(strangerProfileId);
  assert.equal(forStranger.length, 0);
});

test('a group event is not among the founder account-deletion would touch', async () => {
  // This is the behaviour the exclusive-host design exists for. Account
  // deletion finds hosted events with eq(events.hostProfileId, profile.id):
  // it blocks on upcoming ones and deletes completed ones. A group event has
  // a NULL host profile, so it matches neither, and the club keeps its
  // calendar when the organiser walks away.
  const groupEvent = await insertEvent({ hostGroupId: groupId });
  const ownEvent = await insertEvent({ hostProfileId: adminProfileId });

  const wouldTouch = await db.query.events.findMany({
    where: eq(events.hostProfileId, adminProfileId),
    columns: { id: true },
  });
  const touchedIds = wouldTouch.map((row) => row.id);

  assert.ok(
    touchedIds.includes(ownEvent.id),
    'their own event is still theirs to cancel or lose'
  );
  assert.equal(
    touchedIds.includes(groupEvent.id),
    false,
    'the group event must survive its organiser leaving'
  );
});

test('the group keeps its events after the founder membership is gone', async () => {
  const groupEvent = await insertEvent({ hostGroupId: groupId });

  await db
    .delete(socialGroupMembers)
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.actorId, adminActorId)
      )
    );

  const stillThere = await db.query.events.findFirst({
    where: and(eq(events.id, groupEvent.id), isNull(events.hostProfileId)),
  });
  assert.ok(stillThere, 'the event outlives the membership that created it');
  assert.equal(stillThere?.hostGroupId, groupId);
});

/**
 * Group deletion and event transfer tests
 *
 * These two features are one change because they answer the same question:
 * what happens to an event when the thing hosting it goes away.
 *
 * What is worth testing here, specifically:
 *
 *  1. The transfer asymmetry. A moderator can manage a group's event and
 *     cannot transfer it. That gap is the whole authorization design -- a
 *     moderator who could transfer could walk the group's events into a group
 *     of their own -- and it is invisible unless something asserts it.
 *  2. That deleting a group actually succeeds while it hosts events.
 *     `events.host_group_id` is ON DELETE RESTRICT, so the naive delete fails
 *     outright. The executor deletes the events first; if that order is ever
 *     rearranged this is what catches it.
 *  3. That the handle stays retired afterwards. The reservation is written
 *     with the group's actor id into a table whose user_id has no FK, so it
 *     is only load-bearing if the availability check counts rows that join to
 *     no user at all.
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
const { eq, sql } = await import('drizzle-orm');
const {
  profiles,
  socialActors,
  socialGroups,
  socialGroupMembers,
  socialStatuses,
  screennameHistory,
  events,
} = await import('@/lib/schema');
const { createGroup, joinGroup } =
  await import('@/lib/federation/wrappers/group');
const { createStatus } = await import('@/lib/federation/wrappers/status');
const { canManageEvent, canTransferEvent } =
  await import('@/lib/server/event-host');
const { getGroupDeletionSummary, deleteGroup } =
  await import('@/lib/server/delete-group');
const { isScreennameAvailable } = await import('@/lib/screenname');
const { buildIcalUid } = await import('@/lib/event');

const suffix = Math.random().toString(36).slice(2, 8);
const groupHandle = `dg${suffix}`;

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

let adminProfileId: string;
let adminActorId: string;
/** Promoted to moderator: may run the group's events, may not give them away. */
let modProfileId: string;
let modActorId: string;
let strangerProfileId: string;

let groupId: string;
let groupActorId: string;
let upcomingEventId: string;
let pastEventId: string;
let personalEventId: string;

const createdProfileIds: string[] = [];
const createdActorIds: string[] = [];
const createdEventIds: string[] = [];

async function insertEvent(values: {
  hostProfileId?: string | null;
  hostGroupId?: string | null;
  startsAt: Date;
}) {
  const [row] = await db
    .insert(events)
    .values({
      slug: `del-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Test event',
      hostProfileId: values.hostProfileId ?? null,
      hostGroupId: values.hostGroupId ?? null,
      startsAt: values.startsAt,
      icalUid: buildIcalUid(),
    })
    .returning();
  createdEventIds.push(row.id);
  return row;
}

before(async () => {
  const [adminProfile] = await db
    .insert(profiles)
    .values({ email: `da${suffix}@test.invalid`, name: 'Delete Admin' })
    .returning();
  adminProfileId = adminProfile.id;
  createdProfileIds.push(adminProfile.id);

  const [modProfile] = await db
    .insert(profiles)
    .values({ email: `dm${suffix}@test.invalid`, name: 'Delete Mod' })
    .returning();
  modProfileId = modProfile.id;
  createdProfileIds.push(modProfile.id);

  const [strangerProfile] = await db
    .insert(profiles)
    .values({ email: `ds${suffix}@test.invalid`, name: 'Delete Stranger' })
    .returning();
  strangerProfileId = strangerProfile.id;
  createdProfileIds.push(strangerProfile.id);

  const [adminActor] = await db
    .insert(socialActors)
    .values({ ...mkActor(`da${suffix}`), profileId: adminProfileId })
    .returning();
  adminActorId = adminActor.id;
  createdActorIds.push(adminActor.id);

  const [modActor] = await db
    .insert(socialActors)
    .values({ ...mkActor(`dm${suffix}`), profileId: modProfileId })
    .returning();
  modActorId = modActor.id;
  createdActorIds.push(modActor.id);

  const created = await createGroup({
    handle: groupHandle,
    name: `Doomed Group ${suffix}`,
    summary: 'Will not survive this file',
    topics: ['events'],
    createdByProfileId: adminProfileId,
    founderActorId: adminActorId,
  });
  assert.equal(created.success, true);
  if (!created.success) throw new Error('fixture group failed');
  groupId = created.group.id;
  groupActorId = created.actor.id;
  createdActorIds.push(created.actor.id);

  const joined = await joinGroup(groupId, modActorId);
  assert.equal(joined.success, true);

  // No promote endpoint exists yet, so the role is set directly. The rule
  // under test is about the role, not about how someone acquires it.
  await db
    .update(socialGroupMembers)
    .set({ role: 'moderator' })
    .where(eq(socialGroupMembers.actorId, modActorId));

  upcomingEventId = (
    await insertEvent({
      hostGroupId: groupId,
      startsAt: new Date(Date.now() + 7 * 86400000),
    })
  ).id;
  pastEventId = (
    await insertEvent({
      hostGroupId: groupId,
      startsAt: new Date(Date.now() - 7 * 86400000),
    })
  ).id;
  personalEventId = (
    await insertEvent({
      hostProfileId: adminProfileId,
      startsAt: new Date(Date.now() + 7 * 86400000),
    })
  ).id;

  // Two posts by the moderator, one by the founder: the summary should report
  // three posts by two people, not three by three.
  for (const text of ['first', 'second']) {
    const post = await createStatus(
      modActorId,
      `${text} ${suffix}`,
      undefined,
      undefined,
      'public',
      undefined,
      undefined,
      undefined,
      'cc-by-4',
      { groupId }
    );
    assert.equal(post.success, true);
  }
  const founderPost = await createStatus(
    adminActorId,
    `founder ${suffix}`,
    undefined,
    undefined,
    'public',
    undefined,
    undefined,
    undefined,
    'cc-by-4',
    { groupId }
  );
  assert.equal(founderPost.success, true);
});

after(async () => {
  for (const id of createdEventIds) {
    await db.delete(events).where(eq(events.id, id));
  }
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
// Transfer authorization
// ---------------------------------------------------------------------------

test('a group admin can transfer the group\u2019s event', async () => {
  const event = await db.query.events.findFirst({
    where: eq(events.id, upcomingEventId),
  });
  assert.ok(event);
  assert.equal(await canTransferEvent(event, adminProfileId), true);
});

test('a moderator can manage the event but cannot transfer it', async () => {
  const event = await db.query.events.findFirst({
    where: eq(events.id, upcomingEventId),
  });
  assert.ok(event);
  // Both halves matter. Managing without transferring is the point; if the
  // first assertion ever fails the second one passes for the wrong reason.
  assert.equal(await canManageEvent(event, modProfileId), true);
  assert.equal(await canTransferEvent(event, modProfileId), false);
});

test('a personal host can transfer their own event', async () => {
  const event = await db.query.events.findFirst({
    where: eq(events.id, personalEventId),
  });
  assert.ok(event);
  assert.equal(await canTransferEvent(event, adminProfileId), true);
  assert.equal(await canTransferEvent(event, strangerProfileId), false);
});

test('a stranger cannot transfer a group event', async () => {
  const event = await db.query.events.findFirst({
    where: eq(events.id, upcomingEventId),
  });
  assert.ok(event);
  assert.equal(await canTransferEvent(event, strangerProfileId), false);
});

// ---------------------------------------------------------------------------
// The deletion preview
// ---------------------------------------------------------------------------

test('the deletion summary counts posts, authors, members and events', async () => {
  const summary = await getGroupDeletionSummary(groupId);
  assert.ok(summary);
  assert.equal(summary.handle, groupHandle);
  assert.equal(summary.memberPosts, 3);
  // Three posts, two writers. The distinct count is what makes the warning
  // honest about how many people are affected rather than how much was said.
  assert.equal(summary.memberPostAuthors, 2);
  assert.equal(summary.activeMembers, 2);
  assert.equal(summary.upcomingEvents, 1);
  assert.equal(summary.pastEvents, 1);
});

// ---------------------------------------------------------------------------
// Deletion. Everything below destroys the fixture group, so it runs last.
// ---------------------------------------------------------------------------

test('deleting a group removes its events, members, posts and actor', async () => {
  const result = await deleteGroup(groupId);
  assert.equal(result.success, true, result.error ?? 'deleteGroup failed');
  // The RESTRICT on events.host_group_id makes this the load-bearing count:
  // if the executor stopped deleting events first, the whole call would fail.
  assert.equal(result.deleted.events, 2);

  const group = await db.query.socialGroups.findFirst({
    where: eq(socialGroups.id, groupId),
  });
  assert.equal(group, undefined);

  const actor = await db.query.socialActors.findFirst({
    where: eq(socialActors.id, groupActorId),
  });
  assert.equal(actor, undefined);

  const [members] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(socialGroupMembers)
    .where(eq(socialGroupMembers.groupId, groupId));
  assert.equal(members.total, 0);

  const [posts] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(socialStatuses)
    .where(eq(socialStatuses.groupId, groupId));
  assert.equal(posts.total, 0);

  for (const id of [upcomingEventId, pastEventId]) {
    const event = await db.query.events.findFirst({
      where: eq(events.id, id),
    });
    assert.equal(event, undefined);
  }
});

test('a personal event outlives the group that never hosted it', async () => {
  const event = await db.query.events.findFirst({
    where: eq(events.id, personalEventId),
  });
  assert.ok(event, 'deleting a group must not reach events it did not host');
});

test('the deleted handle cannot be claimed by anyone', async () => {
  assert.equal(await isScreennameAvailable(groupHandle), false);
  // The signed-in path is the one that matters and the one that used to leak:
  // it inner-joined the history row to users, and a group reservation joins
  // to no user at all.
  assert.equal(
    await isScreennameAvailable(groupHandle, `ds${suffix}@test.invalid`),
    false
  );
});

test('the deletion summary is null once the group is gone', async () => {
  assert.equal(await getGroupDeletionSummary(groupId), null);
});

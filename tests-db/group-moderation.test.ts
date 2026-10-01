/**
 * Group moderation tests
 *
 * This file exists mostly to prove two numbers and one hierarchy.
 *
 * The numbers are `member_count` and the row itself. Six actions move them in
 * five different combinations -- approve adds a member, reject removes a row
 * without ever having counted it, remove and ban both subtract but only when
 * the row was active, and unban touches the count not at all. A count that
 * drifts from the rows is not a loud failure; it is a group that quietly
 * claims 41 members forever. Two groups in the dev database already have
 * exactly that, which is why every test here re-reads the stored count instead
 * of trusting the return value.
 *
 * The hierarchy is who may act on whom. A moderator may only act on plain
 * members: letting moderators act on each other turns a disagreement between
 * peers into whoever clicks first, and letting them act on admins inverts the
 * thing entirely. Admins may act on each other, because otherwise a group with
 * a bad admin has no remedy -- guarded by the rule that the last admin cannot
 * be demoted, removed or banned, so the room is never left without anyone who
 * can open the door.
 *
 * Fixtures are suffixed per run and removed in `after`, so this is safe
 * against a shared or seeded database and never truncates.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { config } from 'dotenv';

// See the note in group-search.test.ts: lib/db reads POSTGRES_URL at first
// evaluation, and static imports would hoist above this.
config({ path: '.env.local' });

const { db } = await import('@/lib/db');
const { eq, and, ne } = await import('drizzle-orm');
const {
  profiles,
  socialActors,
  socialGroups,
  socialGroupMembers,
  screennameHistory,
} = await import('@/lib/schema');
const { createGroup } = await import('@/lib/federation/wrappers/group');
const { listPendingRequests, listBannedMembers } =
  await import('@/lib/federation/wrappers/group-members');
const {
  approveRequest,
  rejectRequest,
  setMemberRole,
  removeMember,
  banMember,
  unbanMember,
} = await import('@/lib/federation/wrappers/group-moderation');

const suffix = Math.random().toString(36).slice(2, 8);
const groupHandle = `mm${suffix}`;

let groupId: string;
let adminId: string;
let modId: string;
let memberId: string;

const createdProfileIds: string[] = [];
const createdActorIds: string[] = [];

/** An actor with a profile behind it, as a real pana would have. */
async function makeActor(label: string) {
  const [profile] = await db
    .insert(profiles)
    .values({ email: `${label}${suffix}@test.invalid`, name: label })
    .returning();
  createdProfileIds.push(profile.id);

  const username = `${label}${suffix}`;
  const [actor] = await db
    .insert(socialActors)
    .values({
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
      profileId: profile.id,
      name: label,
    })
    .returning();
  createdActorIds.push(actor.id);
  return actor.id;
}

/**
 * Membership written directly rather than through joinGroup, so the test can
 * set a role and a status outright. joinGroup refuses most of these
 * combinations, which is what makes it the wrong tool here.
 */
async function addMember(
  actorId: string,
  role: 'admin' | 'moderator' | 'member',
  status: 'active' | 'pending' | 'banned'
) {
  const [row] = await db
    .insert(socialGroupMembers)
    .values({
      groupId,
      actorId,
      role,
      status,
      joinedAt: status === 'active' ? new Date() : null,
    })
    .returning();
  return row.id;
}

/** The stored count, not the one a function told us it wrote. */
async function storedCount(): Promise<number> {
  const [row] = await db
    .select({ n: socialGroups.memberCount })
    .from(socialGroups)
    .where(eq(socialGroups.id, groupId));
  return row.n;
}

async function setCount(n: number) {
  await db
    .update(socialGroups)
    .set({ memberCount: n })
    .where(eq(socialGroups.id, groupId));
}

async function rowById(id: string) {
  const [row] = await db
    .select()
    .from(socialGroupMembers)
    .where(eq(socialGroupMembers.id, id));
  return row ?? null;
}

before(async () => {
  adminId = await makeActor('ma');

  const created = await createGroup({
    handle: groupHandle,
    name: `Mod Group ${suffix}`,
    summary: 'A group with moderators',
    createdByProfileId: createdProfileIds[0],
    founderActorId: adminId,
  });
  assert.equal(created.success, true, created.success ? '' : created.error);
  if (!created.success) throw new Error('fixture group failed');
  groupId = created.group.id;
  createdActorIds.push(created.actor.id);

  modId = await makeActor('mo');
  memberId = await makeActor('mb');
});

/**
 * Every test starts from the same three people: one admin (the founder), one
 * moderator, one member. Tests delete and re-add rows, so rebuilding is
 * cheaper to reason about than ordering the tests so their damage composes.
 */
beforeEach(async () => {
  await db
    .delete(socialGroupMembers)
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        ne(socialGroupMembers.actorId, adminId)
      )
    );
  await db
    .update(socialGroupMembers)
    .set({ role: 'admin', status: 'active' })
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.actorId, adminId)
      )
    );
  await addMember(modId, 'moderator', 'active');
  await addMember(memberId, 'member', 'active');
  await setCount(3);
});

after(async () => {
  await db
    .delete(socialGroupMembers)
    .where(eq(socialGroupMembers.groupId, groupId));
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
// Approve and reject -- the join queue
// ---------------------------------------------------------------------------

test('approving a request activates the row and adds one to the count', async () => {
  const asker = await makeActor('mq1');
  const rowId = await addMember(asker, 'member', 'pending');

  const result = await approveRequest(groupId, adminId, rowId);
  assert.equal(result.success, true, result.success ? '' : result.error);

  const row = await rowById(rowId);
  assert.equal(row?.status, 'active');
  assert.equal(await storedCount(), 4);
});

test('approving stamps joinedAt with now, not when they asked', async () => {
  const asker = await makeActor('mq2');
  const rowId = await addMember(asker, 'member', 'pending');
  assert.equal((await rowById(rowId))?.joinedAt, null);

  const before = Date.now();
  await approveRequest(groupId, adminId, rowId);

  const joinedAt = (await rowById(rowId))?.joinedAt;
  assert.ok(joinedAt, 'joinedAt should be set on approval');
  assert.ok(
    joinedAt.getTime() >= before - 1000,
    'joinedAt should be the moment of approval'
  );
});

test('rejecting deletes the row and leaves the count alone', async () => {
  const asker = await makeActor('mq3');
  const rowId = await addMember(asker, 'member', 'pending');

  const result = await rejectRequest(groupId, adminId, rowId);
  assert.equal(result.success, true, result.success ? '' : result.error);

  assert.equal(await rowById(rowId), null);
  assert.equal(await storedCount(), 3, 'a pending row was never counted');
});

test('rejecting is not a ban -- they may ask again', async () => {
  const asker = await makeActor('mq4');
  const rowId = await addMember(asker, 'member', 'pending');
  await rejectRequest(groupId, adminId, rowId);

  const banned = await listBannedMembers(groupId);
  assert.equal(banned.length, 0);
});

test('a moderator may work the join queue', async () => {
  const asker = await makeActor('mq5');
  const rowId = await addMember(asker, 'member', 'pending');

  const result = await approveRequest(groupId, modId, rowId);
  assert.equal(result.success, true, result.success ? '' : result.error);
});

test('a plain member may not work the join queue', async () => {
  const asker = await makeActor('mq6');
  const rowId = await addMember(asker, 'member', 'pending');

  const result = await approveRequest(groupId, memberId, rowId);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.status, 403);
  assert.equal((await rowById(rowId))?.status, 'pending');
});

test('approving an already-active member is refused, not counted twice', async () => {
  const rows = await db
    .select()
    .from(socialGroupMembers)
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.actorId, memberId)
      )
    );

  const result = await approveRequest(groupId, adminId, rows[0].id);
  assert.equal(result.success, false);
  assert.equal(await storedCount(), 3);
});

test('the pending queue is oldest first', async () => {
  const a = await makeActor('mp1');
  const b = await makeActor('mp2');
  const first = await addMember(a, 'member', 'pending');
  await new Promise((r) => setTimeout(r, 10));
  const second = await addMember(b, 'member', 'pending');

  const queue = await listPendingRequests(groupId);
  assert.equal(queue.length, 2);
  assert.equal(queue[0].id, first, 'whoever waited longest comes first');
  assert.equal(queue[1].id, second);
});

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

test('an admin may promote a member to moderator', async () => {
  const rows = await db
    .select()
    .from(socialGroupMembers)
    .where(eq(socialGroupMembers.actorId, memberId));

  const result = await setMemberRole(groupId, adminId, rows[0].id, 'moderator');
  assert.equal(result.success, true, result.success ? '' : result.error);
  assert.equal((await rowById(rows[0].id))?.role, 'moderator');
  assert.equal(await storedCount(), 3, 'a role change moves nobody in or out');
});

test('a moderator may not change roles at all', async () => {
  const rows = await db
    .select()
    .from(socialGroupMembers)
    .where(eq(socialGroupMembers.actorId, memberId));

  const result = await setMemberRole(groupId, modId, rows[0].id, 'moderator');
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.status, 403);
});

test('an admin may step down to moderator', async () => {
  const other = await makeActor('ms1');
  await addMember(other, 'admin', 'active');

  const [mine] = await db
    .select()
    .from(socialGroupMembers)
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.actorId, adminId)
      )
    );

  const result = await setMemberRole(groupId, adminId, mine.id, 'moderator');
  assert.equal(result.success, true, result.success ? '' : result.error);
  assert.equal((await rowById(mine.id))?.role, 'moderator');
});

test('the last admin may not step down', async () => {
  const [mine] = await db
    .select()
    .from(socialGroupMembers)
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.actorId, adminId)
      )
    );

  const result = await setMemberRole(groupId, adminId, mine.id, 'member');
  assert.equal(result.success, false, 'a group must keep one admin');
  if (!result.success) assert.equal(result.status, 409);
  assert.equal((await rowById(mine.id))?.role, 'admin');
});

test('a pending row cannot be given a role', async () => {
  const asker = await makeActor('ms2');
  const rowId = await addMember(asker, 'member', 'pending');

  const result = await setMemberRole(groupId, adminId, rowId, 'moderator');
  assert.equal(result.success, false);
  assert.equal((await rowById(rowId))?.role, 'member');
});

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

test('removing an active member deletes the row and subtracts one', async () => {
  const [row] = await db
    .select()
    .from(socialGroupMembers)
    .where(eq(socialGroupMembers.actorId, memberId));

  const result = await removeMember(groupId, adminId, row.id);
  assert.equal(result.success, true, result.success ? '' : result.error);

  assert.equal(await rowById(row.id), null);
  assert.equal(await storedCount(), 2);
});

test('removing a pending row does not subtract from the count', async () => {
  const asker = await makeActor('mr1');
  const rowId = await addMember(asker, 'member', 'pending');

  await removeMember(groupId, adminId, rowId);
  assert.equal(await storedCount(), 3);
});

test('a moderator may remove a member but not another moderator', async () => {
  const peer = await makeActor('mr2');
  const peerRow = await addMember(peer, 'moderator', 'active');
  const [memberRow] = await db
    .select()
    .from(socialGroupMembers)
    .where(eq(socialGroupMembers.actorId, memberId));

  const onMember = await removeMember(groupId, modId, memberRow.id);
  assert.equal(onMember.success, true, onMember.success ? '' : onMember.error);

  const onPeer = await removeMember(groupId, modId, peerRow);
  assert.equal(onPeer.success, false, 'peers resolve disputes, not each other');
  if (!onPeer.success) assert.equal(onPeer.status, 403);
});

test('a moderator may not remove an admin', async () => {
  const [adminRow] = await db
    .select()
    .from(socialGroupMembers)
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.actorId, adminId)
      )
    );

  const result = await removeMember(groupId, modId, adminRow.id);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.status, 403);
});

test('removing yourself is refused -- that is leaving', async () => {
  const [mine] = await db
    .select()
    .from(socialGroupMembers)
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.actorId, modId)
      )
    );

  const result = await removeMember(groupId, modId, mine.id);
  assert.equal(result.success, false);
  assert.ok(await rowById(mine.id));
});

test('the last admin may not be removed', async () => {
  const [adminRow] = await db
    .select()
    .from(socialGroupMembers)
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.actorId, adminId)
      )
    );

  const other = await makeActor('mr3');
  await addMember(other, 'admin', 'active');
  const [otherRow] = await db
    .select()
    .from(socialGroupMembers)
    .where(eq(socialGroupMembers.actorId, other));

  // With two admins, one may go.
  const first = await removeMember(groupId, adminId, otherRow.id);
  assert.equal(first.success, true, first.success ? '' : first.error);

  // The one left may not.
  const second = await removeMember(groupId, adminId, adminRow.id);
  assert.equal(second.success, false);
  assert.ok(await rowById(adminRow.id));
});

// ---------------------------------------------------------------------------
// Ban and unban
// ---------------------------------------------------------------------------

test('banning an active member keeps the row, subtracts one, and demotes', async () => {
  const peer = await makeActor('mb1');
  const rowId = await addMember(peer, 'moderator', 'active');
  await setCount(4);

  const result = await banMember(groupId, adminId, rowId);
  assert.equal(result.success, true, result.success ? '' : result.error);

  const row = await rowById(rowId);
  assert.equal(row?.status, 'banned', 'the row is the thing that enforces it');
  assert.equal(row?.role, 'member', 'a banned row should not claim rank');
  assert.equal(row?.joinedAt, null);
  assert.equal(await storedCount(), 3);
});

test('banning a pending asker does not subtract from the count', async () => {
  const asker = await makeActor('mb2');
  const rowId = await addMember(asker, 'member', 'pending');

  await banMember(groupId, adminId, rowId);
  assert.equal((await rowById(rowId))?.status, 'banned');
  assert.equal(await storedCount(), 3);
});

test('unbanning deletes the tombstone and leaves the count alone', async () => {
  const gone = await makeActor('mb3');
  const rowId = await addMember(gone, 'member', 'banned');

  const result = await unbanMember(groupId, adminId, rowId);
  assert.equal(result.success, true, result.success ? '' : result.error);

  assert.equal(
    await rowById(rowId),
    null,
    'unban means "you may ask again", not "you are back in"'
  );
  assert.equal(await storedCount(), 3);
});

test('the last admin may not be banned', async () => {
  const [adminRow] = await db
    .select()
    .from(socialGroupMembers)
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.actorId, adminId)
      )
    );

  const result = await banMember(groupId, adminId, adminRow.id);
  assert.equal(result.success, false);
  assert.equal((await rowById(adminRow.id))?.status, 'active');
});

test('banning yourself is refused', async () => {
  const [mine] = await db
    .select()
    .from(socialGroupMembers)
    .where(
      and(
        eq(socialGroupMembers.groupId, groupId),
        eq(socialGroupMembers.actorId, modId)
      )
    );

  const result = await banMember(groupId, modId, mine.id);
  assert.equal(result.success, false);
  assert.equal((await rowById(mine.id))?.status, 'active');
});

test('the banned list holds only banned rows', async () => {
  const gone = await makeActor('mb4');
  await addMember(gone, 'member', 'banned');
  const asker = await makeActor('mb5');
  await addMember(asker, 'member', 'pending');

  const banned = await listBannedMembers(groupId);
  assert.equal(banned.length, 1);
  assert.equal(banned[0].actorId, gone);
});

// ---------------------------------------------------------------------------
// Shape of refusals
// ---------------------------------------------------------------------------

test('acting on a row in another group is a 404, not a 403', async () => {
  const outsider = await makeActor('mx1');
  const other = await createGroup({
    handle: `mx${suffix}`,
    name: `Other ${suffix}`,
    summary: 'elsewhere',
    createdByProfileId: createdProfileIds[0],
    founderActorId: outsider,
  });
  assert.equal(other.success, true);
  if (!other.success) return;
  createdActorIds.push(other.actor.id);

  const [theirRow] = await db
    .select()
    .from(socialGroupMembers)
    .where(eq(socialGroupMembers.groupId, other.group.id));

  const result = await removeMember(groupId, adminId, theirRow.id);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.status, 404);

  await db
    .delete(socialGroupMembers)
    .where(eq(socialGroupMembers.groupId, other.group.id));
  await db.delete(socialGroups).where(eq(socialGroups.id, other.group.id));
  await db
    .delete(screennameHistory)
    .where(eq(screennameHistory.screenname, `mx${suffix}`));
});

test('a stranger acting on a member is refused', async () => {
  const stranger = await makeActor('mx2');
  const [row] = await db
    .select()
    .from(socialGroupMembers)
    .where(eq(socialGroupMembers.actorId, memberId));

  const result = await removeMember(groupId, stranger, row.id);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.status, 403);
});

test('a missing row is a 404', async () => {
  const result = await removeMember(groupId, adminId, 'no-such-row-id');
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.status, 404);
});

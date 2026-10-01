/**
 * Group roster tests
 *
 * What is worth testing here, specifically:
 *
 *  1. The ordering. Admins, then moderators, then members, oldest first
 *     within a rank, with ids breaking ties. The id tiebreak is the one that
 *     looks removable and is not: without it two members written in the same
 *     transaction can swap places between page 1 and page 2, and one of them
 *     is then never shown to anyone paging through.
 *  2. The status filter. Only 'active' rows are a roster. A pending row is
 *     somebody who asked and has not been let in; a banned row is a tombstone
 *     kept so they cannot rejoin. Either one leaking into the list both
 *     overstates the group's size and discloses something private, and the
 *     filter is one word that a refactor could drop without any test noticing.
 *  3. Paging arithmetic. `nextOffset` has to be null on the last page and an
 *     offset that makes progress otherwise. An off-by-one here either hides
 *     the tail of a roster or loops the UI forever.
 *  4. That leaders ignore paging and the member cap, since that list is what
 *     a locked-out stranger sees and is the only way into a private group.
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
const { profiles, socialActors, socialGroupMembers, screennameHistory } =
  await import('@/lib/schema');
const { createGroup } = await import('@/lib/federation/wrappers/group');
const { listGroupMembers, listGroupLeaders, MAX_ROSTER_PAGE } =
  await import('@/lib/federation/wrappers/group-members');

const suffix = Math.random().toString(36).slice(2, 8);
const groupHandle = `mr${suffix}`;

let groupId: string;
let founderActorId: string;

const createdProfileIds: string[] = [];
const createdActorIds: string[] = [];

/** An actor with a profile behind it, as a real pana would have. */
async function makeActor(label: string, name: string | null) {
  const [profile] = await db
    .insert(profiles)
    .values({ email: `${label}${suffix}@test.invalid`, name: name ?? label })
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
      name,
    })
    .returning();
  createdActorIds.push(actor.id);
  return actor;
}

/**
 * Membership written directly rather than through joinGroup, so the test can
 * set a role, a status and an exact joinedAt. joinGroup deliberately refuses
 * most of these combinations, which is what makes it the wrong tool here.
 */
async function addMember(
  actorId: string,
  role: 'admin' | 'moderator' | 'member',
  status: 'active' | 'pending' | 'banned',
  joinedAt: Date | null
) {
  const [row] = await db
    .insert(socialGroupMembers)
    .values({ groupId, actorId, role, status, joinedAt })
    .returning();
  return row;
}

const day = (n: number) => new Date(Date.UTC(2024, 0, n, 12, 0, 0));

before(async () => {
  const founder = await makeActor('rf', 'Roster Founder');
  founderActorId = founder.id;

  const created = await createGroup({
    handle: groupHandle,
    name: `Roster Group ${suffix}`,
    summary: 'A group with a roster',
    createdByProfileId: createdProfileIds[0],
    founderActorId,
  });
  assert.equal(created.success, true, created.success ? '' : created.error);
  if (!created.success) throw new Error('fixture group failed');
  groupId = created.group.id;
  createdActorIds.push(created.actor.id);
});

after(async () => {
  /* Membership rows cascade from the actors, but the group's own actor is
     deleted here too, so delete memberships first and leave nothing orphaned
     if the cascade ever changes. */
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
// The founder
// ---------------------------------------------------------------------------

test('a new group has exactly its founder, as an admin', async () => {
  const page = await listGroupMembers(groupId);

  assert.equal(page.total, 1);
  assert.equal(page.members.length, 1);
  assert.equal(page.members[0].actorId, founderActorId);
  assert.equal(page.members[0].role, 'admin');
  // One page holds everyone, so there is nothing after it.
  assert.equal(page.nextOffset, null);
});

test('the founder counts as a leader', async () => {
  const leaders = await listGroupLeaders(groupId);

  assert.equal(leaders.length, 1);
  assert.equal(leaders[0].actorId, founderActorId);
});

// ---------------------------------------------------------------------------
// The status filter
// ---------------------------------------------------------------------------

test('pending and banned rows are not part of the roster', async () => {
  const waiting = await makeActor('rp', 'Pending Pana');
  const removed = await makeActor('rb', 'Banned Pana');

  // A pending row has no joinedAt: they have not joined.
  await addMember(waiting.id, 'member', 'pending', null);
  await addMember(removed.id, 'member', 'banned', day(2));

  const page = await listGroupMembers(groupId);
  const actorIds = page.members.map((member) => member.actorId);

  assert.ok(
    !actorIds.includes(waiting.id),
    'a pending request is not a member'
  );
  assert.ok(!actorIds.includes(removed.id), 'a banned pana is not a member');
  // And neither one inflates the count shown next to the roster.
  assert.equal(page.total, 1);
});

test('a banned admin is not listed as a leader', async () => {
  const deposed = await makeActor('rx', 'Deposed Admin');
  await addMember(deposed.id, 'admin', 'banned', day(3));

  const leaders = await listGroupLeaders(groupId);
  const actorIds = leaders.map((leader) => leader.actorId);

  assert.ok(!actorIds.includes(deposed.id));
});

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

test('admins come before moderators, who come before members', async () => {
  /* Inserted in reverse so a query that happens to return insertion order
     cannot pass this by accident. */
  const member = await makeActor('ro', 'Ordinary Member');
  const mod = await makeActor('rm', 'The Moderator');
  const admin = await makeActor('ra', 'Second Admin');

  await addMember(member.id, 'member', 'active', day(10));
  await addMember(mod.id, 'moderator', 'active', day(11));
  await addMember(admin.id, 'admin', 'active', day(12));

  const page = await listGroupMembers(groupId, { limit: MAX_ROSTER_PAGE });
  const roles = page.members.map((row) => row.role);

  const firstMod = roles.indexOf('moderator');
  const firstMember = roles.indexOf('member');
  const lastAdmin = roles.lastIndexOf('admin');

  assert.ok(lastAdmin < firstMod, 'every admin precedes every moderator');
  assert.ok(firstMod < firstMember, 'every moderator precedes every member');
});

test('within a role the oldest member comes first', async () => {
  const late = await makeActor('rl', 'Late Joiner');
  const early = await makeActor('re', 'Early Joiner');

  // Written late-first, dated early-first.
  await addMember(late.id, 'member', 'active', day(25));
  await addMember(early.id, 'member', 'active', day(20));

  const page = await listGroupMembers(groupId, { limit: MAX_ROSTER_PAGE });
  const order = page.members.map((row) => row.actorId);

  assert.ok(order.indexOf(early.id) < order.indexOf(late.id));
});

test('members with the same joinedAt keep a stable order across calls', async () => {
  const same = day(15);
  const twinA = await makeActor('t1', 'Twin A');
  const twinB = await makeActor('t2', 'Twin B');

  await addMember(twinA.id, 'member', 'active', same);
  await addMember(twinB.id, 'member', 'active', same);

  const first = await listGroupMembers(groupId, { limit: MAX_ROSTER_PAGE });
  const second = await listGroupMembers(groupId, { limit: MAX_ROSTER_PAGE });

  assert.deepEqual(
    first.members.map((row) => row.id),
    second.members.map((row) => row.id),
    'identical timestamps must not reorder between queries'
  );
});

// ---------------------------------------------------------------------------
// Paging
// ---------------------------------------------------------------------------

test('paging walks the whole roster exactly once', async () => {
  const { total } = await listGroupMembers(groupId, { limit: 1 });

  const seen: string[] = [];
  let offset: number | null = 0;
  let guard = 0;

  while (offset !== null) {
    // A broken nextOffset loops forever; fail loudly instead of hanging.
    assert.ok(guard++ < total + 5, 'paging did not terminate');

    const page: Awaited<ReturnType<typeof listGroupMembers>> =
      await listGroupMembers(groupId, { limit: 2, offset });
    seen.push(...page.members.map((row) => row.id));
    offset = page.nextOffset;
  }

  assert.equal(seen.length, total, 'every member appears');
  assert.equal(new Set(seen).size, total, 'and none appears twice');
});

test('the last page reports no next offset', async () => {
  const { total } = await listGroupMembers(groupId, { limit: 1 });
  const page = await listGroupMembers(groupId, { limit: MAX_ROSTER_PAGE });

  assert.equal(page.members.length, total);
  assert.equal(page.nextOffset, null);
});

test('an offset past the end is empty rather than an error', async () => {
  const page = await listGroupMembers(groupId, { limit: 5, offset: 9999 });

  assert.equal(page.members.length, 0);
  assert.equal(page.nextOffset, null);
  // The count still describes the group, not the empty page.
  assert.ok(page.total > 0);
});

test('a limit above the cap is clamped to it', async () => {
  const page = await listGroupMembers(groupId, { limit: 100_000 });

  assert.ok(
    page.members.length <= MAX_ROSTER_PAGE,
    'a crafted limit cannot dump the whole table'
  );
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

test('an actor with no name falls back to its handle', async () => {
  const nameless = await makeActor('rn', null);
  await addMember(nameless.id, 'member', 'active', day(28));

  const page = await listGroupMembers(groupId, { limit: MAX_ROSTER_PAGE });
  const row = page.members.find((member) => member.actorId === nameless.id);

  assert.ok(row, 'the nameless member is still listed');
  assert.equal(row.name, `rn${suffix}`);
});

test('leaders are unpaginated and exclude plain members', async () => {
  const leaders = await listGroupLeaders(groupId);
  const roles = new Set(leaders.map((leader) => leader.role));

  assert.ok(leaders.length >= 2, 'the founder and the added admin and mod');
  assert.ok(!roles.has('member'), 'a plain member is not a leader');
  assert.equal(leaders[0].role, 'admin', 'admins lead the list');
});

/**
 * Recommendation Lists tests
 *
 * Exercises lib/federation/wrappers/recommendation-list.ts against a real
 * Postgres. These are the invariants the feature's promises rest on: only the
 * author can change their list, you can vouch for a business but not for a
 * person, the running order is the author's and stays contiguous, and — the
 * one that actually matters — a business leaving the directory must never
 * silently rewrite somebody else's list into something they did not write.
 *
 * Kept out of the Playwright suite (tests/) because there is no browser here:
 * this calls the wrapper directly, the same way the API routes do.
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
const { profiles, users, recommendationLists, recommendationListItems } =
  await import('@/lib/schema');
const {
  addItem,
  canViewList,
  createList,
  deleteList,
  getListItems,
  getVisibleListsForOwner,
  removeItem,
  reorderItems,
  updateItem,
  updateList,
  RecommendationListError,
} = await import('@/lib/federation/wrappers/recommendation-list');

const suffix = Math.random().toString(36).slice(2, 8);

let ownerUserId: string;
let strangerUserId: string;
let bizProfileId: string;
let biz2ProfileId: string;
let intakeProfileId: string;
let personalProfileId: string;
/** Deleted mid-suite by the tombstone test, so teardown must tolerate its absence. */
let doomedProfileId: string;

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];

/** Asserts that `fn` rejects with our error type carrying `code`. */
async function assertFails(fn: () => Promise<unknown>, code: string) {
  await assert.rejects(fn, (error: unknown) => {
    assert.ok(
      error instanceof RecommendationListError,
      `expected RecommendationListError, got ${String(error)}`
    );
    assert.equal(error.code, code);
    return true;
  });
}

before(async () => {
  const [owner] = await db
    .insert(users)
    .values({
      email: `rl-owner-${suffix}@test.invalid`,
      name: 'List Owner',
      screenname: `rlowner${suffix}`,
    })
    .returning();
  const [stranger] = await db
    .insert(users)
    .values({
      email: `rl-stranger-${suffix}@test.invalid`,
      name: 'Someone Else',
    })
    .returning();
  ownerUserId = owner.id;
  strangerUserId = stranger.id;
  createdUserIds.push(owner.id, stranger.id);

  // A directory listing: the account opted in by choosing small_business.
  const [bizUser] = await db
    .insert(users)
    .values({
      email: `rl-biz-${suffix}@test.invalid`,
      accountType: 'small_business',
    })
    .returning();
  createdUserIds.push(bizUser.id);
  const [biz] = await db
    .insert(profiles)
    .values({
      email: `rl-biz-${suffix}@test.invalid`,
      name: 'Cafe Uno',
      userId: bizUser.id,
      screenname: `rlbiz${suffix}`,
    })
    .returning();
  bizProfileId = biz.id;

  const [biz2User] = await db
    .insert(users)
    .values({
      email: `rl-biz2-${suffix}@test.invalid`,
      accountType: 'hybrid',
    })
    .returning();
  createdUserIds.push(biz2User.id);
  const [biz2] = await db
    .insert(profiles)
    .values({
      email: `rl-biz2-${suffix}@test.invalid`,
      name: 'Cafe Dos',
      userId: biz2User.id,
    })
    .returning();
  biz2ProfileId = biz2.id;

  // The other kind of listing: created by the public intake form, so it has no
  // linked user at all and is identified purely by status.source.
  const [intake] = await db
    .insert(profiles)
    .values({
      email: `rl-intake-${suffix}@test.invalid`,
      name: 'Panaderia Intake',
      status: { source: 'business_intake' },
    })
    .returning();
  intakeProfileId = intake.id;

  // A person. Must never be addable to a list.
  const [personUser] = await db
    .insert(users)
    .values({ email: `rl-person-${suffix}@test.invalid` })
    .returning();
  createdUserIds.push(personUser.id);
  const [person] = await db
    .insert(profiles)
    .values({
      email: `rl-person-${suffix}@test.invalid`,
      name: 'Ana',
      userId: personUser.id,
    })
    .returning();
  personalProfileId = person.id;

  const [doomedUser] = await db
    .insert(users)
    .values({
      email: `rl-doomed-${suffix}@test.invalid`,
      accountType: 'small_business',
    })
    .returning();
  createdUserIds.push(doomedUser.id);
  const [doomed] = await db
    .insert(profiles)
    .values({
      email: `rl-doomed-${suffix}@test.invalid`,
      name: 'Closing Soon Cafe',
      userId: doomedUser.id,
    })
    .returning();
  doomedProfileId = doomed.id;

  createdProfileIds.push(
    biz.id,
    biz2.id,
    intake.id,
    person.id
    // doomedProfileId is deliberately absent: one test deletes it.
  );
});

after(async () => {
  for (const id of createdProfileIds) {
    await db.delete(profiles).where(eq(profiles.id, id));
  }
  await db.delete(profiles).where(eq(profiles.id, doomedProfileId));
  // Lists cascade from users.
  for (const id of createdUserIds) {
    await db.delete(users).where(eq(users.id, id));
  }

  // postgres.js holds the process open otherwise, which hangs the runner.
  const client = (db as unknown as { $client?: { end?: () => Promise<void> } })
    .$client;
  await client?.end?.();
});

test('createList defaults to private and mints a slug from the title', async () => {
  const list = await createList(ownerUserId, {
    title: 'Cafecito Crawl',
    blurb: 'Where to start and where to end up.',
  });

  assert.equal(list.visibility, 'private');
  assert.equal(list.slug, 'cafecito-crawl');
  assert.equal(list.itemCount, 0);
  // Private lists have no federated identity yet.
  assert.equal(list.uri, null);
  assert.equal(list.publishedAt, null);

  await deleteList(list.id, ownerUserId);
});

test('slugs are unique per owner, and are not rewritten by a retitle', async () => {
  const first = await createList(ownerUserId, { title: 'Same Name' });
  const second = await createList(ownerUserId, { title: 'Same Name' });

  assert.equal(first.slug, 'same-name');
  assert.equal(second.slug, 'same-name-2');

  // The slug rides in the federated id, so renaming must not move it.
  const renamed = await updateList(first.id, ownerUserId, {
    title: 'Completely Different',
  });
  assert.equal(renamed.slug, 'same-name');
  assert.equal(renamed.title, 'Completely Different');

  await deleteList(first.id, ownerUserId);
  await deleteList(second.id, ownerUserId);
});

test('only the owner can modify a list', async () => {
  const list = await createList(ownerUserId, { title: 'Mine Alone' });

  await assertFails(
    () => updateList(list.id, strangerUserId, { title: 'Hijacked' }),
    'FORBIDDEN'
  );
  await assertFails(() => deleteList(list.id, strangerUserId), 'FORBIDDEN');
  await assertFails(
    () =>
      addItem(list.id, strangerUserId, {
        profileId: bizProfileId,
        note: 'not yours',
      }),
    'FORBIDDEN'
  );

  await deleteList(list.id, ownerUserId);
});

test('you can recommend a business but not a person', async () => {
  const list = await createList(ownerUserId, { title: 'Businesses Only' });

  const item = await addItem(list.id, ownerUserId, {
    profileId: bizProfileId,
    note: 'Colada at 7am, no notes.',
  });
  assert.equal(item.profileId, bizProfileId);
  assert.equal(item.profileNameAtAdd, 'Cafe Uno');

  // Intake listings have no linked user, and are still listings.
  const intakeItem = await addItem(list.id, ownerUserId, {
    profileId: intakeProfileId,
    note: 'Pastelitos come out at four.',
  });
  assert.equal(intakeItem.profileId, intakeProfileId);

  await assertFails(
    () =>
      addItem(list.id, ownerUserId, {
        profileId: personalProfileId,
        note: 'my friend',
      }),
    'NOT_A_DIRECTORY_LISTING'
  );

  await deleteList(list.id, ownerUserId);
});

test('the same business twice on one list is refused, across two lists is fine', async () => {
  const first = await createList(ownerUserId, { title: 'Morning' });
  const second = await createList(ownerUserId, { title: 'Evening' });

  await addItem(first.id, ownerUserId, {
    profileId: bizProfileId,
    note: 'First thing.',
  });

  await assertFails(
    () =>
      addItem(first.id, ownerUserId, {
        profileId: bizProfileId,
        note: 'again',
      }),
    'DUPLICATE_ENTRY'
  );

  // Same place, different framing. This is the feature working.
  const elsewhere = await addItem(second.id, ownerUserId, {
    profileId: bizProfileId,
    note: 'Also good at night.',
  });
  assert.equal(elsewhere.profileId, bizProfileId);

  await deleteList(first.id, ownerUserId);
  await deleteList(second.id, ownerUserId);
});

test('itemCount tracks adds and removes, and positions stay contiguous', async () => {
  const list = await createList(ownerUserId, { title: 'Counting' });

  const a = await addItem(list.id, ownerUserId, {
    profileId: bizProfileId,
    note: 'one',
  });
  const b = await addItem(list.id, ownerUserId, {
    profileId: biz2ProfileId,
    note: 'two',
  });
  const c = await addItem(list.id, ownerUserId, {
    profileId: intakeProfileId,
    note: 'three',
  });

  assert.deepEqual([a.position, b.position, c.position], [0, 1, 2]);

  const afterAdds = await db.query.recommendationLists.findFirst({
    where: eq(recommendationLists.id, list.id),
  });
  assert.equal(afterAdds?.itemCount, 3);

  // Removing the middle entry must close the gap, or the reorder path's
  // contiguity assumption quietly stops holding.
  await removeItem(list.id, b.id, ownerUserId);

  const remaining = await getListItems(list.id);
  assert.deepEqual(
    remaining.map((item) => item.position),
    [0, 1]
  );
  assert.deepEqual(
    remaining.map((item) => item.note),
    ['one', 'three']
  );

  const afterRemove = await db.query.recommendationLists.findFirst({
    where: eq(recommendationLists.id, list.id),
  });
  assert.equal(afterRemove?.itemCount, 2);

  await deleteList(list.id, ownerUserId);
});

test('reorder rewrites the running order and rejects an incomplete one', async () => {
  const list = await createList(ownerUserId, { title: 'Order Matters' });

  const a = await addItem(list.id, ownerUserId, {
    profileId: bizProfileId,
    note: 'start here',
  });
  const b = await addItem(list.id, ownerUserId, {
    profileId: biz2ProfileId,
    note: 'then here',
  });
  const c = await addItem(list.id, ownerUserId, {
    profileId: intakeProfileId,
    note: 'end here',
  });

  await reorderItems(list.id, ownerUserId, [c.id, a.id, b.id]);

  const reordered = await getListItems(list.id);
  assert.deepEqual(
    reordered.map((item) => item.id),
    [c.id, a.id, b.id]
  );
  assert.deepEqual(
    reordered.map((item) => item.position),
    [0, 1, 2]
  );

  // A partial order would leave entries at stale positions, so it is refused
  // outright rather than half-applied.
  await assertFails(
    () => reorderItems(list.id, ownerUserId, [a.id, b.id]),
    'INCOMPLETE_ORDER'
  );
  await assertFails(
    () => reorderItems(list.id, strangerUserId, [c.id, a.id, b.id]),
    'FORBIDDEN'
  );

  await deleteList(list.id, ownerUserId);
});

test('editing a note leaves the recommended business alone', async () => {
  const list = await createList(ownerUserId, { title: 'Notes' });
  const item = await addItem(list.id, ownerUserId, {
    profileId: bizProfileId,
    note: 'first draft',
  });

  const updated = await updateItem(list.id, item.id, ownerUserId, {
    note: 'They let me spread proofs across two tables.',
  });

  assert.equal(updated.note, 'They let me spread proofs across two tables.');
  assert.equal(updated.profileId, bizProfileId);
  assert.equal(updated.position, item.position);

  await assertFails(
    () => updateItem(list.id, item.id, strangerUserId, { note: 'nope' }),
    'FORBIDDEN'
  );

  await deleteList(list.id, ownerUserId);
});

test('visibility: public is enumerable, unlisted only by direct link, private only by owner', async () => {
  const pub = await createList(ownerUserId, {
    title: 'Public List',
    visibility: 'public',
  });
  const unlisted = await createList(ownerUserId, {
    title: 'Unlisted List',
    visibility: 'unlisted',
  });
  const priv = await createList(ownerUserId, { title: 'Private List' });

  assert.ok(pub.publishedAt, 'a public list is stamped as published');
  assert.ok(pub.uri, 'a public list has a federated id');
  // Unlisted still gets an id: it is linkable, so it needs a stable identity.
  assert.ok(unlisted.uri);
  assert.equal(priv.uri, null);

  // Anonymous enumeration sees only the public one.
  const anon = await getVisibleListsForOwner(ownerUserId, null);
  const anonIds = anon.map((l) => l.id);
  assert.ok(anonIds.includes(pub.id));
  assert.ok(!anonIds.includes(unlisted.id), 'unlisted must not enumerate');
  assert.ok(!anonIds.includes(priv.id));

  // The owner sees everything on their own shelf.
  const own = await getVisibleListsForOwner(ownerUserId, ownerUserId);
  const ownIds = own.map((l) => l.id);
  assert.ok(ownIds.includes(pub.id));
  assert.ok(ownIds.includes(unlisted.id));
  assert.ok(ownIds.includes(priv.id));

  // Direct fetch is the case unlisted exists for.
  assert.equal(canViewList(unlisted, null, { direct: true }), true);
  assert.equal(canViewList(unlisted, null), false);
  assert.equal(canViewList(priv, null, { direct: true }), false);
  assert.equal(canViewList(priv, strangerUserId, { direct: true }), false);
  assert.equal(canViewList(priv, ownerUserId, { direct: true }), true);

  await deleteList(pub.id, ownerUserId);
  await deleteList(unlisted.id, ownerUserId);
  await deleteList(priv.id, ownerUserId);
});

test('publishedAt is stamped once and does not move on later edits', async () => {
  const list = await createList(ownerUserId, {
    title: 'Stable Published',
    visibility: 'public',
  });
  const firstStamp = list.publishedAt;
  assert.ok(firstStamp);

  const hidden = await updateList(list.id, ownerUserId, {
    visibility: 'private',
  });
  const republished = await updateList(list.id, ownerUserId, {
    visibility: 'public',
  });

  assert.equal(
    republished.publishedAt?.getTime(),
    firstStamp.getTime(),
    'published_at is "since when", not "most recently"'
  );
  // The federated id survives the round trip, so remote caches stay valid.
  assert.equal(republished.uri, list.uri);
  assert.equal(hidden.uri, list.uri);

  await deleteList(list.id, ownerUserId);
});

test('deleting a business tombstones the entry instead of rewriting the list', async () => {
  const list = await createList(ownerUserId, { title: 'Survives Deletion' });

  await addItem(list.id, ownerUserId, {
    profileId: bizProfileId,
    note: 'still here',
  });
  const doomed = await addItem(list.id, ownerUserId, {
    profileId: doomedProfileId,
    note: 'Colada at 7am, no notes.',
  });

  // The business leaves the directory. This must not edit anyone's list.
  await db.delete(profiles).where(eq(profiles.id, doomedProfileId));

  const items = await getListItems(list.id);
  assert.equal(items.length, 2, 'the entry survives its target');

  const tombstone = items.find((item) => item.id === doomed.id);
  assert.ok(tombstone);
  assert.equal(tombstone.profileId, null, 'the pointer is nulled');
  assert.equal(
    tombstone.note,
    'Colada at 7am, no notes.',
    "the author's words are untouched"
  );
  assert.equal(tombstone.position, 1, 'its place in the sequence is kept');
  assert.equal(
    tombstone.profileNameAtAdd,
    'Closing Soon Cafe',
    'the name snapshot still labels it'
  );

  await deleteList(list.id, ownerUserId);
});

test('deleting a list removes its items', async () => {
  const list = await createList(ownerUserId, { title: 'Cascade Check' });
  const item = await addItem(list.id, ownerUserId, {
    profileId: bizProfileId,
    note: 'goes with the list',
  });

  await deleteList(list.id, ownerUserId);

  const orphan = await db.query.recommendationListItems.findFirst({
    where: eq(recommendationListItems.id, item.id),
  });
  assert.equal(orphan, undefined);
});

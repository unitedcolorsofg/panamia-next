/**
 * Which events a connector commitment may be attached to.
 *
 * Covers the Panamia host scope in `lib/connectors/commitments.ts`. Before it
 * existed, `listAssignableEvents` returned every published future event in the
 * directory, so the connector task picker offered any pana's gig as something
 * to staff a volunteer to, and the soonest-first `limit` could push the
 * Panamia event an admin was looking for off the end of the list.
 *
 * `assignableEventExists` is tested alongside it on purpose. The dropdown not
 * offering an event is a convenience; that function is the gate a hand-made
 * POST hits. If the two ever drift apart the narrower one is decoration.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from 'dotenv';

config({ path: '.env.local' });

const suffix = Math.random().toString(36).slice(2, 8);

/**
 * A federation domain of this run's own.
 *
 * The official host is looked up by handle AND domain, and the handle is fixed
 * at `panamia` -- it cannot carry the per-run suffix the README requires. The
 * domain can, which keeps two concurrent CI runs from colliding on
 * `social_actors_username_domain_unique` and keeps this fixture away from any
 * real Panamia group in a shared database.
 *
 * Assigned after `config()` so it wins over whatever .env.local sets, and
 * before the dynamic imports below so `socialConfig.domain` -- frozen when
 * lib/federation is first evaluated -- agrees with the resolver, which reads
 * the variable fresh on every call.
 */
const domain = `t${suffix}.invalid`;
process.env.FEDERATION_DOMAIN = domain;

const { db } = await import('@/lib/db');
const { eq, inArray } = await import('drizzle-orm');
const { profiles, socialActors, events } = await import('@/lib/schema');
const { createGroup } = await import('@/lib/federation/wrappers/group');
const { OFFICIAL_HOST_HANDLE, resetOfficialHostCache } =
  await import('@/lib/server/official-host');
const { listAssignableEvents, assignableEventExists } =
  await import('@/lib/connectors/commitments');

const HOUR = 60 * 60 * 1000;
const soon = (hours: number) => new Date(Date.now() + hours * HOUR);

let profileId: string;
const createdActorIds: string[] = [];
const createdEventIds: string[] = [];

let panamiaGroupId: string;
let rivalGroupId: string;

/** Fixture event ids, by what each one is here to prove. */
const ev: Record<string, string> = {};

async function addEvent(
  key: string,
  values: {
    startsAt: Date;
    status: 'draft' | 'published';
    hostGroupId?: string;
    hostProfileId?: string;
  }
) {
  const [row] = await db
    .insert(events)
    .values({
      slug: `ae-${suffix}-${key}`,
      // notNull and unique, with no default. Namespaced like the slug so two
      // runs cannot collide on it.
      icalUid: `ae-${suffix}-${key}@test.invalid`,
      title: `Assignable fixture ${key}`,
      ...values,
    })
    .returning({ id: events.id });
  ev[key] = row.id;
  createdEventIds.push(row.id);
}

before(async () => {
  const [profile] = await db
    .insert(profiles)
    .values({ email: `ae${suffix}@test.invalid`, name: 'Assignable Founder' })
    .returning();
  profileId = profile.id;

  const [founder] = await db
    .insert(socialActors)
    .values({
      username: `af${suffix}`,
      domain,
      type: 'Person',
      profileId,
      uri: `https://${domain}/users/af${suffix}`,
      inboxUrl: `https://${domain}/users/af${suffix}/inbox`,
      outboxUrl: `https://${domain}/users/af${suffix}/outbox`,
      followersUrl: `https://${domain}/users/af${suffix}/followers`,
      followingUrl: `https://${domain}/users/af${suffix}/following`,
      publicKey: 'test-public-key',
      privateKey: 'test-private-key',
    })
    .returning();
  createdActorIds.push(founder.id);

  // Panamia itself. The reserved handle is the point of the flag.
  const official = await createGroup({
    handle: OFFICIAL_HOST_HANDLE,
    name: 'Panamia',
    createdByProfileId: profileId,
    founderActorId: founder.id,
    allowReservedHandle: true,
  });
  // Thrown rather than asserted: `before` failing with the reason is more use
  // than every test failing on an undefined id.
  if (!official.success) throw new Error(official.error);
  panamiaGroupId = official.group.id;
  createdActorIds.push(official.group.actorId);

  // Somebody else's club, to stand in for the rest of the directory.
  const rival = await createGroup({
    handle: `rv${suffix}`,
    name: 'Someone Else Club',
    createdByProfileId: profileId,
    founderActorId: founder.id,
  });
  if (!rival.success) throw new Error(rival.error);
  rivalGroupId = rival.group.id;
  createdActorIds.push(rival.group.actorId);

  await addEvent('panamiaSoon', {
    startsAt: soon(2),
    status: 'published',
    hostGroupId: panamiaGroupId,
  });
  await addEvent('panamiaDraft', {
    startsAt: soon(3),
    status: 'draft',
    hostGroupId: panamiaGroupId,
  });
  await addEvent('panamiaPast', {
    startsAt: new Date(Date.now() - 48 * HOUR),
    status: 'published',
    hostGroupId: panamiaGroupId,
  });
  await addEvent('rivalSoon', {
    startsAt: soon(4),
    status: 'published',
    hostGroupId: rivalGroupId,
  });
  await addEvent('panaSoon', {
    startsAt: soon(5),
    status: 'published',
    hostProfileId: profileId,
  });

  resetOfficialHostCache();
});

after(async () => {
  // Events first. events.host_group_id is ON DELETE RESTRICT, so the groups
  // cannot go while anything they host is still on the table.
  if (createdEventIds.length) {
    await db.delete(events).where(inArray(events.id, createdEventIds));
  }
  for (const id of createdActorIds) {
    await db.delete(socialActors).where(eq(socialActors.id, id));
  }
  if (profileId) {
    await db.delete(profiles).where(eq(profiles.id, profileId));
  }
  resetOfficialHostCache();
  delete process.env.FEDERATION_DOMAIN;
  await db.$client.end();
});

/** Just the public half, which is the half this scope governs. */
async function publicIds(): Promise<string[]> {
  const all = await listAssignableEvents();
  return all.filter((e) => e.kind === 'public').map((e) => e.id);
}

test('a published future event Panamia hosts is assignable', async () => {
  const ids = await publicIds();
  assert.ok(
    ids.includes(ev.panamiaSoon),
    'Panamia-hosted published future event should be offered'
  );
  assert.equal(await assignableEventExists('public', ev.panamiaSoon), true);
});

test("another group's event is not assignable", async () => {
  const ids = await publicIds();
  assert.ok(
    !ids.includes(ev.rivalSoon),
    'an event hosted by another group should not be offered'
  );
  // The gate, not the dropdown: this is what a hand-made POST hits.
  assert.equal(await assignableEventExists('public', ev.rivalSoon), false);
});

test('an event a pana hosts in their own name is not assignable', async () => {
  const ids = await publicIds();
  assert.ok(
    !ids.includes(ev.panaSoon),
    'a profile-hosted event should not be offered'
  );
  assert.equal(await assignableEventExists('public', ev.panaSoon), false);
});

test('a Panamia draft is not assignable', async () => {
  const ids = await publicIds();
  assert.ok(!ids.includes(ev.panamiaDraft), 'a draft has no agreed date');
  assert.equal(await assignableEventExists('public', ev.panamiaDraft), false);
});

test('a Panamia event that has already happened is not assignable', async () => {
  const ids = await publicIds();
  assert.ok(!ids.includes(ev.panamiaPast), 'you cannot staff the past');
  assert.equal(await assignableEventExists('public', ev.panamiaPast), false);
});

test('the public half is empty when Panamia is not set up', async () => {
  // Point the resolver at a domain holding no Panamia, which is the state of
  // every database before scripts/seed-official-host.ts has been run.
  process.env.FEDERATION_DOMAIN = `none${suffix}.invalid`;
  resetOfficialHostCache();
  try {
    assert.deepEqual(
      await publicIds(),
      [],
      'without an official host the public half is skipped, not left unfiltered'
    );
    assert.equal(
      await assignableEventExists('public', ev.panamiaSoon),
      false,
      'the write path stays shut rather than falling back to any published event'
    );
  } finally {
    process.env.FEDERATION_DOMAIN = domain;
    resetOfficialHostCache();
  }
});

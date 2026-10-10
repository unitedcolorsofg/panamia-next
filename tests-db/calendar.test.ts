/**
 * Personal calendar tests
 *
 * The calendar's rules are all about who may see what, and every one of them
 * is invisible in the UI -- a wrong answer here looks like a working page. So
 * these tests are about the boundaries, not the happy path:
 *
 *  1. Unlisted is allowed in `committed` and banned from `suggested`. There is
 *     no private event (the enum is public | unlisted), so "unlisted" is the
 *     whole of the privacy model: you could only have RSVP'd by being handed
 *     the link, but being in the host's group is not the same as being handed
 *     it. This is the one rule that leaks real information if it is wrong.
 *  2. `maybe` counts as a commitment. It is the entry most worth showing,
 *     because it is the only one still waiting on a decision.
 *  3. An unverified RSVP does not. Somebody who started the magic-link flow
 *     and never finished has not said yes to anything.
 *  4. Hosting is a commitment, and an event you both host and RSVP'd to
 *     appears exactly once.
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
const { profiles, socialActors, events, eventAttendees } =
  await import('@/lib/schema');
const { createGroup, joinGroup } =
  await import('@/lib/federation/wrappers/group');
const { getPersonalCalendar } = await import('@/lib/calendar');
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

/** The reader: the pana whose calendar is under test. */
let meProfileId: string;
let meActorId: string;
/** The group they are in, which hosts events. */
let groupId: string;

const createdActorIds: string[] = [];
const createdEventIds: string[] = [];
const createdProfileIds: string[] = [];

/** Tomorrow, so everything lands inside the default 60-day horizon. */
function soon(daysOut = 1): Date {
  return new Date(Date.now() + daysOut * 86400000);
}

async function insertEvent(values: {
  hostProfileId?: string | null;
  hostGroupId?: string | null;
  title: string;
  visibility?: 'public' | 'unlisted';
  status?: 'draft' | 'published' | 'cancelled';
  startsAt?: Date;
}) {
  const [row] = await db
    .insert(events)
    .values({
      slug: `cal-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
      title: values.title,
      hostProfileId: values.hostProfileId ?? null,
      hostGroupId: values.hostGroupId ?? null,
      visibility: values.visibility ?? 'public',
      status: values.status ?? 'published',
      startsAt: values.startsAt ?? soon(),
      icalUid: buildIcalUid(),
    })
    .returning();
  createdEventIds.push(row.id);
  return row;
}

async function rsvp(
  eventId: string,
  status: 'going' | 'maybe' | 'not_going',
  { verified = true }: { verified?: boolean } = {}
) {
  await db.insert(eventAttendees).values({
    eventId,
    profileId: meProfileId,
    email: `cal${suffix}@test.invalid`,
    name: 'Calendar Reader',
    status,
    emailVerifiedAt: verified ? new Date() : null,
    respondedAt: new Date(),
  });
}

/** The calendar as this pana sees it. */
async function calendar() {
  return getPersonalCalendar({ profileId: meProfileId, actorId: meActorId });
}

const titles = (entries: { title: string }[]) => entries.map((e) => e.title);

before(async () => {
  const [me] = await db
    .insert(profiles)
    .values({ email: `cal${suffix}@test.invalid`, name: 'Calendar Reader' })
    .returning();
  meProfileId = me.id;
  createdProfileIds.push(me.id);

  const [meActor] = await db
    .insert(socialActors)
    .values({ ...mkActor(`cal${suffix}`), profileId: meProfileId })
    .returning();
  meActorId = meActor.id;
  createdActorIds.push(meActor.id);

  const created = await createGroup({
    handle: `cg${suffix}`,
    name: `Calendar Group ${suffix}`,
    summary: 'Hosts things',
    topics: ['events'],
    createdByProfileId: meProfileId,
    founderActorId: meActorId,
  });
  assert.equal(created.success, true);
  if (!created.success) throw new Error('fixture group failed');
  groupId = created.group.id;
  createdActorIds.push(created.actor.id);

  // createGroup already makes the founder an admin; joining again would be a
  // second membership row. The reader is in the group by virtue of founding it.
  void joinGroup;
});

after(async () => {
  for (const id of createdEventIds) {
    await db.delete(eventAttendees).where(eq(eventAttendees.eventId, id));
    await db.delete(events).where(eq(events.id, id));
  }
  for (const id of createdActorIds) {
    await db.delete(socialActors).where(eq(socialActors.id, id));
  }
  for (const id of createdProfileIds) {
    await db.delete(profiles).where(eq(profiles.id, id));
  }
});

test('an unlisted event you RSVP\u2019d to is on your own calendar', async () => {
  const event = await insertEvent({
    hostGroupId: groupId,
    title: `Unlisted RSVP ${suffix}`,
    visibility: 'unlisted',
  });
  await rsvp(event.id, 'going');

  const { committed } = await calendar();
  assert.ok(
    titles(committed).includes(event.title),
    'an unlisted event you were handed the link to belongs on your calendar'
  );
});

test('an unlisted event your group hosts is never suggested', async () => {
  const event = await insertEvent({
    hostGroupId: groupId,
    title: `Unlisted group ${suffix}`,
    visibility: 'unlisted',
  });

  const { suggested } = await calendar();
  assert.ok(
    !titles(suggested).includes(event.title),
    'being in the host group is not the same as having been given the link'
  );
});

test('a public event your group hosts is suggested, and says why', async () => {
  const event = await insertEvent({
    hostGroupId: groupId,
    title: `Public group ${suffix}`,
  });

  const { suggested } = await calendar();
  const entry = suggested.find((row) => row.title === event.title);
  assert.ok(entry, 'a public group event should be suggested');
  assert.ok(
    entry.because && entry.because.length > 0,
    'an unsolicited row that cannot say why it is there reads as advertising'
  );
});

test('a maybe is a commitment', async () => {
  const event = await insertEvent({
    hostGroupId: groupId,
    title: `Undecided ${suffix}`,
  });
  await rsvp(event.id, 'maybe');

  const { committed } = await calendar();
  const entry = committed.find((row) => row.title === event.title);
  assert.ok(entry, 'a maybe is the entry still waiting on a decision');
  assert.equal(entry.rsvp, 'maybe');
});

test('an unverified RSVP is not', async () => {
  const event = await insertEvent({
    hostGroupId: groupId,
    title: `Unverified ${suffix}`,
  });
  await rsvp(event.id, 'going', { verified: false });

  const { committed } = await calendar();
  assert.ok(
    !titles(committed).includes(event.title),
    'starting the magic-link flow and abandoning it is not a commitment'
  );
});

test('a not_going RSVP is not', async () => {
  const event = await insertEvent({
    hostGroupId: groupId,
    title: `Declined ${suffix}`,
  });
  await rsvp(event.id, 'not_going');

  const { committed } = await calendar();
  assert.ok(!titles(committed).includes(event.title));
});

test('hosting is a commitment', async () => {
  const event = await insertEvent({
    hostProfileId: meProfileId,
    title: `I am hosting ${suffix}`,
  });

  const { committed } = await calendar();
  const entry = committed.find((row) => row.title === event.title);
  assert.ok(
    entry,
    'an organiser whose calendar omits their own event is wrong'
  );
  assert.equal(entry.reason, 'hosting');
  assert.equal(entry.rsvp, null, 'nobody RSVPs to their own event');
});

test('an event you host and RSVP\u2019d to appears once', async () => {
  const event = await insertEvent({
    hostProfileId: meProfileId,
    title: `Host and going ${suffix}`,
  });
  await rsvp(event.id, 'going');

  const { committed } = await calendar();
  const matches = committed.filter((row) => row.title === event.title);
  assert.equal(matches.length, 1, 'hosting wins, and it is listed once');
  assert.equal(matches[0].reason, 'hosting');
});

test('a committed event is never also suggested', async () => {
  const event = await insertEvent({
    hostGroupId: groupId,
    title: `Both lists ${suffix}`,
  });
  await rsvp(event.id, 'going');

  const { committed, suggested } = await calendar();
  assert.ok(titles(committed).includes(event.title));
  assert.ok(
    !titles(suggested).includes(event.title),
    'the two lists must not interleave or repeat'
  );
});

test('a draft event is on nobody\u2019s calendar', async () => {
  const event = await insertEvent({
    hostProfileId: meProfileId,
    title: `Draft ${suffix}`,
    status: 'draft',
  });

  const { committed } = await calendar();
  assert.ok(
    !titles(committed).includes(event.title),
    'an unpublished event has no date anyone has agreed to'
  );
});

test('a cancelled event drops off', async () => {
  const event = await insertEvent({
    hostGroupId: groupId,
    title: `Cancelled ${suffix}`,
    status: 'cancelled',
  });
  await rsvp(event.id, 'going');

  const { committed } = await calendar();
  assert.ok(!titles(committed).includes(event.title));
});

test('an event past the horizon is not shown', async () => {
  const event = await insertEvent({
    hostProfileId: meProfileId,
    title: `Far future ${suffix}`,
    startsAt: soon(400),
  });

  const { committed } = await calendar();
  assert.ok(!titles(committed).includes(event.title));
});

test('an account with no social actor still gets its own commitments', async () => {
  const event = await insertEvent({
    hostProfileId: meProfileId,
    title: `No actor ${suffix}`,
  });

  const { committed, suggested } = await getPersonalCalendar({
    profileId: meProfileId,
    actorId: null,
  });

  assert.ok(
    titles(committed).includes(event.title),
    'RSVPs and hosting predate Pana Social and do not need an actor'
  );
  assert.equal(
    suggested.length,
    0,
    'with no actor there are no groups or follows to suggest from'
  );
});

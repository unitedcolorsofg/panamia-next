#!/usr/bin/env npx tsx
/**
 * Seed Test Account Script
 *
 * Gives a local account enough of a social footprint to click through: a
 * SocialActor, mutual follows ("Panas"), a few one-way followers so the
 * follower count differs from the Panas count, and some posts to fill the
 * profile and timeline.
 *
 * Usage: npx tsx scripts/seed-test-account.ts [handle]
 *        (defaults to pana1, who owns Bohemian Kitchen in the seed data and so
 *        exercises the account switcher as well)
 *
 * Safe to re-run — every step checks for what it would create first.
 *
 * Local databases only. This writes posts and follows as other people's
 * accounts, which is not something to point at anything shared.
 */

import { config } from 'dotenv';

config({ path: '.env.local' });

const HANDLE = process.argv[2] ?? 'pana1';

/** Mutual follows, which is what the profile counts as Panas. */
const PANAS = ['pana2', 'pana3', 'pana4', 'pana5', 'pana6'];

/** One-way, so the follower count is visibly not the same number. */
const FOLLOWERS_ONLY = ['pana7', 'pana8', 'pana9'];

const OWN_POSTS = [
  'Finally got the new kiln up and running. First firing this weekend — if you have been waiting on a piece, it is coming.',
  'Spent the morning at the Allapattah market talking to other makers. Everyone is figuring out the same things at the same time and nobody is talking about it enough.',
  'Reminder that the studio is open Saturdays now. Come say hi, no need to buy anything.',
];

const OTHERS_POSTS: Record<string, string> = {
  pana2: 'New batch of pantry staples went up today. The guava is back.',
  pana3:
    'Teaching a beginners screenprinting class next month. Six spots, no experience needed.',
  pana4:
    'Shot a wedding in Little Haiti this weekend. The light at that hour is unreal.',
  pana5:
    'Looking for a shared studio space in Broward if anyone has a corner going spare.',
};

function line(label: string, value: string | number): void {
  console.log(`  ${label.padEnd(12)} ${value}`);
}

async function main(): Promise<void> {
  const connectionString =
    process.env.POSTGRES_URL ?? process.env.POSTGRES_DIRECT_URL;
  if (!connectionString) {
    console.error('Error: POSTGRES_URL is required (check .env.local)');
    process.exit(1);
  }
  // lib/db reads this one directly rather than going through the CF binding.
  process.env.POSTGRES_URL = connectionString;

  const target = connectionString.replace(/\/\/[^@]*@/, '//***@').split('?')[0];
  if (!/localhost|127\.0\.0\.1/.test(connectionString)) {
    console.error('Refusing to run: this only targets a local database.');
    console.error('Database:', target);
    process.exit(1);
  }

  // lib/federation decides which actors count as local by reading
  // NEXT_PUBLIC_HOST_URL at import time, and a follow to a non-local actor is
  // left pending instead of accepted. Importing before dotenv has run would
  // quietly seed follows that never surface as Panas, so this is deferred
  // until after config() above.
  const [
    { db },
    schema,
    { createActorForProfile },
    { createFollow },
    { createStatus },
  ] = await Promise.all([
    import('../lib/db'),
    import('../lib/schema'),
    import('../lib/federation/wrappers/actor'),
    import('../lib/federation/wrappers/follow'),
    import('../lib/federation/wrappers/status'),
  ]);
  const { eq } = await import('drizzle-orm');

  console.log('Database:', target);
  console.log('Account: ', HANDLE, '\n');

  /** Resolve a handle to its profile, then make sure it can federate. */
  async function actorFor(handle: string): Promise<string | null> {
    const profile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.screenname, handle),
    });
    if (!profile) {
      console.log(`  [skip] no profile for @${handle}`);
      return null;
    }
    const result = await createActorForProfile(profile.id);
    if (!result.success) {
      console.log(`  [skip] @${handle}: ${result.error}`);
      return null;
    }
    return result.actor.id;
  }

  console.log('Actors');
  const meActorId = await actorFor(HANDLE);
  if (!meActorId) {
    console.error(`\nCould not set up @${HANDLE}. Nothing else to do.`);
    process.exit(1);
  }

  const panaActorIds = new Map<string, string>();
  for (const handle of [...PANAS, ...FOLLOWERS_ONLY]) {
    const id = await actorFor(handle);
    if (id) panaActorIds.set(handle, id);
  }
  line('ready', panaActorIds.size + 1);

  console.log('\nPanas (mutual follows)');
  let mutual = 0;
  for (const handle of PANAS) {
    const theirs = panaActorIds.get(handle);
    if (!theirs) continue;
    const out = await createFollow(meActorId, theirs);
    const back = await createFollow(theirs, meActorId);
    if (out.success && back.success) mutual++;
    else {
      const reason = !out.success ? out.error : !back.success ? back.error : '';
      console.log(`  [skip] @${handle}: ${reason}`);
    }
  }
  line('mutual', mutual);

  console.log('\nFollowers (one-way)');
  let oneWay = 0;
  for (const handle of FOLLOWERS_ONLY) {
    const theirs = panaActorIds.get(handle);
    if (!theirs) continue;
    const back = await createFollow(theirs, meActorId);
    if (back.success) oneWay++;
    else console.log(`  [skip] @${handle}: ${back.error}`);
  }
  line('added', oneWay);

  console.log('\nPosts');
  // Re-running should not stack up duplicates, so only post to an empty outbox.
  const existing = await db.query.socialStatuses.findFirst({
    where: eq(schema.socialStatuses.actorId, meActorId),
  });

  let posted = 0;
  if (existing) {
    console.log(`  [skip] @${HANDLE} already has posts`);
  } else {
    for (const content of OWN_POSTS) {
      const result = await createStatus(
        meActorId,
        content,
        undefined,
        undefined,
        'public'
      );
      if (result.success) posted++;
      else console.log(`  [skip] ${result.error}`);
    }
  }

  for (const [handle, content] of Object.entries(OTHERS_POSTS)) {
    const theirs = panaActorIds.get(handle);
    if (!theirs) continue;
    const had = await db.query.socialStatuses.findFirst({
      where: eq(schema.socialStatuses.actorId, theirs),
    });
    if (had) continue;
    const result = await createStatus(
      theirs,
      content,
      undefined,
      undefined,
      'public'
    );
    if (result.success) posted++;
  }
  line('written', posted);

  const baseUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  console.log('\n[ok] Test account ready\n');
  console.log('Sign in with:');
  console.log(`  npx tsx scripts/create-signin-link.ts ${HANDLE}@example.test`);
  console.log('\nThen visit:');
  console.log(`  ${baseUrl}/p/${HANDLE}`);
  console.log('');

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

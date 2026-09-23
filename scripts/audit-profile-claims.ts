#!/usr/bin/env npx tsx
/**
 * Audit profile claim integrity. READ ONLY — this script never writes.
 *
 * Answers two questions that the fix in
 * app/api/oauth/complete-verification/route.ts raises but cannot answer:
 *
 *   A. How many business listings were captured as somebody's personal
 *      identity? These are the victims of the missing notBusinessListing
 *      guard, and each one silently bars that person from running a second
 *      listing (profiles.userId is UNIQUE).
 *
 *   B. How many profiles hold a userId with no matching profile_owners row?
 *      lib/schema/index.ts states the invariant: "Every profile with a userId
 *      was backfilled with an 'owner' row, so permission checks can read this
 *      table alone."
 *
 * Category A is unambiguous. No legitimate path sets userId on an intake
 * listing: app/api/listings/claim/verify/route.ts grants ownership through
 * addProfileOwner and deliberately leaves userId NULL. So a business_intake
 * row with a userId can only have come from an auto-claim that lacked the
 * guard.
 *
 * Category B is NOT a bug count on its own. Read the caveat it prints.
 *
 * Usage:
 *   POSTGRES_URL=... npx tsx scripts/audit-profile-claims.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from '../lib/schema';

// A script whose static imports fail to resolve exits 0 under `tsx -e` with no
// output at all, which is indistinguishable from a clean run reporting nothing.
// Assert on these markers, never on the exit code.
console.log('AUDIT:start');

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client, { schema });

  try {
    const [totals] = (await db.execute(sql`
      SELECT
        count(*)::int AS profiles_total,
        count(*) FILTER (WHERE user_id IS NOT NULL)::int AS with_user_id,
        count(*) FILTER (
          WHERE status->>'source' = 'business_intake'
        )::int AS intake_listings
      FROM profiles
    `)) as unknown as {
      profiles_total: number;
      with_user_id: number;
      intake_listings: number;
    }[];

    console.log('\n=== context ===');
    console.log(`  profiles total              ${totals.profiles_total}`);
    console.log(`  ...with a userId            ${totals.with_user_id}`);
    console.log(`  ...from business intake     ${totals.intake_listings}`);

    // --- Category A: business listings captured as personal identity --------
    const captured = (await db.execute(sql`
      SELECT p.id, p.name, p.email, p.user_id, p.screenname
      FROM profiles p
      WHERE p.status->>'source' = 'business_intake'
        AND p.user_id IS NOT NULL
      ORDER BY p.id
    `)) as unknown as {
      id: string;
      name: string | null;
      email: string | null;
      user_id: string;
      screenname: string | null;
    }[];

    console.log('\n=== A. business listings captured as identity ===');
    console.log(`  count: ${captured.length}`);
    if (captured.length === 0) {
      console.log('  none — the missing guard never fired on this database.');
    } else {
      console.log(
        '  Each row is a person who cannot list a second business until'
      );
      console.log(
        '  their userId is cleared and an owner row put in its place.'
      );
      for (const r of captured) {
        console.log(
          `    ${r.id}  ${r.name ?? '(no name)'}  <${r.email ?? '?'}>  user=${r.user_id}`
        );
      }
    }

    // --- A2: intake listings that predate the source marker ----------------
    // app/api/listings/intake/route.ts shipped at 7b4afca 00:13, the
    // BUSINESS_INTAKE_SOURCE marker at dfbb83d 00:28 the same night. Any row
    // written in that 15-minute window carries intake's other status fields
    // but no source, which makes it invisible to query A *and* invisible to
    // notBusinessListing. Neither commit has reached main, so this should be
    // empty everywhere — it is here so that "0" is measured rather than
    // assumed.
    const unmarked = (await db.execute(sql`
      SELECT p.id, p.name, p.email, p.user_id
      FROM profiles p
      WHERE p.status ? 'access'
        AND p.status ? 'submitted'
        AND p.status->>'source' IS NULL
      ORDER BY p.id
    `)) as unknown as {
      id: string;
      name: string | null;
      email: string | null;
      user_id: string | null;
    }[];

    console.log('\n=== A2. intake-shaped rows with no source marker ===');
    console.log(`  count: ${unmarked.length}`);
    if (unmarked.length === 0) {
      console.log('  none — no rows from the pre-marker window.');
    } else {
      console.log(
        '  These are unprotected by notBusinessListing. Backfill status.source'
      );
      console.log(`  = 'business_intake' on each before relying on the guard.`);
      for (const r of unmarked) {
        console.log(
          `    ${r.id}  ${r.name ?? '(no name)'}  <${r.email ?? '?'}>  user=${r.user_id ?? 'NULL'}`
        );
      }
    }

    // --- Category B: identity link with no ownership row --------------------
    const orphaned = (await db.execute(sql`
      SELECT p.id, p.name, p.email, p.user_id
      FROM profiles p
      LEFT JOIN profile_owners po
        ON po.profile_id = p.id AND po.user_id = p.user_id
      WHERE p.user_id IS NOT NULL
        AND po.profile_id IS NULL
      ORDER BY p.id
    `)) as unknown as {
      id: string;
      name: string | null;
      email: string | null;
      user_id: string;
    }[];

    console.log('\n=== B. userId set but no profile_owners row ===');
    console.log(`  count: ${orphaned.length}`);
    console.log(
      '  CAVEAT: on a dev database this number is usually an artifact.'
    );
    console.log(
      '  The 0035 backfill runs as a migration; if migrations ran against an'
    );
    console.log(
      '  empty database and the seed created profiles afterwards, the backfill'
    );
    console.log(
      '  could never have seen them. A high count here on localhost means'
    );
    console.log('  nothing. On production it is real.');
    console.log(
      '  Nobody is locked out either way: canAdministerProfile accepts either'
    );
    console.log('  link by design.');
    if (orphaned.length > 0 && orphaned.length <= 25) {
      for (const r of orphaned) {
        console.log(
          `    ${r.id}  ${r.name ?? '(no name)'}  <${r.email ?? '?'}>`
        );
      }
    } else if (orphaned.length > 25) {
      console.log(`    (${orphaned.length} rows, listing first 25)`);
      for (const r of orphaned.slice(0, 25)) {
        console.log(
          `    ${r.id}  ${r.name ?? '(no name)'}  <${r.email ?? '?'}>`
        );
      }
    }

    console.log('\n=== verdict ===');
    if (captured.length === 0 && unmarked.length === 0) {
      console.log('  A: clean. The guard is now preventive, not remedial.');
    } else {
      if (captured.length > 0) {
        console.log(
          `  A: ${captured.length} listing(s) need manual repair — clear userId,`
        );
        console.log('     add a profile_owners row for the same user.');
      }
      if (unmarked.length > 0) {
        console.log(
          `  A2: ${unmarked.length} row(s) need status.source backfilled before`
        );
        console.log('      the guard can protect them.');
      }
    }
  } finally {
    await client.end();
  }
}

main()
  .then(() => console.log('\nAUDIT:done'))
  .catch((err) => {
    console.error('AUDIT:failed', err);
    process.exit(1);
  });

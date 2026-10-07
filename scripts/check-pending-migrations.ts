#!/usr/bin/env npx tsx
/**
 * Pending migration check.
 *
 * Compares `drizzle/meta/_journal.json` against the `drizzle.__drizzle_migrations`
 * ledger in the target database and fails if the database is behind.
 *
 * This exists because a successful deploy has never implied a migrated schema.
 * Migrations are applied by a command that lived only in the Cloudflare
 * dashboard, so nothing in this repo could enforce it or notice when it stopped
 * working. It stopped working at least twice:
 *
 *   - 2026-09-25  0048_recommendation_lists merged and deployed green; its
 *                 tables were still absent two days later (#237).
 *   - 2026-10-07  0053_profile_pending_owner_email and 0054_directory_account_type
 *                 were unapplied in production. Every signed-in request to
 *                 /api/profile/switch threw on the missing column and the
 *                 account menu rendered empty; directory queries threw on the
 *                 renamed account_type enum value.
 *
 * Both were found by a user noticing broken UI. This script is the cheap check
 * that should have found them instead -- run after `drizzle-kit migrate` as
 * proof it did something, and on a schedule to catch drift.
 *
 * Matching is by `when` (the journal's millisecond timestamp), which is exactly
 * what drizzle-orm's migrator writes to `created_at`. Hash is not compared: an
 * edited migration file that has already been applied is a separate problem and
 * flagging it here would block deploys on a condition this cannot fix.
 *
 * Exit codes:
 *   0  database is up to date
 *   1  migrations are pending, or the ledger/database is unreachable
 *
 * Usage: npx tsx scripts/check-pending-migrations.ts
 */

import { readFileSync } from 'fs';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

// Resolved from the working directory, like every other script here (dotenv is
// loaded the same way). Run from the repo root.
const journalPath = 'drizzle/meta/_journal.json';
const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
  entries: JournalEntry[];
};

/** Render a connection string as user@host, never echoing the password. */
function describeTarget(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    return `${url.username}@${url.host}`;
  } catch {
    return '(unparseable connection string)';
  }
}

async function main(): Promise<void> {
  const connectionString =
    process.env.POSTGRES_DIRECT_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('Error: POSTGRES_DIRECT_URL or POSTGRES_URL is required');
    process.exit(1);
  }

  // Say which database this is reading before reading it. Tonight's incident
  // involved two live Supabase projects in different regions, and the stale one
  // answered every query happily -- naming the target is what distinguishes
  // "up to date" from "up to date somewhere else".
  console.log(
    `Checking migrations against ${describeTarget(connectionString)}`
  );

  const client = postgres(connectionString, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });

  try {
    let applied: { created_at: string | number | null }[];
    try {
      applied = await client<{ created_at: string | number | null }[]>`
        select created_at from drizzle.__drizzle_migrations
      `;
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      const message = error instanceof Error ? error.message : String(error);

      // 42P01 = undefined_table. That is a pending state (drizzle-kit migrate
      // has never run here), not an infrastructure fault. Anything else --
      // auth, DNS, TLS, permissions -- is a broken configuration, and saying
      // so plainly matters: a wrong-credentials failure reported as "no
      // migrations applied" would invite someone to migrate a database they
      // cannot actually reach.
      if (code === '42P01') {
        console.error('\nERROR: drizzle.__drizzle_migrations does not exist.');
        console.error(
          `  No migration has ever been applied to ${describeTarget(connectionString)}.`
        );
        console.error(
          `  All ${journal.entries.length} journal entries are pending.`
        );
        console.error('\n  Apply them with: npx drizzle-kit migrate');
        process.exit(1);
      }

      console.error(
        `\nERROR: could not reach the migration ledger: ${message}`
      );
      if (code) console.error(`  Postgres error code: ${code}`);
      console.error(
        `  Target was ${describeTarget(connectionString)} -- check POSTGRES_DIRECT_URL.`
      );
      process.exit(1);
    }

    const appliedWhen = new Set(
      applied
        .map((row) => row.created_at)
        .filter((value): value is string | number => value !== null)
        .map((value) => String(value))
    );

    const pending = journal.entries
      .filter((entry) => !appliedWhen.has(String(entry.when)))
      .sort((a, b) => a.idx - b.idx);

    console.log(
      `  journal entries: ${journal.entries.length}   applied: ${applied.length}`
    );

    if (pending.length > 0) {
      console.error(`\nERROR: ${pending.length} migration(s) pending:`);
      for (const entry of pending) console.error(`  ${entry.tag}`);
      console.error('\n  Apply them with: npx drizzle-kit migrate');
      process.exit(1);
    }

    console.log('Database is up to date.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

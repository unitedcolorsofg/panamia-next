#!/usr/bin/env npx tsx
/**
 * Reset Test Database
 *
 * Truncates all tables in the test database to ensure a clean slate before CI tests.
 * This script is idempotent and safe to run multiple times.
 *
 * Usage:
 *   POSTGRES_URL=... npx tsx scripts/reset-test-db.ts
 *
 * WARNING: This will DELETE ALL DATA in the connected database!
 * Only use with a dedicated test database, never production.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function resetDatabase() {
  if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  // Safety check: warn if URL looks like production
  const url = process.env.POSTGRES_URL.toLowerCase();
  if (url.includes('prod') || url.includes('main') || url.includes('live')) {
    console.error(
      'Error: Database URL contains "prod", "main", or "live".\n' +
        'This script should only be run against a test database.\n' +
        'If this is intentional, rename your database to not include these words.'
    );
    process.exit(1);
  }

  console.log('Connecting to database...');
  const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    // Get all table names from the public schema
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename NOT LIKE '_prisma%'
    `;

    if (tables.length === 0) {
      console.log('No tables found to truncate.');
      return;
    }

    console.log(`Found ${tables.length} tables to truncate:`);
    tables.forEach((t) => console.log(`  - ${t.tablename}`));

    // Disable foreign key checks and truncate all tables
    console.log('\nTruncating tables...');
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        -- Disable triggers temporarily
        SET session_replication_role = replica;

        -- Truncate all tables
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%') LOOP
          EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" RESTART IDENTITY CASCADE';
        END LOOP;

        -- Re-enable triggers
        SET session_replication_role = DEFAULT;
      END $$;
    `);

    console.log('All tables truncated successfully.');
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();

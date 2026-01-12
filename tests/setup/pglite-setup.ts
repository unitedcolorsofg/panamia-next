// tests/setup/pglite-setup.ts
/**
 * PGLite Setup for Playwright Tests
 *
 * Initializes an in-memory PostgreSQL database for testing using PGLite.
 * Migrations are applied manually since Prisma Migrate doesn't support PGLite.
 *
 * Usage:
 *   Set USE_MEMORY_POSTGRES=true in CI environment
 *
 * @see docs/DATABASE-ROADMAP.md for testing infrastructure documentation
 */

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

let pgliteInstance: PGlite | null = null;

/**
 * Initialize PGLite and apply all Prisma migrations.
 *
 * @returns The PGLite instance for direct SQL access if needed
 */
export async function setupPGLite(): Promise<PGlite> {
  if (pgliteInstance) {
    return pgliteInstance;
  }

  console.log('🧪 Initializing PGLite for tests...');
  pgliteInstance = new PGlite();

  const migrationsDir = join(process.cwd(), 'prisma', 'migrations');

  if (!existsSync(migrationsDir)) {
    console.log('  No migrations directory found, skipping migration setup');
    return pgliteInstance;
  }

  // Get all migration directories (format: YYYYMMDDHHMMSS_name)
  const migrations = readdirSync(migrationsDir)
    .filter((dir) => dir.match(/^\d{14}_/))
    .sort();

  if (migrations.length === 0) {
    console.log('  No migrations found');
    return pgliteInstance;
  }

  console.log(`  Found ${migrations.length} migration(s)`);

  for (const migration of migrations) {
    const sqlPath = join(migrationsDir, migration, 'migration.sql');

    if (!existsSync(sqlPath)) {
      console.log(`  Skipping ${migration} (no migration.sql)`);
      continue;
    }

    try {
      const sql = readFileSync(sqlPath, 'utf-8');

      // Remove comments and execute the SQL
      // PGLite can handle multi-statement SQL directly
      await pgliteInstance.exec(sql);
      console.log(`  ✓ Applied: ${migration}`);
    } catch (error) {
      console.error(`  ✗ Failed: ${migration}`);
      console.error(error);
      throw error;
    }
  }

  console.log('🧪 PGLite initialized successfully');
  return pgliteInstance;
}

/**
 * Close the PGLite instance and clean up resources.
 */
export async function teardownPGLite(): Promise<void> {
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
    console.log('🧪 PGLite instance closed');
  }
}

/**
 * Truncate all tables for test isolation.
 * Call this in beforeEach to ensure clean state between tests.
 */
export async function truncateTables(): Promise<void> {
  if (!pgliteInstance) {
    throw new Error('PGLite not initialized. Call setupPGLite() first.');
  }

  // Disable FK checks, truncate, re-enable
  await pgliteInstance.exec(`
    TRUNCATE TABLE verification_tokens CASCADE;
    TRUNCATE TABLE sessions CASCADE;
    TRUNCATE TABLE accounts CASCADE;
    TRUNCATE TABLE users CASCADE;
  `);
}

/**
 * Get the raw PGLite instance for direct SQL queries.
 * Useful for test assertions or custom setup.
 */
export function getPGLiteInstance(): PGlite | null {
  return pgliteInstance;
}

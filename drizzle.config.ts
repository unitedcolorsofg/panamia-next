/**
 * Drizzle config.
 *
 * IMPORTANT — DO NOT RUN `drizzle-kit generate` IN THIS PROJECT.
 *
 * Migrations under `drizzle/*.sql` are hand-written (see drizzle/TEMPLATE.sql).
 * The drizzle-kit snapshot in `drizzle/meta/` is intentionally stuck at 0000
 * and is NOT kept in sync with the schema. Running `drizzle-kit generate` will
 * diff schema.ts against that stale 0000 snapshot and emit a huge bogus
 * migration that re-creates tables that already exist in production.
 *
 * Why hand-written: tight control over transactions, data backfills, rollback
 * blocks, and comments — all things drizzle-kit's generator strips out.
 *
 * This config IS still used for:
 *   - `drizzle-kit migrate` (applies hand-written SQL files in order)
 *   - `drizzle-kit studio` (read-only DB inspector)
 *
 * The `yarn db:generate` script has been replaced with a guardrail that
 * prints this notice and exits 1.
 */
import { existsSync } from 'fs';
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit only loads .env, not .env.local — load it explicitly for local dev
if (existsSync('.env.local')) loadDotenv({ path: '.env.local' });

export default defineConfig({
  schema: './lib/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Prefer the direct (unpooled) URL for migrations; fall back to POSTGRES_URL
    // if POSTGRES_DIRECT_URL is not set (e.g. in Cloudflare's build environment).
    url: (process.env.POSTGRES_DIRECT_URL ?? process.env.POSTGRES_URL)!,
  },
});

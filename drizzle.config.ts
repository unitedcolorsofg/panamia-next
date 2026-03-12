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

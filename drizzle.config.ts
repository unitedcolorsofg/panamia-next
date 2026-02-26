import { defineConfig } from 'drizzle-kit';

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

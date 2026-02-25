import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations use the direct (unpooled) connection, not the pooled URL
    url: process.env.POSTGRES_DIRECT_URL!,
  },
});

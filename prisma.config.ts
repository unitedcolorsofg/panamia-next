// prisma.config.ts
/**
 * Prisma 7 Configuration
 *
 * Configures the Prisma CLI for database migrations and schema management.
 * The datasource URL is configured here rather than in schema.prisma.
 *
 * @see https://www.prisma.io/docs/orm/reference/prisma-config-reference
 * @see docs/DATABASE-ROADMAP.md for polyglot persistence architecture
 */

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Schema file location
  schema: 'prisma/schema.prisma',

  // Migration output directory
  migrations: {
    path: 'prisma/migrations',
  },

  // Database connection for Prisma CLI (migrations, db push, etc.)
  // Note: PrismaClient uses adapter-based connections configured in lib/prisma.ts
  datasource: {
    url: process.env.POSTGRES_URL || 'postgresql://localhost:5432/panamia_dev',
  },
});

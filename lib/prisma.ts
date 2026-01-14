// lib/prisma.ts
/**
 * Prisma Client Singleton
 *
 * Provides a singleton PrismaClient instance with support for:
 * - Production: Real PostgreSQL via @prisma/adapter-pg
 * - Testing: In-memory PostgreSQL via PGLite (USE_MEMORY_POSTGRES=true)
 *
 * Prisma 7 requires a driver adapter for all connections.
 *
 * The singleton pattern prevents connection exhaustion during development
 * hot-reloads, similar to lib/mongodb.ts and lib/connectdb.ts patterns.
 *
 * @see docs/DATABASE-ROADMAP.md for polyglot persistence architecture
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = global as typeof globalThis & {
  prisma?: PrismaClient;
  prismaSyncClient?: PrismaClient;
  _pgliteInstance?: any;
  _pgAdapter?: PrismaPg;
};

/**
 * Creates a PrismaClient instance with appropriate configuration
 * for the current environment.
 */
async function createPrismaClient(): Promise<PrismaClient> {
  // Use PGLite for in-memory testing
  if (process.env.USE_MEMORY_POSTGRES === 'true') {
    const { PGlite } = await import('@electric-sql/pglite');
    const { PrismaPGlite } = await import('pglite-prisma-adapter');

    if (!globalForPrisma._pgliteInstance) {
      console.log('🧪 Starting PGLite in-memory PostgreSQL...');
      // In-memory mode - no persistence path
      globalForPrisma._pgliteInstance = new PGlite();
    }

    const adapter = new PrismaPGlite(globalForPrisma._pgliteInstance);
    return new PrismaClient({ adapter } as any);
  }

  // Production: Use real PostgreSQL with @prisma/adapter-pg
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      'Please add POSTGRES_URL to .env.local or set USE_MEMORY_POSTGRES=true'
    );
  }

  const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL });
  return new PrismaClient({ adapter });
}

/**
 * Gets the singleton PrismaClient instance.
 *
 * In development, the client is cached globally to survive hot-reloads.
 * In production, a new client is created for each cold start.
 *
 * @example
 * ```typescript
 * import { getPrisma } from '@/lib/prisma';
 *
 * export async function getUser(id: string) {
 *   const prisma = await getPrisma();
 *   return prisma.user.findUnique({ where: { id } });
 * }
 * ```
 */
export async function getPrisma(): Promise<PrismaClient> {
  if (process.env.NODE_ENV !== 'production') {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = await createPrismaClient();
    }
    return globalForPrisma.prisma;
  }

  // Production: Create client (serverless functions handle their own lifecycle)
  return createPrismaClient();
}

/**
 * Gets a synchronous PrismaClient instance for use in contexts
 * where async initialization is not possible (e.g., NextAuth adapter).
 *
 * Uses @prisma/adapter-pg for real PostgreSQL connections.
 *
 * NOTE: This does NOT support PGLite (USE_MEMORY_POSTGRES) as that
 * requires async initialization. Use getPrisma() for testing contexts.
 *
 * @throws Error if POSTGRES_URL is not set
 */
export function getPrismaSync(): PrismaClient {
  // Return cached instance if available
  if (globalForPrisma.prismaSyncClient) {
    return globalForPrisma.prismaSyncClient;
  }

  // Prisma 7 requires a driver adapter. If no POSTGRES_URL, use a placeholder
  // that will fail at query time rather than construction time.
  const connectionString =
    process.env.POSTGRES_URL ||
    'postgresql://build-placeholder:placeholder@localhost:5432/placeholder';

  if (!process.env.POSTGRES_URL) {
    if (process.env.USE_MEMORY_POSTGRES === 'true') {
      console.warn(
        '⚠️  getPrismaSync() called with USE_MEMORY_POSTGRES=true but no POSTGRES_URL. ' +
          'Queries will fail. For full app testing, use POSTGRES_URL instead.'
      );
    } else if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '⚠️  POSTGRES_URL not set. Using placeholder - queries will fail at runtime.'
      );
    }
  }

  // Create PG adapter and client
  if (!globalForPrisma._pgAdapter) {
    globalForPrisma._pgAdapter = new PrismaPg({ connectionString });
  }

  globalForPrisma.prismaSyncClient = new PrismaClient({
    adapter: globalForPrisma._pgAdapter,
  });
  return globalForPrisma.prismaSyncClient;
}

/**
 * Disconnects the PrismaClient.
 * Useful for cleanup in tests or graceful shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
  if (globalForPrisma.prismaSyncClient) {
    await globalForPrisma.prismaSyncClient.$disconnect();
    globalForPrisma.prismaSyncClient = undefined;
  }
  if (globalForPrisma._pgliteInstance) {
    await globalForPrisma._pgliteInstance.close();
    globalForPrisma._pgliteInstance = undefined;
  }
  globalForPrisma._pgAdapter = undefined;
}

export default getPrisma;

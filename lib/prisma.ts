// lib/prisma.ts
/**
 * Prisma Client Singleton
 *
 * Provides a singleton PrismaClient instance with support for:
 * - Production: Real PostgreSQL via POSTGRES_URL
 * - Testing: In-memory PostgreSQL via PGLite (USE_MEMORY_POSTGRES=true)
 *
 * The singleton pattern prevents connection exhaustion during development
 * hot-reloads, similar to lib/mongodb.ts and lib/connectdb.ts patterns.
 *
 * @see docs/DATABASE-ROADMAP.md for polyglot persistence architecture
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as typeof globalThis & {
  prisma?: PrismaClient;
  prismaSyncClient?: PrismaClient;
  _pgliteInstance?: any;
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

  // Production: Use real PostgreSQL
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      'Please add POSTGRES_URL to .env.local or set USE_MEMORY_POSTGRES=true'
    );
  }

  return new PrismaClient();
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

  if (!process.env.POSTGRES_URL) {
    throw new Error(
      'POSTGRES_URL is required. Add it to .env.local for development ' +
        'or set USE_MEMORY_POSTGRES=true for testing.'
    );
  }

  // Create and cache a new client
  globalForPrisma.prismaSyncClient = new PrismaClient();
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
}

export default getPrisma;

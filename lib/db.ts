/**
 * Drizzle Database Client
 *
 * getDb(env) must be called from the Cloudflare Worker entry point (worker/index.ts)
 * at the start of every request to prime the per-connection-string cache. All other
 * call sites call getDb() without arguments and receive the already-cached instance.
 *
 * - Production (CF Workers): env.HYPERDRIVE.connectionString via Hyperdrive, max: 1
 * - Local dev (Node.js / vinext dev): process.env.POSTGRES_URL, default pool
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export interface CloudflareEnv {
  HYPERDRIVE?: { connectionString: string };
}

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

// Cache instances by connection string.
// In production a single Hyperdrive URL is reused for the lifetime of the isolate.
const instances = new Map<string, DbInstance>();

export function getDb(env?: CloudflareEnv): DbInstance {
  const hyperdrive = env?.HYPERDRIVE;
  const connectionString =
    hyperdrive?.connectionString ?? process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      'Database: no connection string. ' +
        'Provide the HYPERDRIVE binding (production) or set POSTGRES_URL (local dev).'
    );
  }

  const cached = instances.get(connectionString);
  if (cached) return cached;

  // max: 1 is required with Hyperdrive — Workers have no persistent connection pool.
  const client = postgres(connectionString, hyperdrive ? { max: 1 } : {});
  const instance = drizzle(client, { schema });
  instances.set(connectionString, instance);
  return instance;
}

// Backward-compatible export for the 100+ files that do `import { db } from '@/lib/db'`.
// Every property access is forwarded lazily to getDb(), which returns the cached instance
// that was primed by the worker entry point before the request reached application code.
export const db: DbInstance = new Proxy({} as DbInstance, {
  get(_, prop: string | symbol) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

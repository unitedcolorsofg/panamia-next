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

// Holds the Hyperdrive-backed instance primed by the Worker entry (worker/index.ts).
// getDb() without args returns this when available, so app code always uses Hyperdrive
// rather than creating a parallel direct-to-Supabase connection via process.env.POSTGRES_URL.
let hyperdriveInstance: DbInstance | null = null;

export function getDb(env?: CloudflareEnv): DbInstance {
  const hyperdrive = env?.HYPERDRIVE;

  if (hyperdrive) {
    // Priming call from Worker entry — create (or reuse) the Hyperdrive-backed instance.
    const connectionString = hyperdrive.connectionString;
    const cached = instances.get(connectionString);
    if (cached) {
      hyperdriveInstance = cached;
      return cached;
    }
    // max: 1 — Workers have no persistent connection pool.
    // prepare: false — Hyperdrive only supports the simple query protocol,
    //   not the extended protocol (prepared statements) that postgres.js uses by default.
    //   https://developers.cloudflare.com/hyperdrive/examples/postgres-js/
    // debug — log every query + surface the underlying postgres error code when a query fails.
    const client = postgres(connectionString, {
      max: 1,
      prepare: false,
      debug: (connection, query, params) => {
        const short = (typeof query === 'string' ? query : String(query)).slice(
          0,
          80
        );
        console.log('[db]', short, params?.length ? `p[${params.length}]` : '');
      },
    });
    const instance = drizzle(client, { schema });
    instances.set(connectionString, instance);
    hyperdriveInstance = instance;
    return instance;
  }

  // No env provided (app code, auth module, API routes, etc.).
  // Prefer the Hyperdrive instance primed by the Worker entry for this isolate.
  if (hyperdriveInstance) return hyperdriveInstance;

  // Fallback: local dev (Node.js / vinext dev) where HYPERDRIVE binding is absent.
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      'Database: no connection string. ' +
        'Provide the HYPERDRIVE binding (production) or set POSTGRES_URL (local dev).'
    );
  }
  const cached = instances.get(connectionString);
  if (cached) return cached;
  const client = postgres(connectionString);
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

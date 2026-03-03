/**
 * Drizzle Database Client
 *
 * getDb(env) must be called from the Cloudflare Worker entry point (worker/index.ts)
 * at the start of every request. In production a fresh postgres.js client is created
 * on each call — Hyperdrive manages the actual Supabase connection pool, so a new
 * local socket to Hyperdrive is cheap and avoids stale-connection failures.
 *
 * - Production (CF Workers): env.HYPERDRIVE.connectionString via Hyperdrive, max: 1
 * - Local dev (Node.js / vinext dev): process.env.POSTGRES_URL, cached per URL
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export interface CloudflareEnv {
  HYPERDRIVE?: { connectionString: string };
}

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

// Cache for local-dev connections only (keyed by connection string).
// NOT used for Hyperdrive — a fresh client is created per request to avoid stale sockets.
const localInstances = new Map<string, DbInstance>();

// Holds the per-request Hyperdrive-backed instance primed by the Worker entry.
// A fresh instance is set on every request so app code (getDb() without args) always
// uses the current request's client rather than a stale one from a previous request.
let hyperdriveInstance: DbInstance | null = null;

export function getDb(env?: CloudflareEnv): DbInstance {
  const hyperdrive = env?.HYPERDRIVE;

  if (hyperdrive) {
    // Always create a fresh postgres.js client for each Worker request.
    // Hyperdrive manages the actual connection pool to Supabase; a new client here is just
    // a new local socket to Hyperdrive — cheap. Reusing a cached client across requests
    // leads to stale-connection failures once Hyperdrive silently closes an idle socket.
    //
    // max: 1 — Workers have no persistent connection pool.
    // prepare: false — Hyperdrive only supports the simple query protocol,
    //   not the extended protocol (prepared statements) that postgres.js uses by default.
    //   https://developers.cloudflare.com/hyperdrive/examples/postgres-js/
    // debug — log every query so failures are visible in wrangler tail.
    const client = postgres(hyperdrive.connectionString, {
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
    hyperdriveInstance = instance;
    return instance;
  }

  // No env provided (app code, auth module, API routes, etc.).
  // Prefer the Hyperdrive instance primed by the Worker entry for this request.
  if (hyperdriveInstance) return hyperdriveInstance;

  // Fallback: local dev (Node.js / vinext dev) where HYPERDRIVE binding is absent.
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      'Database: no connection string. ' +
        'Provide the HYPERDRIVE binding (production) or set POSTGRES_URL (local dev).'
    );
  }
  const cached = localInstances.get(connectionString);
  if (cached) return cached;
  const client = postgres(connectionString);
  const instance = drizzle(client, { schema });
  localInstances.set(connectionString, instance);
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

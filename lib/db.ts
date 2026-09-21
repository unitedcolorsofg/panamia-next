/**
 * Drizzle Database Client
 *
 * getDb(env) must be called from the Cloudflare Worker entry point (worker/index.ts)
 * at the start of every request. In production a fresh postgres.js client is created
 * on each call — Hyperdrive manages the actual Supabase connection pool, so a new
 * local socket to Hyperdrive is cheap and avoids stale-connection failures.
 *
 * - Production (CF Workers): env.HYPERDRIVE.connectionString via Hyperdrive, max: 1
 * - Local dev (vinext dev): env.POSTGRES_URL secret binding (from .dev.vars), cached
 * - Local dev (plain Node.js): process.env.POSTGRES_URL, cached
 *
 * Priority: env.POSTGRES_URL > HYPERDRIVE > process.env.POSTGRES_URL
 *
 * We check env.POSTGRES_URL BEFORE HYPERDRIVE because in local dev miniflare rewrites
 * env.HYPERDRIVE.connectionString to use 127.0.0.1:<proxy_port> (not 'localhost'), so
 * a simple 'includes localhost' guard can't reliably detect the placeholder Hyperdrive.
 * In production env.POSTGRES_URL is never set, so Hyperdrive is always used there.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export interface CloudflareEnv {
  HYPERDRIVE?: { connectionString: string };
  // Available in local dev (vinext dev / wrangler dev) as a wrangler secret text binding,
  // populated from .dev.vars via wrangler's automatic secret loading.
  POSTGRES_URL?: string;
}

export type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

// Cache for plain Node.js dev server (server.js) only — process.env.POSTGRES_URL connections
// don't have the workerd cross-request I/O restriction so sharing is safe there.
const nodeDevInstance: { instance: DbInstance | null } = { instance: null };

// Request-scoped storage for the DB instance primed by the Worker entry point.
//
// A module-scope variable CANNOT be used for this: workerd runs multiple requests
// concurrently in the same isolate, so every in-flight request would overwrite it and
// handlers would read another request's client. Because postgres.js sockets are bound to
// the request that created them, that produces "Cannot perform I/O on behalf of a
// different request" and the request fails. AsyncLocalStorage keeps each request on its
// own client across await boundaries.
const requestDbStore = new AsyncLocalStorage<DbInstance>();

/**
 * Run `fn` with `instance` as the request-scoped DB client.
 * Called by the Worker entry point so the `db` proxy resolves per request.
 */
export function runWithDb<T>(instance: DbInstance, fn: () => T): T {
  return requestDbStore.run(instance, fn);
}

// Fallback for contexts with no AsyncLocalStorage scope (e.g. scripts, tests).
// Never relied on for concurrent request handling — see requestDbStore above.
let cachedInstance: DbInstance | null = null;

export function getDb(env?: CloudflareEnv): DbInstance {
  // Local dev (vinext dev): env.POSTGRES_URL is set from .dev.vars.
  // Always create a fresh client per request — workerd prevents cross-request socket reuse.
  // (Sharing a postgres.js pool across requests causes "Cannot perform I/O on behalf of a
  // different request" because the pool's TCP sockets are bound to the creating request.)
  if (env?.POSTGRES_URL) {
    const client = postgres(env.POSTGRES_URL, { max: 1 });
    const instance = drizzle(client, { schema });
    cachedInstance = instance;
    return instance;
  }

  // Production: use Hyperdrive for the Supabase connection pool.
  if (env?.HYPERDRIVE) {
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
    const client = postgres(env.HYPERDRIVE.connectionString, {
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
    cachedInstance = instance;
    return instance;
  }

  // No env provided: called via the `db` proxy. Prefer this request's instance.
  const scoped = requestDbStore.getStore();
  if (scoped) return scoped;

  if (cachedInstance) return cachedInstance;

  // Plain Node.js dev server (server.js) — process.env.POSTGRES_URL is available and
  // sharing a connection pool across requests is safe outside workerd.
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      'Database: no connection string. ' +
        'Provide the HYPERDRIVE binding (production) or set POSTGRES_URL (local dev).'
    );
  }
  if (nodeDevInstance.instance) return nodeDevInstance.instance;
  const client = postgres(connectionString);
  const instance = drizzle(client, { schema });
  nodeDevInstance.instance = instance;
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

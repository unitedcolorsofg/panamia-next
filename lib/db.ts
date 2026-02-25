/**
 * Drizzle Database Client
 *
 * - In Cloudflare Workers: uses Hyperdrive connectionString for pooled TCP access
 * - In Node.js (local dev, CI): uses POSTGRES_URL directly
 *
 * postgres.js handles connection pooling internally; no manual pool config needed.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString =
  typeof (
    globalThis as unknown as { HYPERDRIVE?: { connectionString: string } }
  ).HYPERDRIVE !== 'undefined' &&
  (globalThis as unknown as { HYPERDRIVE?: { connectionString: string } })
    .HYPERDRIVE != null
    ? (globalThis as unknown as { HYPERDRIVE: { connectionString: string } })
        .HYPERDRIVE.connectionString
    : process.env.POSTGRES_URL!;

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

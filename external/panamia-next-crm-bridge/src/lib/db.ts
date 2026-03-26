/**
 * Drizzle client for the CRM worker.
 *
 * Uses the HYPERDRIVE binding in production (CF Workers).
 * Falls back to POSTGRES_URL for local wrangler dev.
 *
 * Same pattern as the main app's lib/db.ts.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export interface Env {
  HYPERDRIVE: Hyperdrive;
  GHL_API_KEY: string;
  GHL_LOCATION_ID: string;
  GHL_WEBHOOK_SECRET: string;
  STRIPE_WEBHOOK_SECRET: string;
  POSTGRES_URL?: string;
}

export function createDb(env: Env) {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      'No database connection string available (HYPERDRIVE or POSTGRES_URL required)'
    );
  }
  const client = postgres(connectionString, { max: 1 });
  return drizzle(client, { schema });
}

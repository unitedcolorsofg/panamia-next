/**
 * Inactive user sweep — daily at 3am (cron: "0 3 * * *")
 *
 * Finds profiles with a linked GHL contact where the user has had no session
 * activity in the past 30 days, and adds the "inactive-30d" tag to their GHL
 * contact. GHL automation reacts to this tag by firing a re-engagement sequence.
 *
 * Uses a raw SQL query to join against the sessions table (not in the worker
 * schema subset) to find session activity without loading all sessions into memory.
 *
 * Phase 4 — implemented.
 */

import { sql } from 'drizzle-orm';
import { Env, createDb } from '../lib/db';
import { GhlClient } from '../lib/ghl';

interface InactiveRow {
  profile_id: string;
  ghl_contact_id: string;
}

export async function runInactiveSweep(env: Env): Promise<void> {
  console.log('[inactive-sweep] starting');

  const ghl = new GhlClient(env.GHL_API_KEY);
  const db = createDb(env);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Find profiles with linked GHL contacts where the user has had no session
  // activity in the past 30 days (either no sessions at all, or all sessions
  // last updated before the threshold).
  const rows = await db.execute<InactiveRow>(sql`
    SELECT p.id AS profile_id, p.ghl_contact_id
    FROM profiles p
    JOIN users u ON u.id = p.user_id
    WHERE p.ghl_contact_id IS NOT NULL
      AND p.ghl_opted_out = false
      AND NOT EXISTS (
        SELECT 1
        FROM sessions s
        WHERE s.user_id = u.id
          AND s.updated_at > ${thirtyDaysAgo}
      )
  `);

  console.log(`[inactive-sweep] found ${rows.length} inactive contacts`);

  let tagged = 0;
  for (const row of rows) {
    try {
      await ghl.addTag(row.ghl_contact_id, 'inactive-30d');
      tagged++;
    } catch (err) {
      console.error(
        `[inactive-sweep] failed to tag profile ${row.profile_id}:`,
        err
      );
    }
  }

  console.log(`[inactive-sweep] done — tagged ${tagged}/${rows.length}`);
}

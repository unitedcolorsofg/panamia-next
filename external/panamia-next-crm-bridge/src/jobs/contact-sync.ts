/**
 * Contact sync — hourly (cron: "0 * * * *")
 *
 * Sweeps profiles updated in the past hour that have a linked GHL contact
 * and pushes field changes to GHL:
 *   - users.name        → GHL firstName / lastName
 *   - verification.panaVerified → GHL custom field panamia_verified
 *
 * Phase 4 — implemented.
 */

import { sql } from 'drizzle-orm';
import { and, eq, gte, isNotNull } from 'drizzle-orm';
import { Env, createDb } from '../lib/db';
import { GhlClient } from '../lib/ghl';
import { profiles, users } from '../lib/schema';

interface ProfileVerification {
  panaVerified?: boolean;
}

export async function runContactSync(env: Env): Promise<void> {
  console.log('[contact-sync] starting');

  const ghl = new GhlClient(env.GHL_API_KEY);
  const db = createDb(env);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const updatedProfiles = await db
    .select({
      profileId: profiles.id,
      ghlContactId: profiles.ghlContactId,
      verification: profiles.verification,
      userName: users.name,
    })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(
      and(
        isNotNull(profiles.ghlContactId),
        eq(profiles.ghlOptedOut, false),
        gte(profiles.updatedAt, oneHourAgo)
      )
    );

  console.log(
    `[contact-sync] found ${updatedProfiles.length} profiles to sync`
  );

  let synced = 0;
  let skipped = 0;
  for (const row of updatedProfiles) {
    try {
      const fields = buildContactUpdate(row.userName, row.verification);
      if (!fields) {
        skipped++;
        continue;
      }
      await ghl.updateContact(row.ghlContactId!, fields);
      synced++;
    } catch (err) {
      // Log and continue — one failed contact should not abort the batch
      console.error(`[contact-sync] failed for profile ${row.profileId}:`, err);
    }
  }

  console.log(
    `[contact-sync] done — synced ${synced}/${updatedProfiles.length} (skipped ${skipped})`
  );
}

/**
 * Build the GHL contact update payload from Panamia profile data.
 *
 * Safety rules (see docs/CRM-ROADMAP.md — "Worker-side GHL writes" risk review):
 *   - Never clobber GHL firstName/lastName with empty or stub Panamia names.
 *     A sales rep may have curated the GHL name; a user with a blank/"x"/"test"
 *     Panamia name should not overwrite that.
 *   - Only write panamia_verified=true (positive assertion). Writing "false"
 *     for every unverified user would clobber a manually set custom field on
 *     every hourly sync and can't be distinguished from "not yet synced."
 *   - Returns null if there is nothing safe to write → caller skips the update.
 */
export function buildContactUpdate(
  userName: string | null,
  verification: unknown
): { firstName?: string; lastName?: string; customField?: Record<string, string> } | null {
  const fields: {
    firstName?: string;
    lastName?: string;
    customField?: Record<string, string>;
  } = {};

  const trimmed = (userName ?? '').trim();
  // Require at least 2 chars and a non-stub value before touching name fields.
  const STUB_NAMES = new Set(['x', 'xx', 'test', 'na', 'n/a', 'none']);
  if (trimmed.length >= 2 && !STUB_NAMES.has(trimmed.toLowerCase())) {
    const [firstName, ...rest] = trimmed.split(/\s+/);
    fields.firstName = firstName;
    const lastName = rest.join(' ');
    if (lastName) fields.lastName = lastName;
  }

  const panaVerified = (verification as ProfileVerification | null)?.panaVerified;
  if (panaVerified === true) {
    fields.customField = { panamia_verified: 'true' };
  }

  // Nothing safe to write — caller should skip.
  if (!fields.firstName && !fields.customField) return null;
  return fields;
}

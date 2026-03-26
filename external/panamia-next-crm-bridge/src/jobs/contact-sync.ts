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
  for (const row of updatedProfiles) {
    try {
      const [firstName, ...rest] = (row.userName ?? '').split(' ');
      const lastName = rest.join(' ') || undefined;
      const verification = row.verification as ProfileVerification | null;

      await ghl.updateContact(row.ghlContactId!, {
        firstName: firstName || undefined,
        lastName,
        customField: {
          panamia_verified: String(verification?.panaVerified ?? false),
        },
      });
      synced++;
    } catch (err) {
      // Log and continue — one failed contact should not abort the batch
      console.error(`[contact-sync] failed for profile ${row.profileId}:`, err);
    }
  }

  console.log(
    `[contact-sync] done — synced ${synced}/${updatedProfiles.length}`
  );
}

/**
 * Contact sync — hourly (cron: "0 * * * *")
 *
 * Sweeps recently updated profiles and pushes field changes to GHL.
 * Only processes profiles with ghlContactId set and ghlOptedOut = false.
 *
 * Phase 4 — not yet implemented (stub).
 */

import { Env, createDb } from '../lib/db';
import { GhlClient } from '../lib/ghl';

export async function runContactSync(env: Env): Promise<void> {
  console.log('[contact-sync] starting');

  // TODO (Phase 4): implement
  // const db = createDb(env);
  // const ghl = new GhlClient(env.GHL_API_KEY);
  //
  // const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  //
  // const updatedProfiles = await db.query.profiles.findMany({
  //   where: (p, { and, isNotNull, eq, gte }) =>
  //     and(
  //       isNotNull(p.ghlContactId),
  //       eq(p.ghlOptedOut, false),
  //       gte(p.updatedAt, oneHourAgo),
  //     ),
  //   with: { user: true },
  // });
  //
  // for (const profile of updatedProfiles) {
  //   const [firstName, ...rest] = (profile.user.name ?? '').split(' ');
  //   const lastName = rest.join(' ') || undefined;
  //   await ghl.updateContact(profile.ghlContactId!, {
  //     firstName,
  //     lastName,
  //     customField: {
  //       panamia_verified: String(profile.panaVerified),
  //       panamia_last_login: profile.lastLoginAt?.toISOString() ?? '',
  //     },
  //   });
  // }
  //
  // console.log(`[contact-sync] synced ${updatedProfiles.length} profiles`);

  console.log('[contact-sync] stub — not yet implemented');
}

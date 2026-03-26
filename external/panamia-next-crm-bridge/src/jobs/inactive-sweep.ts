/**
 * Inactive user sweep — daily at 3am (cron: "0 3 * * *")
 *
 * Queries profiles where lastLoginAt > 30 days ago and ghlContactId is set
 * and ghlOptedOut is false. Adds the "inactive-30d" tag to each GHL contact.
 * GHL automation reacts to this tag by firing a re-engagement sequence.
 *
 * Phase 6 — not yet implemented (stub).
 */

import { Env, createDb } from '../lib/db';
import { GhlClient } from '../lib/ghl';

export async function runInactiveSweep(env: Env): Promise<void> {
  console.log('[inactive-sweep] starting');

  // TODO (Phase 6): implement
  // const db = createDb(env);
  // const ghl = new GhlClient(env.GHL_API_KEY);
  //
  // const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  //
  // const staleProfiles = await db.query.profiles.findMany({
  //   where: (p, { and, isNotNull, eq, lt }) =>
  //     and(
  //       isNotNull(p.ghlContactId),
  //       eq(p.ghlOptedOut, false),
  //       lt(p.lastLoginAt, thirtyDaysAgo),
  //     ),
  // });
  //
  // for (const profile of staleProfiles) {
  //   await ghl.addTag(profile.ghlContactId!, 'inactive-30d');
  // }
  //
  // console.log(`[inactive-sweep] tagged ${staleProfiles.length} inactive contacts`);

  console.log('[inactive-sweep] stub — not yet implemented');
}

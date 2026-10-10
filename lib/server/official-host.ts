/**
 * Who Panamia is on its own site.
 *
 * WHY A GROUP AND NOT A PROFILE
 *
 * An event is hosted by exactly one of `host_profile_id` or `host_group_id`
 * (the `events_single_host` CHECK). Hanging Panamia's calendar off a profile
 * would tie the organisation's events to one person's account, and the schema
 * already spells out what that costs -- see the docblock on
 * `events.hostGroupId`: account deletion blocks while you host upcoming events
 * and deletes your completed ones, so "the founder leaves" and "the calendar
 * disappears" become the same event. A group outlives whoever started it,
 * which is the property an organisation needs.
 *
 * WHY THE HANDLE IS THE KEY
 *
 * `panamia` is already in RESERVED_SCREENNAMES, held so no pana can claim it.
 * That reservation is the identity -- resolving through it means the name
 * nobody else may take is the same name this looks up, with no second source
 * of truth to drift. The alternative, an env var holding a group id, differs
 * per environment and is unreadable in a config dump: nothing about a cuid2
 * says "Panamia", so a wrong one fails silently and looks like an empty
 * calendar.
 */

import { db } from '@/lib/db';
import { socialActors, socialGroups } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getFederationDomain } from '@/lib/federation/domain';

/**
 * The handle Panamia-the-organisation answers to.
 *
 * Must stay in RESERVED_SCREENNAMES (lib/screenname.ts). If it is ever removed
 * from that list a pana can register it, and this resolver would then find
 * their group instead -- except it cannot, because the lookup also demands
 * `type = 'Group'`. A person taking the handle makes Panamia unresolvable
 * rather than impersonable, which is the safer of the two failures but still
 * a bug.
 */
export const OFFICIAL_HOST_HANDLE = 'panamia';

/**
 * Positive results only. The group id never changes once minted, so caching a
 * hit is free; caching a miss is not, because the seed script can create the
 * group while the app is running and a cached `null` would outlive it until
 * the next deploy.
 */
let resolvedGroupId: string | null = null;

/**
 * The social group Panamia hosts its events as, or null before it is set up.
 *
 * Null rather than a throw on purpose. Everything that scopes to Panamia has
 * to keep working before `scripts/seed-official-host.ts` has ever been run --
 * on a fresh database, in CI, and in local development that has no Panamia
 * group at all. The callers treat null as "Panamia hosts nothing yet", which
 * is true, instead of failing a page that has other things to show.
 */
export async function officialHostGroupId(): Promise<string | null> {
  if (resolvedGroupId) return resolvedGroupId;

  const [row] = await db
    .select({ id: socialGroups.id })
    .from(socialGroups)
    .innerJoin(socialActors, eq(socialActors.id, socialGroups.actorId))
    .where(
      and(
        eq(socialActors.username, OFFICIAL_HOST_HANDLE),
        eq(socialActors.domain, getFederationDomain()),
        // A Person holding this handle is not Panamia. Without this the
        // resolver would answer with whatever actor owns the name.
        eq(socialActors.type, 'Group')
      )
    )
    .limit(1);

  // Deliberately narrow: `getGroupByHandle` would answer this too, but it
  // selects the whole actor row, which includes the signing key. There is no
  // reason to read a private key to find out an id.
  resolvedGroupId = row?.id ?? null;
  return resolvedGroupId;
}

/**
 * Drop the memo. For tests only.
 *
 * The database suite creates and tears down its own Panamia group inside one
 * process, and `--test-concurrency=1` means a later file inherits whatever the
 * previous one cached. Without this a torn-down group id survives into the
 * next test and scopes its queries to a row that no longer exists.
 */
export function resetOfficialHostCache(): void {
  resolvedGroupId = null;
}

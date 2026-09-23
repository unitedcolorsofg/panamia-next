import { db } from '@/lib/db';
import { profileOwners, profiles } from '@/lib/schema';
import { and, eq, or, sql, type SQL } from 'drizzle-orm';

/**
 * Marker written into profiles.status.source by the public intake form
 * (app/api/listings/intake/route.ts).
 *
 * This is what separates "a business listing nobody has claimed yet" from "a
 * legacy personal profile waiting for its owner to sign in". They look
 * identical otherwise — both have userId NULL — but only the second one may be
 * attached implicitly at sign-in. See notBusinessListing below.
 */
export const BUSINESS_INTAKE_SOURCE = 'business_intake';

/**
 * Profiles that implicit auto-claim is allowed to touch.
 *
 * Auto-claim attaches a profile to whoever signs in with a matching email and
 * makes it their personal identity. That is correct for an admin-imported
 * personal profile, and wrong for a business: it would make the human *be* the
 * business, consume their one profiles.userId slot, and silently block them
 * from ever running a second listing. Businesses go through the explicit claim
 * flow instead, which grants ownership without touching identity.
 *
 * IS DISTINCT FROM rather than <>, because status is NULL on most rows and
 * NULL <> 'business_intake' is NULL, which would filter out everything.
 */
export const notBusinessListing: SQL = sql`(${profiles.status}->>'source' IS DISTINCT FROM ${BUSINESS_INTAKE_SOURCE})`;

export type ProfileOwnerRole = 'owner' | 'admin' | 'editor';

/**
 * Can this user administer this profile?
 *
 * Deliberately accepts either link:
 *   - profiles.userId — the human's own identity profile
 *   - a profile_owners row — granted by claiming, or by an existing owner
 *
 * Both are checked rather than relying on the 0035 backfill alone, so that a
 * code path which sets profiles.userId without writing an owner row can never
 * lock a user out of their own profile. Ownership is additive; it is never the
 * only thing standing between someone and their account.
 */
export async function canAdministerProfile(
  userId: string,
  profileId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .leftJoin(
      profileOwners,
      and(
        eq(profileOwners.profileId, profiles.id),
        eq(profileOwners.userId, userId)
      )
    )
    .where(
      and(
        eq(profiles.id, profileId),
        or(eq(profiles.userId, userId), sql`${profileOwners.id} IS NOT NULL`)
      )
    )
    .limit(1);

  return Boolean(row);
}

/**
 * Every profile this user administers, personal profile included.
 *
 * The union is expressed as an OR over the same left join used above rather
 * than two queries, so the caller gets one ordered list with no duplicates.
 */
export async function listAdministeredProfiles(userId: string) {
  return db
    .selectDistinctOn([profiles.id], {
      id: profiles.id,
      name: profiles.name,
      email: profiles.email,
      screenname: profiles.screenname,
      active: profiles.active,
      primaryImageCdn: profiles.primaryImageCdn,
      isPersonal: sql<boolean>`(${profiles.userId} = ${userId})`,
      role: sql<ProfileOwnerRole>`COALESCE(${profileOwners.role}, 'owner')`,
    })
    .from(profiles)
    .leftJoin(
      profileOwners,
      and(
        eq(profileOwners.profileId, profiles.id),
        eq(profileOwners.userId, userId)
      )
    )
    .where(
      or(eq(profiles.userId, userId), sql`${profileOwners.id} IS NOT NULL`)
    )
    .orderBy(profiles.id);
}

/**
 * Grant ownership. Idempotent — re-claiming is a no-op rather than an error,
 * which keeps the claim endpoint safe to retry and safe against a double-click
 * on the confirmation link.
 */
export async function addProfileOwner(
  profileId: string,
  userId: string,
  role: ProfileOwnerRole = 'owner'
): Promise<void> {
  await db
    .insert(profileOwners)
    .values({ profileId, userId, role })
    .onConflictDoNothing({
      target: [profileOwners.profileId, profileOwners.userId],
    });
}

/**
 * Has anyone claimed this listing?
 *
 * A listing is unclaimed when no one administers it by either link. Used to
 * decide whether to show the "Claim this business" call to action.
 */
export async function isProfileClaimed(profileId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: profiles.userId, ownerId: profileOwners.id })
    .from(profiles)
    .leftJoin(profileOwners, eq(profileOwners.profileId, profiles.id))
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!row) return false;
  return Boolean(row.userId || row.ownerId);
}

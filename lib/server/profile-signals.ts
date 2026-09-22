/**
 * Directory saves and recommendations.
 *
 * Two numbers appear on every business profile: how many panas saved the
 * listing, and how many recommend it. They are stored in one table
 * (profile_signals) and separated by kind, because although the rows look
 * identical the two acts are not:
 *
 *   save      — private. "Remember this for me." Only ever counted.
 *   recommend — public.  "I stand behind this." May be attributed by name.
 *
 * This module is the only place that writes them, so the rule that a business
 * cannot save or recommend lives in exactly one function rather than in every
 * caller that remembers to check.
 *
 * @see lib/server/active-profile.ts for what "acting as" means
 */

import { db } from '@/lib/db';
import { profiles, profileSignals } from '@/lib/schema';
import { and, count, desc, eq, isNotNull } from 'drizzle-orm';
import { getActiveProfileId } from './active-profile';
import { canAdministerProfile } from './profile-owners';

export type ProfileSignalKind = 'save' | 'recommend';

export interface ProfileSignalCounts {
  saves: number;
  recommends: number;
}

export interface ViewerSignalState extends ProfileSignalCounts {
  saved: boolean;
  recommended: boolean;
  /** False while acting as a business listing. See maySignal. */
  maySignal: boolean;
  /**
   * Whether this viewer administers the listing they are looking at.
   *
   * Carried here rather than on its own endpoint because it answers the same
   * question this one already does — "who is looking at this page?" — and the
   * profile page is edge-cached, so it cannot be decided server-side.
   */
  isOwner: boolean;
}

/**
 * Public counts for a listing.
 *
 * One grouped query rather than two counts, so the pair can never be read from
 * two different snapshots and disagree with each other.
 */
export async function getProfileSignalCounts(
  profileId: string
): Promise<ProfileSignalCounts> {
  const rows = await db
    .select({ kind: profileSignals.kind, total: count() })
    .from(profileSignals)
    .where(eq(profileSignals.profileId, profileId))
    .groupBy(profileSignals.kind);

  const counts: ProfileSignalCounts = { saves: 0, recommends: 0 };
  for (const row of rows) {
    if (row.kind === 'save') counts.saves = row.total;
    if (row.kind === 'recommend') counts.recommends = row.total;
  }
  return counts;
}

/**
 * Avatars of the panas who recommend a listing, for the face row on the
 * profile page.
 *
 * Recommendations only. Saves are private — publishing the faces of everyone
 * who bookmarked a business would turn a private act into a public one after
 * the fact, which is not what anyone agreed to when they tapped Save.
 *
 * Newest first, and only panas who have a picture: a row of placeholder
 * silhouettes says less than three real faces do.
 */
export async function getRecommenderAvatars(
  profileId: string,
  limit = 5
): Promise<string[]> {
  const rows = await db
    .select({ image: profiles.primaryImageCdn })
    .from(profileSignals)
    .innerJoin(profiles, eq(profiles.userId, profileSignals.userId))
    .where(
      and(
        eq(profileSignals.profileId, profileId),
        eq(profileSignals.kind, 'recommend'),
        isNotNull(profiles.primaryImageCdn)
      )
    )
    .orderBy(desc(profileSignals.createdAt))
    .limit(limit);

  return rows
    .map((row) => row.image)
    .filter((image): image is string => Boolean(image));
}

/**
 * May this user save and recommend right now?
 *
 * The rule is about the hat, not the person: a human acting as themselves may
 * signal, the same human acting as a business they run may not. A business
 * vouching for another business is not a peer recommendation, it is marketing,
 * and it would quietly devalue every honest number on the page.
 *
 * Someone with no profile at all is allowed — they have an account and are
 * plainly not a business. Turning them away would punish a brand-new member for
 * not having finished a form.
 */
export async function maySignal(userId: string): Promise<boolean> {
  const activeProfileId = await getActiveProfileId(userId);
  if (!activeProfileId) return true;

  const own = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { id: true },
  });

  // No personal profile, but an active one resolved: they are acting as a
  // listing they administer and nothing else. That is the business case.
  if (!own) return false;

  return own.id === activeProfileId;
}

/**
 * Counts plus this viewer's own state, for the signed-in profile page.
 *
 * Kept separate from getProfileSignalCounts because the counts are shared and
 * cacheable while this is per-viewer and must never be rendered into a cached
 * page. @see app/p/[user]/page.tsx, which is edge-cached for 300s.
 */
export async function getViewerSignalState(
  userId: string,
  profileId: string
): Promise<ViewerSignalState> {
  const [counts, mine, allowed, owns] = await Promise.all([
    getProfileSignalCounts(profileId),
    db
      .select({ kind: profileSignals.kind })
      .from(profileSignals)
      .where(
        and(
          eq(profileSignals.profileId, profileId),
          eq(profileSignals.userId, userId)
        )
      ),
    maySignal(userId),
    canAdministerProfile(userId, profileId),
  ]);

  return {
    ...counts,
    saved: mine.some((row) => row.kind === 'save'),
    recommended: mine.some((row) => row.kind === 'recommend'),
    maySignal: allowed,
    isOwner: owns,
  };
}

/**
 * Why a signal was refused.
 *
 * Two different rules, kept apart because they need different words. Acting
 * as a business is about the hat and applies to every listing on the site;
 * owning this one is about this page only, and the same person may signal
 * freely everywhere else.
 */
export type SignalRefusal = 'acting-as-business' | 'own-listing';

export type SetSignalResult =
  | { ok: true; counts: ProfileSignalCounts }
  | { ok: false; reason: SignalRefusal };

/**
 * Turn a signal on or off.
 *
 * Idempotent in both directions — the unique index absorbs a repeated "on" and
 * a repeated "off" deletes nothing — so a double tap on a slow connection can
 * never double-count, and the client may retry freely.
 *
 * Refuses when the caller administers the listing. Saves and recommends are
 * meant to read as other people vouching for a business, so counting the
 * owner's own tap inflates the only numbers a visitor has to judge by, and
 * does it in the one direction the owner benefits from. The UI hides the
 * buttons on your own listing; this is what makes that a rule rather than a
 * suggestion.
 */
export async function setProfileSignal(
  userId: string,
  profileId: string,
  kind: ProfileSignalKind,
  on: boolean
): Promise<SetSignalResult> {
  const [allowed, owns] = await Promise.all([
    maySignal(userId),
    canAdministerProfile(userId, profileId),
  ]);

  if (!allowed) return { ok: false, reason: 'acting-as-business' };
  if (owns) return { ok: false, reason: 'own-listing' };

  if (on) {
    await db
      .insert(profileSignals)
      .values({ profileId, userId, kind })
      .onConflictDoNothing({
        target: [
          profileSignals.profileId,
          profileSignals.userId,
          profileSignals.kind,
        ],
      });
  } else {
    await db
      .delete(profileSignals)
      .where(
        and(
          eq(profileSignals.profileId, profileId),
          eq(profileSignals.userId, userId),
          eq(profileSignals.kind, kind)
        )
      );
  }

  return { ok: true, counts: await getProfileSignalCounts(profileId) };
}

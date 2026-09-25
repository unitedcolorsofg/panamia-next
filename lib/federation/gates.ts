/**
 * Social Feature Gates
 *
 * Permission checks for social features. These gates determine
 * whether a user can access various social capabilities.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import type { Profile } from '@/lib/schema';

export type GateResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * Check if a user can create a social actor (enable social features).
 *
 * Requirements:
 * - Profile must exist
 * - Profile must have socialEligible = true
 *
 * socialEligible is set by:
 * - Age verification (when implemented)
 * - Admin approval
 * - Other verification methods TBD
 */
export function canCreateSocialActor(profile: Profile | null): GateResult {
  if (!profile) {
    return { allowed: false, reason: 'no_profile' };
  }

  if (!profile.socialEligible) {
    return {
      allowed: false,
      reason: profile.socialIneligibleReason || 'not_eligible',
    };
  }

  return { allowed: true };
}

/**
 * Check if a user can post to the social timeline.
 */
export function canPost(profile: Profile | null): GateResult {
  // Must be able to create actor first
  const actorGate = canCreateSocialActor(profile);
  if (!actorGate.allowed) {
    return actorGate;
  }

  // Additional checks can be added here (e.g., rate limits, suspensions)

  return { allowed: true };
}

/**
 * Check if a user can follow other accounts.
 */
export function canFollow(profile: Profile | null): GateResult {
  return canCreateSocialActor(profile);
}

/**
 * Check if a user can be followed by others.
 */
export function canBeFollowed(profile: Profile | null): GateResult {
  return canCreateSocialActor(profile);
}

/**
 * Whether a member's federation setting permits publishing their account.
 *
 * Fails closed on every absent case -- no profile row, an undefined column
 * from a partial select, a null -- because each of those means "we could not
 * establish that they agreed", which has to read the same as "no".
 */
export function mayFederate(
  profile: { federationEnabled?: boolean | null } | null | undefined
): boolean {
  return profile?.federationEnabled === true;
}

/**
 * Check if a user can interact with federated (remote) accounts.
 *
 * Off unless the member turned it on. See profiles.federationEnabled for why
 * that is the default.
 */
export function canFederate(profile: Profile | null): GateResult {
  const actorGate = canCreateSocialActor(profile);
  if (!actorGate.allowed) {
    return actorGate;
  }

  if (!mayFederate(profile)) {
    return { allowed: false, reason: 'federation_not_enabled' };
  }

  return { allowed: true };
}

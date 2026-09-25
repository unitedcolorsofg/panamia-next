/**
 * Actor Management
 *
 * High-level functions for creating and managing SocialActors.
 * Bridges panamia Profiles to ActivityPub actors.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import { db } from '@/lib/db';
import { socialActors, profiles, toPublicActor } from '@/lib/schema';
import type { Profile, SocialActor, PublicSocialActor } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { generateActorKeyPair } from '../crypto/keys';
import { canCreateSocialActor, mayFederate, GateResult } from '../gates';
import {
  socialConfig,
  getActorUrl,
  getInboxUrl,
  getOutboxUrl,
  getFollowersUrl,
  getFollowingUrl,
} from '../index';

export type CreateActorResult =
  | { success: true; actor: PublicSocialActor }
  | { success: false; error: string; gateResult?: GateResult };

/**
 * Create a SocialActor for a Profile.
 */
export async function createActorForProfile(
  profileId: string
): Promise<CreateActorResult> {
  // Fetch the profile with user and socialActor
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    with: { socialActor: true, user: true },
  });

  if (!profile) {
    return { success: false, error: 'Profile not found' };
  }

  // Check gate
  const gateResult = canCreateSocialActor(profile);
  if (!gateResult.allowed) {
    return {
      success: false,
      error: 'Not eligible for social features',
      gateResult,
    };
  }

  // Must have a handle. Prefer the profile's own, falling back to the linked
  // user's for profiles that predate profiles.screenname and have not been
  // through a rename since the backfill. A business listing has no user at all,
  // so sourcing this from profiles is what lets it federate.
  const username = profile.screenname ?? profile.user?.screenname;

  if (!username) {
    return {
      success: false,
      error: 'A handle is required to enable social features',
    };
  }

  // Check if already has an actor
  if (profile.socialActor) {
    return { success: true, actor: toPublicActor(profile.socialActor) };
  }

  // Generate keypair
  const { publicKey, privateKey } = generateActorKeyPair();

  // Build URIs
  const domain = socialConfig.domain;
  const uri = getActorUrl(username);

  // Create the actor
  const [actor] = await db
    .insert(socialActors)
    .values({
      username,
      domain,
      profileId: profile.id,
      uri,
      inboxUrl: getInboxUrl(username),
      outboxUrl: getOutboxUrl(username),
      followersUrl: getFollowersUrl(username),
      followingUrl: getFollowingUrl(username),
      publicKey,
      privateKey,
      name: profile.name,
      summary: getProfileSummary(profile),
      iconUrl: profile.primaryImageCdn ?? undefined,
    })
    .returning();

  return { success: true, actor: toPublicActor(actor) };
}

/**
 * Update a SocialActor when its Profile changes.
 */
export async function syncActorFromProfile(
  profileId: string
): Promise<SocialActor | null> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    with: { socialActor: true },
  });

  if (!profile || !profile.socialActor) {
    return null;
  }

  const [actor] = await db
    .update(socialActors)
    .set({
      name: profile.name,
      summary: getProfileSummary(profile),
      iconUrl: profile.primaryImageCdn ?? undefined,
    })
    .where(eq(socialActors.id, profile.socialActor.id))
    .returning();

  return actor ?? null;
}

/**
 * Get a SocialActor by screenname (local users only).
 *
 * This is the *local* lookup: it powers Pana Social itself -- profile pages,
 * follow buttons, timelines -- and intentionally ignores the member's
 * federation setting. Federation endpoints must use getFederatedActor()
 * instead.
 */
export async function getActorByScreenname(
  screenname: string
): Promise<SocialActor | null> {
  return (
    (await db.query.socialActors.findFirst({
      where: (a, { and, eq }) =>
        and(eq(a.username, screenname), eq(a.domain, socialConfig.domain)),
    })) ?? null
  );
}

/**
 * Get a local SocialActor for a *federation* response.
 *
 * Returns null unless the member has turned federation on, so every caller
 * answers the same way it would for a handle that was never taken: 404, no
 * actor document, no collections, nothing acknowledging the account exists.
 *
 * WHY THIS IS A SEPARATE FUNCTION
 *
 * The obvious implementation -- filtering inside getActorByScreenname() --
 * would take Pana Social down with it. That function is what the profile
 * page, the follow endpoints and the timeline APIs all call, so filtering
 * there would mean opting out of federation also meant opting out of having
 * an account on this site. Federation is a publishing decision, not a
 * membership one, and only the endpoints that publish should be gated.
 *
 * Splitting it makes that choice visible at each call site: a route calling
 * getFederatedActor() is serving other servers, a route calling
 * getActorByScreenname() is serving this one. A new federation endpoint gets
 * the gate by using the function its neighbors already use, rather than by
 * remembering to repeat a check -- the same reason status reads go through
 * visibleTo() instead of each query filtering for itself.
 *
 * Fails closed: an actor with no profile row (remote actors, or a profile
 * deleted out from under one) is not federated either.
 */
export async function getFederatedActor(
  screenname: string
): Promise<SocialActor | null> {
  const actor = await db.query.socialActors.findFirst({
    where: (a, { and, eq }) =>
      and(eq(a.username, screenname), eq(a.domain, socialConfig.domain)),
    with: { profile: { columns: { federationEnabled: true } } },
  });

  if (!actor || !mayFederate(actor.profile)) {
    return null;
  }

  // Drop the joined profile so the return type matches the other lookups and
  // callers can't accidentally serve profile fields in a federation response.
  const { profile: _profile, ...federatedActor } = actor;
  return federatedActor;
}

/**
 * Whether a local actor's member has opted into federation.
 *
 * For paths that already hold an actor and can't re-resolve it by screenname
 * -- the shared inbox finds its target by ActivityPub URI, not by handle.
 *
 * Fails closed: an actor with no profile row is not federated.
 */
export async function isFederationEnabled(
  actor: Pick<SocialActor, 'profileId'>
): Promise<boolean> {
  if (!actor.profileId) {
    return false;
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, actor.profileId),
    columns: { federationEnabled: true },
  });

  return mayFederate(profile);
}

/**
 * Get a SocialActor by full handle (@username@domain).
 */
export async function getActorByHandle(
  handle: string
): Promise<SocialActor | null> {
  // Parse handle: @username@domain or username@domain
  const cleaned = handle.replace(/^@/, '');
  const parts = cleaned.split('@');

  if (parts.length !== 2) {
    return null;
  }

  const [username, domain] = parts;

  return (
    (await db.query.socialActors.findFirst({
      where: (a, { and, eq }) =>
        and(eq(a.username, username), eq(a.domain, domain)),
    })) ?? null
  );
}

/**
 * Get a SocialActor by ActivityPub URI.
 */
export async function getActorByUri(uri: string): Promise<SocialActor | null> {
  return (
    (await db.query.socialActors.findFirst({
      where: eq(socialActors.uri, uri),
    })) ?? null
  );
}

/**
 * Extract a summary/bio from a Profile for the actor.
 */
function getProfileSummary(profile: Profile): string | undefined {
  const descriptions = profile.descriptions as {
    details?: string;
    background?: string;
  } | null;

  if (descriptions?.details) {
    return descriptions.details;
  }

  if (descriptions?.background) {
    return descriptions.background;
  }

  return undefined;
}

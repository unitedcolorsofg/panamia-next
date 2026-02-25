/**
 * Actor Management
 *
 * High-level functions for creating and managing SocialActors.
 * Bridges panamia Profiles to ActivityPub actors.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import { db } from '@/lib/db';
import { socialActors, profiles } from '@/lib/schema';
import type { Profile, SocialActor } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { generateActorKeyPair } from '../crypto/keys';
import { canCreateSocialActor, GateResult } from '../gates';
import {
  socialConfig,
  getActorUrl,
  getInboxUrl,
  getOutboxUrl,
  getFollowersUrl,
  getFollowingUrl,
} from '../index';

export type CreateActorResult =
  | { success: true; actor: SocialActor }
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

  // Must have a linked user with screenname
  if (!profile.user?.screenname) {
    return {
      success: false,
      error: 'User must have a screenname to enable social features',
    };
  }

  // Check if already has an actor
  if (profile.socialActor) {
    return { success: true, actor: profile.socialActor };
  }

  // Generate keypair
  const { publicKey, privateKey } = generateActorKeyPair();

  // Build URIs - username comes from User.screenname
  const username = profile.user.screenname;
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

  return { success: true, actor };
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

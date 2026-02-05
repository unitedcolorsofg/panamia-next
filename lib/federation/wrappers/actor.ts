/**
 * Actor Management
 *
 * High-level functions for creating and managing SocialActors.
 * Bridges panamia Profiles to ActivityPub actors.
 *
 * @see docs/SOCIAL-ROADMAP.md
 */

import { getPrisma } from '@/lib/prisma';
import { Profile, SocialActor } from '@prisma/client';
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
 *
 * This enables social features for the user. The actor is created
 * with a fresh RSA keypair for HTTP signatures.
 *
 * Prerequisites:
 * - Profile must exist and be linked to a User
 * - Profile must have socialEligible = true
 * - User must have a screenname
 * - Profile must not already have an actor
 */
export async function createActorForProfile(
  profileId: string
): Promise<CreateActorResult> {
  const prisma = await getPrisma();

  // Fetch the profile with user
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    include: { socialActor: true, user: true },
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
  const actor = await prisma.socialActor.create({
    data: {
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
      iconUrl: profile.primaryImageCdn || undefined,
    },
  });

  return { success: true, actor };
}

/**
 * Update a SocialActor when its Profile changes.
 *
 * Syncs name, bio, and avatar from Profile to Actor.
 */
export async function syncActorFromProfile(
  profileId: string
): Promise<SocialActor | null> {
  const prisma = await getPrisma();

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    include: { socialActor: true },
  });

  if (!profile || !profile.socialActor) {
    return null;
  }

  const actor = await prisma.socialActor.update({
    where: { id: profile.socialActor.id },
    data: {
      name: profile.name,
      summary: getProfileSummary(profile),
      iconUrl: profile.primaryImageCdn || undefined,
    },
  });

  return actor;
}

/**
 * Get a SocialActor by screenname (local users only).
 */
export async function getActorByScreenname(
  screenname: string
): Promise<SocialActor | null> {
  const prisma = await getPrisma();

  return prisma.socialActor.findFirst({
    where: {
      username: screenname,
      domain: socialConfig.domain,
    },
  });
}

/**
 * Get a SocialActor by full handle (@username@domain).
 */
export async function getActorByHandle(
  handle: string
): Promise<SocialActor | null> {
  const prisma = await getPrisma();

  // Parse handle: @username@domain or username@domain
  const cleaned = handle.replace(/^@/, '');
  const parts = cleaned.split('@');

  if (parts.length !== 2) {
    return null;
  }

  const [username, domain] = parts;

  return prisma.socialActor.findFirst({
    where: { username, domain },
  });
}

/**
 * Get a SocialActor by ActivityPub URI.
 */
export async function getActorByUri(uri: string): Promise<SocialActor | null> {
  const prisma = await getPrisma();

  return prisma.socialActor.findUnique({
    where: { uri },
  });
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

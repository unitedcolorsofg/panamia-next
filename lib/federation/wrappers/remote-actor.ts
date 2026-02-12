/**
 * Remote Actor Fetching & Upsert
 *
 * Functions for fetching remote ActivityPub actors and persisting them locally.
 *
 * Ported from:
 * - external/activities.next/lib/activities/requests/getActorPerson.ts (fetch pattern)
 * - external/activities.next/lib/actions/utils.ts (recordActorIfNeeded pattern)
 *
 * Changes: uses fetch instead of got, Prisma instead of Knex mixins
 */

import { getPrisma } from '@/lib/prisma';
import { SocialActor } from '@prisma/client';
import { parse as parseSignature } from '../crypto/verify';

/**
 * Minimal shape of an ActivityPub actor document.
 * Defined inline to avoid depending on @llun/activities.schema.
 */
interface RemoteActorDocument {
  id: string;
  type: string;
  preferredUsername: string;
  name?: string;
  summary?: string;
  inbox: string;
  outbox?: string;
  followers?: string;
  following?: string;
  url?: string;
  publicKey: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
  icon?: {
    type: string;
    url: string;
  };
  image?: {
    type: string;
    url: string;
  };
  endpoints?: {
    sharedInbox?: string;
  };
  published?: string;
  manuallyApprovesFollowers?: boolean;
}

// Ported from external/activities.next/lib/activities/requests/getActorPerson.ts
// Change: uses native fetch instead of got
export async function fetchRemoteActor(
  actorId: string
): Promise<RemoteActorDocument | null> {
  try {
    const response = await fetch(actorId, {
      headers: {
        Accept:
          'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
      },
    });
    if (response.status !== 200) {
      return null;
    }
    return (await response.json()) as RemoteActorDocument;
  } catch (error) {
    console.error(`[fetchRemoteActor] Failed to fetch ${actorId}:`, error);
    return null;
  }
}

// Ported from external/activities.next/lib/actions/utils.ts (recordActorIfNeeded)
// Change: uses Prisma instead of Knex mixins
export async function ensureRemoteActor(
  actorId: string
): Promise<SocialActor | null> {
  const prisma = await getPrisma();

  const existingActor = await prisma.socialActor.findUnique({
    where: { uri: actorId },
  });

  // Don't update local actors
  if (existingActor?.privateKey) {
    return existingActor;
  }

  if (!existingActor) {
    const person = await fetchRemoteActor(actorId);
    if (!person) return null;

    const domain = new URL(person.id).hostname;

    return prisma.socialActor.create({
      data: {
        uri: actorId,
        username: person.preferredUsername,
        domain,
        name: person.name || person.preferredUsername,
        summary: person.summary,
        inboxUrl: person.inbox,
        outboxUrl: person.outbox || '',
        followersUrl: person.followers || '',
        followingUrl: person.following || '',
        sharedInboxUrl: person.endpoints?.sharedInbox || person.inbox,
        publicKey: person.publicKey.publicKeyPem,
        privateKey: null,
        iconUrl: person.icon?.url,
        headerUrl: person.image?.url,
        manuallyApprovesFollowers: person.manuallyApprovesFollowers ?? false,
      },
    });
  }

  // Update remote actor if stale (older than 3 days)
  const currentTime = Date.now();
  const updatedAt = existingActor.updatedAt.getTime();
  if (currentTime - updatedAt > 3 * 86_400_000) {
    const person = await fetchRemoteActor(actorId);
    if (!person) return existingActor;

    return prisma.socialActor.update({
      where: { uri: actorId },
      data: {
        inboxUrl: person.inbox,
        followersUrl: person.followers || '',
        sharedInboxUrl: person.endpoints?.sharedInbox || person.inbox,
        publicKey: person.publicKey.publicKeyPem,
        iconUrl: person.icon?.url,
        headerUrl: person.image?.url,
      },
    });
  }

  return existingActor;
}

/**
 * Resolve a keyId from an HTTP Signature to a public key.
 *
 * keyId is typically "https://remote.example/users/alice#main-key".
 * We strip the fragment to get the actor URI, look up in DB first,
 * then fetch remotely if needed.
 */
export async function getRemotePublicKey(
  keyId: string
): Promise<{ publicKey: string; actorUri: string } | null> {
  // Strip fragment (#main-key) to get actor URI
  const actorUri = keyId.replace(/#.*$/, '');

  const prisma = await getPrisma();

  // Check DB first
  const existing = await prisma.socialActor.findUnique({
    where: { uri: actorUri },
  });

  if (existing?.publicKey) {
    return { publicKey: existing.publicKey, actorUri };
  }

  // Fetch remotely
  const person = await fetchRemoteActor(actorUri);
  if (!person?.publicKey?.publicKeyPem) return null;

  return { publicKey: person.publicKey.publicKeyPem, actorUri };
}

/**
 * Resolve the public key for verifying an HTTP Signature.
 * Extracts keyId from the Signature header, then resolves the key.
 */
export async function resolveSignaturePublicKey(
  signatureHeader: string
): Promise<{ publicKey: string; actorUri: string } | null> {
  const parsed = await parseSignature(signatureHeader);
  if (!parsed.keyId) return null;
  return getRemotePublicKey(parsed.keyId);
}

/**
 * Remote Actor Fetching & Upsert
 *
 * Functions for fetching remote ActivityPub actors and persisting them locally.
 */

import { db } from '@/lib/db';
import { socialActors } from '@/lib/schema';
import type { SocialActor } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { parse as parseSignature } from '../crypto/verify';

/**
 * Minimal shape of an ActivityPub actor document.
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

export async function ensureRemoteActor(
  actorId: string
): Promise<SocialActor | null> {
  const existingActor = await db.query.socialActors.findFirst({
    where: eq(socialActors.uri, actorId),
  });

  // Don't update local actors
  if (existingActor?.privateKey) {
    return existingActor;
  }

  if (!existingActor) {
    const person = await fetchRemoteActor(actorId);
    if (!person) return null;

    const domain = new URL(person.id).hostname;

    const [actor] = await db
      .insert(socialActors)
      .values({
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
      })
      .returning();

    return actor ?? null;
  }

  // Update remote actor if stale (older than 3 days)
  const currentTime = Date.now();
  const updatedAt = existingActor.updatedAt.getTime();
  if (currentTime - updatedAt > 3 * 86_400_000) {
    const person = await fetchRemoteActor(actorId);
    if (!person) return existingActor;

    const [actor] = await db
      .update(socialActors)
      .set({
        inboxUrl: person.inbox,
        followersUrl: person.followers || '',
        sharedInboxUrl: person.endpoints?.sharedInbox || person.inbox,
        publicKey: person.publicKey.publicKeyPem,
        iconUrl: person.icon?.url,
        headerUrl: person.image?.url,
      })
      .where(eq(socialActors.uri, actorId))
      .returning();

    return actor ?? existingActor;
  }

  return existingActor;
}

/**
 * Resolve a keyId from an HTTP Signature to a public key.
 */
export async function getRemotePublicKey(
  keyId: string
): Promise<{ publicKey: string; actorUri: string } | null> {
  const actorUri = keyId.replace(/#.*$/, '');

  const existing = await db.query.socialActors.findFirst({
    where: eq(socialActors.uri, actorUri),
  });

  if (existing?.publicKey) {
    return { publicKey: existing.publicKey, actorUri };
  }

  const person = await fetchRemoteActor(actorUri);
  if (!person?.publicKey?.publicKeyPem) return null;

  return { publicKey: person.publicKey.publicKeyPem, actorUri };
}

/**
 * Resolve the public key for verifying an HTTP Signature.
 */
export async function resolveSignaturePublicKey(
  signatureHeader: string
): Promise<{ publicKey: string; actorUri: string } | null> {
  const parsed = await parseSignature(signatureHeader);
  if (!parsed.keyId) return null;
  return getRemotePublicKey(parsed.keyId);
}

/**
 * RSA Keypair Management for ActivityPub HTTP Signatures
 *
 * Generates and manages RSA keypairs used for signing outgoing
 * ActivityPub requests and verifying incoming signatures.
 *
 * @see https://docs.joinmastodon.org/spec/security/
 */

import { generateKeyPairSync } from 'crypto';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Generate a new RSA keypair for an actor.
 *
 * Uses RSA 2048-bit keys in PEM format, which is the standard
 * for ActivityPub HTTP signatures.
 */
export function generateActorKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}

/**
 * Format a public key for ActivityPub actor representation.
 *
 * ActivityPub expects the public key in a specific JSON-LD format:
 * {
 *   "id": "https://domain/users/username#main-key",
 *   "owner": "https://domain/users/username",
 *   "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n..."
 * }
 */
export function formatPublicKeyForActor(
  actorUri: string,
  publicKeyPem: string
): {
  id: string;
  owner: string;
  publicKeyPem: string;
} {
  return {
    id: `${actorUri}#main-key`,
    owner: actorUri,
    publicKeyPem,
  };
}

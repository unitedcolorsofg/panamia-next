/**
 * HTTP Signature Signing for ActivityPub
 *
 * Signs outgoing ActivityPub requests with HTTP Signatures.
 *
 * Ported from external/activities.next/lib/utils/signature.ts
 * - sign() (lines 75–94): takes an already-decrypted PEM
 * - signedHeaders() (lines 96–131): accepts { id, privateKey } instead of
 *   activities.next Actor type
 *
 * Keys are stored encrypted (see lib/federation/crypto/key-encryption.ts).
 * signedHeaders() decrypts internally rather than asking callers to do it,
 * so a plaintext key exists only inside this module's stack frame and there
 * is no version of a call site that forgets to decrypt -- it would simply
 * hand ciphertext to the signer and fail loudly.
 */

import crypto from 'crypto';

import { decryptPrivateKey } from './key-encryption';

interface SignableActor {
  id: string;
  privateKey: string | null;
}

// Ported from external/activities.next/lib/utils/signature.ts (lines 75–94)
// Change: takes a decrypted PEM; decryption happens in signedHeaders below.
export function sign(
  request: string,
  headers: Record<string, string | undefined>,
  privateKey: string
) {
  const signedString = [
    request,
    `host: ${headers.host}`,
    `date: ${headers.date}`,
    `digest: ${headers.digest}`,
    `content-type: ${headers['content-type']}`,
  ].join('\n');
  const signer = crypto.createSign('rsa-sha256');
  signer.write(signedString);
  signer.end();
  return signer.sign({ key: privateKey }, 'base64');
}

// Ported from external/activities.next/lib/utils/signature.ts (lines 96–131)
// Change: accepts { id, privateKey } instead of activities.next Actor type
export async function signedHeaders(
  currentActor: SignableActor,
  method: string,
  targetUrl: string,
  content: unknown
) {
  const url = new URL(targetUrl);
  const digest = `SHA-256=${crypto
    .createHash('sha256')
    .update(JSON.stringify(content))
    .digest('base64')}`;
  const host = url.host;
  const contentType = 'application/activity+json';
  const date = new Date().toUTCString();

  const headers: Record<string, string> = {
    host,
    date,
    digest,
    'content-type': contentType,
  };
  if (!currentActor.privateKey) {
    return headers;
  }

  // Stored ciphertext -> PEM. Legacy plaintext rows pass through unchanged,
  // so this is safe to deploy before the backfill has run.
  const privateKeyPem = await decryptPrivateKey(currentActor.privateKey);
  if (!privateKeyPem) {
    return headers;
  }

  const signature = sign(
    `(request-target): ${method} ${url.pathname}`,
    headers,
    privateKeyPem
  );
  const signatureHeader = `keyId="${currentActor.id}#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="${signature}"`;
  return {
    ...headers,
    signature: signatureHeader,
  };
}

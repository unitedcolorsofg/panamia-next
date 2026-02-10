/**
 * HTTP Signature Signing for ActivityPub
 *
 * Signs outgoing ActivityPub requests with HTTP Signatures.
 *
 * Ported from external/activities.next/lib/utils/signature.ts
 * - sign() (lines 75–94): removed passphrase (our keys are unencrypted PEM)
 * - signedHeaders() (lines 96–131): accepts { id, privateKey } instead of
 *   activities.next Actor type
 */

import crypto from 'crypto';

interface SignableActor {
  id: string;
  privateKey: string | null;
}

// Ported from external/activities.next/lib/utils/signature.ts (lines 75–94)
// Change: removed passphrase: getConfig().secretPhase — our keys are unencrypted PEM
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
export function signedHeaders(
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

  const signature = sign(
    `(request-target): ${method} ${url.pathname}`,
    headers,
    currentActor.privateKey
  );
  const signatureHeader = `keyId="${currentActor.id}#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest content-type",signature="${signature}"`;
  return {
    ...headers,
    signature: signatureHeader,
  };
}

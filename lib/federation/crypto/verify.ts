/**
 * HTTP Signature Verification for ActivityPub
 *
 * Verifies incoming HTTP Signatures on ActivityPub requests.
 *
 * Ported from external/activities.next/lib/utils/signature.ts
 * - parse() (lines 23–33): unchanged
 * - verify() (lines 35–73): inlined getHeadersValue as headers.get(),
 *   removed getSpan() tracing, removed FORWARDED_HOST handling
 * - Added hs2019 → rsa-sha256 mapping for Mastodon compatibility
 */

import crypto from 'crypto';
import { generate } from 'peggy';

// Ported from external/activities.next/lib/utils/signature.ts (lines 13–17)
export const SIGNATURE_GRAMMAR = `
pairs = (","? pair:pair { return pair })+
pair = key:token "=" '"' value:value '"' { return [key, value] }
value = value:[0-9a-zA-Z:\\/\\.#\\-() \\+\\=]+ { return value.join('') }
token = token:[0-9a-zA-Z]+ { return token.join('') }`.trim();

interface StringMap {
  [key: string]: string;
}

// Ported from external/activities.next/lib/utils/signature.ts (lines 23–33)
export async function parse(signature: string): Promise<StringMap> {
  const parser = generate(SIGNATURE_GRAMMAR);
  try {
    return (parser.parse(signature) as [string, string][]).reduce(
      (out, item) => ({ ...out, [item[0]]: item[1] }),
      {}
    );
  } catch {
    return {};
  }
}

// Ported from external/activities.next/lib/utils/signature.ts (lines 35–73)
// Changes: inlined getHeadersValue as headers.get(), removed tracing,
// removed FORWARDED_HOST, added hs2019 → rsa-sha256 mapping
export async function verify(
  requestTarget: string,
  headers: Headers,
  publicKey: string
) {
  const requestSignature = headers.get('signature');
  if (!requestSignature) return false;

  const parsedSignature = await parse(requestSignature);
  if (!parsedSignature.headers) {
    return false;
  }

  const comparedSignedString = parsedSignature.headers
    .split(' ')
    .map((item) => {
      if (item === '(request-target)') {
        return `(request-target): ${requestTarget}`;
      }
      return `${item}: ${headers.get(item)}`;
    })
    .join('\n');

  const signature = parsedSignature.signature;

  // Map hs2019 to rsa-sha256 (Mastodon compatibility)
  let algorithm = parsedSignature.algorithm;
  if (algorithm === 'hs2019') {
    algorithm = 'rsa-sha256';
  }

  const verifier = crypto.createVerify(algorithm);
  verifier.update(comparedSignedString);
  try {
    return verifier.verify(publicKey, signature, 'base64');
  } catch {
    return false;
  }
}

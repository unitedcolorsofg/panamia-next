// Browser-safe Nostr event signing (no `ws` import — uses pure crypto only).
// Used by /r enrollment to publish a kind 0 metadata event from the browser
// using the freshly generated nsec, and by tests-relay/helpers.ts.
import { schnorr } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export type UnsignedEvent = Pick<NostrEvent, 'kind' | 'tags' | 'content'> & {
  created_at?: number;
};

/**
 * Verifies a signed Nostr event server-side: recomputes the event id from the
 * canonical serialization and checks the schnorr signature against event.pubkey.
 * Pure crypto — safe to run in the Worker/Node runtime. Used to prove control
 * of a BYO nsec at enrollment (see app/api/relay/enroll). Returns false on any
 * malformed input rather than throwing.
 */
export function verifyEvent(event: NostrEvent): boolean {
  try {
    if (
      !event ||
      typeof event.sig !== 'string' ||
      typeof event.id !== 'string' ||
      typeof event.pubkey !== 'string' ||
      typeof event.created_at !== 'number' ||
      typeof event.kind !== 'number' ||
      !Array.isArray(event.tags)
    ) {
      return false;
    }
    const serialized = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]);
    const id = bytesToHex(sha256(new TextEncoder().encode(serialized)));
    // The id must match the content (no tampering after signing), then the
    // signature must verify against the claimed pubkey.
    if (id !== event.id) return false;
    return schnorr.verify(
      hexToBytes(event.sig),
      hexToBytes(id),
      hexToBytes(event.pubkey)
    );
  } catch {
    return false;
  }
}

export function signEvent(skHex: string, partial: UnsignedEvent): NostrEvent {
  const sk = hexToBytes(skHex);
  const pubkey = bytesToHex(schnorr.getPublicKey(sk));
  const created_at = partial.created_at ?? Math.floor(Date.now() / 1000);
  const ev = { ...partial, pubkey, created_at };
  const serialized = JSON.stringify([
    0,
    ev.pubkey,
    ev.created_at,
    ev.kind,
    ev.tags,
    ev.content,
  ]);
  const id = bytesToHex(sha256(new TextEncoder().encode(serialized)));
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), sk));
  return { ...ev, id, sig } as NostrEvent;
}

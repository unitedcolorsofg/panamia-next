// Shared server-side proof-of-control for BYO (bring-your-own) Nostr keys, used
// by both /api/relay/enroll and /api/relay/rotate.
//
// The caller signs a one-time Nostr event with the nsec they're claiming; we
// verify it SERVER-SIDE (a client-side check would be worthless — the client is
// the potential squatter). The nsec itself is never transmitted: the browser
// signs locally and sends only the signed event. The proof is bound to:
//   - the claimed pubkey (event.pubkey === pubkey, signature valid),
//   - a fixed purpose tag (domain separation vs. arbitrary signed events),
//   - THIS panamia user (a `pana_user` tag === userId), so a proof can't be
//     replayed to attach a victim's key to a different account, and
//   - a freshness window (created_at within BYO_PROOF_MAX_AGE).

import { verifyEvent, type NostrEvent } from './sign';

// Purpose tag value the proof event must carry (tag: ["t", BYO_PROOF_PURPOSE]).
export const BYO_PROOF_PURPOSE = 'pana-key-enrollment';
// Max age of the signed proof, in seconds — bounds the replay window.
export const BYO_PROOF_MAX_AGE = 300;

function getTagValue(event: NostrEvent, name: string): string | undefined {
  return event.tags.find((t) => t[0] === name)?.[1];
}

// Returns null on success, or a human-readable error reason string.
export function verifyByoProof(
  proof: NostrEvent,
  pubkey: string,
  userId: string
): string | null {
  if (!verifyEvent(proof)) return 'proof signature is invalid';
  if (proof.pubkey.toLowerCase() !== pubkey) {
    return 'proof is not signed by the claimed pubkey';
  }
  if (getTagValue(proof, 't') !== BYO_PROOF_PURPOSE) {
    return 'proof is missing the enrollment purpose tag';
  }
  if (getTagValue(proof, 'pana_user') !== userId) {
    return 'proof is not bound to this account';
  }
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - proof.created_at);
  if (!Number.isFinite(ageSec) || ageSec > BYO_PROOF_MAX_AGE) {
    return 'proof has expired — sign a fresh one and retry';
  }
  return null;
}

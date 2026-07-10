import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles, relayGroupMembers } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getProfileReadiness } from '@/lib/relay/profile-readiness';
import { verifyByoProof } from '@/lib/nostr/byo-proof';
import type { NostrEvent } from '@/lib/nostr/sign';

// Self-enroll a Nostr pubkey into the panamia relay groups AND link it to
// the caller's panamia profile.
//   - source 'issued' (default): the keypair was generated client-side in our
//     /r UI — freshly random, so it can't target a victim's existing identity;
//     no proof required.
//   - source 'byo': an arbitrary pubkey the user supplies. This is a squatting
//     vector (claim a real person's key first; the unique constraint then locks
//     them out, and inbound Nostr RSVPs would map to the squatter). So BYO
//     requires a `proof` — a Nostr event signed by the claimed nsec, verified
//     SERVER-SIDE and bound to this account. See verifyByoProof below.
// Group set is hardcoded in AUTO_ENROLL_GROUPS below.
//
// Behavior:
//   - 401 if not signed in.
//   - 400 on malformed pubkey.
//   - 412 if the caller's profile/screenname is incomplete — Resilience
//     requires a finished become-a-pana submission and a screenname so the
//     kind 0 metadata + NIP-05 record we publish on their behalf are
//     coherent. Body: { error: 'profile_incomplete', missing: [...] }.
//   - 409 if the caller already has a different pubkey on file (one identity
//     per profile, by current policy). Re-posting the SAME pubkey is a no-op.
//   - 409 if some other profile already claimed this pubkey.
//   - 200 on success — the row is added to relay_group_members and the
//     profile's nostr_pubkey/source are written. Both writes happen in a
//     single transaction so we don't end up with a half-enrolled state.
// Every successful enrollment lands the user in both the private chat
// group (panamia-test) and the ActivityPub-bridged public group
// (panamia-public). They're auto-paired today; if we ever want users to
// opt out of one, this list moves to a per-user preference.
const AUTO_ENROLL_GROUPS = ['panamia-test', 'panamia-public'] as const;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'sign-in required' }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { pubkey?: string; source?: string; proof?: NostrEvent };
  try {
    body = (await request.json()) as {
      pubkey?: string;
      source?: string;
      proof?: NostrEvent;
    };
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const pubkey = body.pubkey?.toLowerCase();
  if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) {
    return NextResponse.json(
      { error: 'pubkey must be 64-char hex' },
      { status: 400 }
    );
  }

  // 'issued' keys are generated client-side in our /r UI (freshly random, so
  // they cannot target a victim's existing identity). A 'byo' key is an
  // arbitrary pubkey the user types in — that IS a squatting vector, so it must
  // carry a server-verified proof that the caller controls the matching nsec.
  const isByo = body.source === 'byo' || body.proof !== undefined;
  const source: 'issued' | 'byo' = isByo ? 'byo' : 'issued';
  if (isByo) {
    if (!body.proof) {
      return NextResponse.json(
        { error: 'byo enrollment requires a signed proof of key control' },
        { status: 400 }
      );
    }
    const reason = verifyByoProof(body.proof, pubkey, userId);
    if (reason) {
      return NextResponse.json(
        { error: 'invalid_proof', reason },
        { status: 403 }
      );
    }
  }

  const readiness = await getProfileReadiness(userId);
  if (!readiness.ready) {
    return NextResponse.json(
      { error: 'profile_incomplete', missing: readiness.missing },
      { status: 412 }
    );
  }

  const [profile] = await db
    .select({ id: profiles.id, nostrPubkey: profiles.nostrPubkey })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!profile) {
    // Should be unreachable — readiness already required a profile row.
    return NextResponse.json(
      { error: 'profile_incomplete', missing: ['profile'] },
      { status: 412 }
    );
  }

  if (profile.nostrPubkey && profile.nostrPubkey !== pubkey) {
    return NextResponse.json(
      { error: 'profile already has a different nostr_pubkey' },
      { status: 409 }
    );
  }

  try {
    await db.transaction(async (tx) => {
      if (!profile.nostrPubkey) {
        await tx
          .update(profiles)
          .set({ nostrPubkey: pubkey, nostrPubkeySource: source })
          .where(eq(profiles.id, profile.id));
      }
      for (const groupId of AUTO_ENROLL_GROUPS) {
        await tx
          .insert(relayGroupMembers)
          .values({ groupId, pubkey })
          .onConflictDoNothing();
      }
    });
  } catch (err: unknown) {
    // Unique-constraint on profiles.nostr_pubkey: another profile owns it.
    const message = err instanceof Error ? err.message : String(err);
    if (/profiles_nostr_pubkey_unique|duplicate key/i.test(message)) {
      return NextResponse.json(
        { error: 'this pubkey is already claimed by another profile' },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true, groups: AUTO_ENROLL_GROUPS });
}

export const maxDuration = 5;

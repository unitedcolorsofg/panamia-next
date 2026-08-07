import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { relayGroupMembers } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';
import { maturedLeaveExists } from '@/lib/relay/group-maturation';
import { denyPublicRequest } from '@/lib/server/internal-auth';

// Per-pubkey group roster. Returns the set of NIP-29 group_ids the user
// belongs to, for nosflare to stash on the WebSocket session after NIP-42
// AUTH (see docs/RESILIENCE-ROADMAP.md → "Membership lookup on AUTH").
//
// Reached only via Cloudflare Service Binding from panamia-nosflare
// (env.PANAMIA.fetch). Empty result set is a valid response (the pubkey is
// allowed on the relay but currently belongs to no groups) — the caller
// distinguishes this from a transport error by status 200 + groups: [].
export async function GET(request: NextRequest) {
  // Refuse anything arriving from the public edge — see
  // lib/server/internal-auth.ts. The relay's Service Binding is unaffected.
  const denied = denyPublicRequest(request);
  if (denied) return denied;

  const pubkey = request.nextUrl.searchParams.get('pubkey');

  if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) {
    return NextResponse.json(
      { groups: [], error: 'invalid pubkey' },
      { status: 400 }
    );
  }

  // Filter-on-read: rows in relay_group_leave_pending older than the
  // debounce window are treated as "already left" even if the
  // relay_group_members row hasn't been cleaned up yet.
  const rows = await db
    .select({ groupId: relayGroupMembers.groupId })
    .from(relayGroupMembers)
    .where(
      and(
        eq(relayGroupMembers.pubkey, pubkey),
        sql`NOT EXISTS (${maturedLeaveExists})`
      )
    );

  return NextResponse.json({ groups: rows.map((r) => r.groupId) });
}

/**
 * GET /api/social/actors/[username]/groups - discoverable groups for a profile
 *
 * Lives under the social actor namespace because the profile page is the only
 * consumer and a handle is the key, but it reads relay group space. The bridge
 * between the two is profiles.nostr_pubkey, which is nullable — an unenrolled
 * account has no pubkey and therefore belongs to no groups. That is an empty
 * list, not an error, so the tab renders its empty state rather than failing.
 *
 * Only discoverable groups are returned; see listPublicGroupsForPubkey for why
 * invite-only membership must not appear here.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPubkeyForScreenname,
  listPublicGroupsForPubkey,
} from '@/lib/server/relay-groups';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const pubkey = await getPubkeyForScreenname(username);

  if (!pubkey) {
    return NextResponse.json({ success: true, data: { groups: [] } });
  }

  const groups = await listPublicGroupsForPubkey(pubkey);

  return NextResponse.json({ success: true, data: { groups } });
}

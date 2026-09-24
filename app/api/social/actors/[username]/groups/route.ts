/**
 * GET /api/social/actors/[username]/groups - public groups a profile belongs to
 *
 * Serves the Groups stat in the feed rail and the group cards on a profile.
 *
 * This used to read relay group space (NIP-29) through profiles.nostr_pubkey.
 * It now reads social_group_members, because Pana Social groups are the ones
 * panas actually join in-app. Relay groups keep their own surface at
 * /r/groups and are no longer surfaced on profiles.
 *
 * Only public groups an actor is an *active* member of are returned; see
 * listPublicGroupsForActor for why both filters are a privacy requirement
 * rather than a nicety.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getActorByScreenname,
  listPublicGroupsForActor,
} from '@/lib/federation';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const actor = await getActorByScreenname(username);

  // An account with no actor has joined nothing. That is an empty list, not
  // an error, so the rail renders 0 and the tab renders its empty state.
  if (!actor) {
    return NextResponse.json({ success: true, data: { groups: [] } });
  }

  const groups = await listPublicGroupsForActor(actor.id);

  return NextResponse.json({ success: true, data: { groups } });
}

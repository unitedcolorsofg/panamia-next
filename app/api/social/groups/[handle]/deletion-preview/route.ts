/**
 * GET /api/social/groups/[handle]/deletion-preview - What deletion destroys
 *
 * Admin only, because the counts describe the group's private interior --
 * how many people are in it and how much they have written.
 *
 * Exists so the danger zone can state the damage in specifics before anyone
 * confirms. The person deleting a group is rarely the person who loses the
 * most by it, and "46 posts by 12 panas" is the only honest way to say that.
 *
 * @see lib/server/delete-group.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getActiveProfileWithActor } from '@/lib/server/active-profile';
import { getGroupByHandle, getMembership } from '@/lib/federation';
import { getGroupDeletionSummary } from '@/lib/server/delete-group';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const found = await getGroupByHandle(handle);
  if (!found) {
    return NextResponse.json(
      { success: false, error: 'Group not found' },
      { status: 404 }
    );
  }

  const profile = await getActiveProfileWithActor(session.user.id);
  const viewerActorId = profile?.socialActor?.id ?? null;
  const membership = viewerActorId
    ? await getMembership(found.group.id, viewerActorId)
    : null;

  if (membership?.status !== 'active' || membership.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Only an admin can see this' },
      { status: 403 }
    );
  }

  const summary = await getGroupDeletionSummary(found.group.id);
  if (!summary) {
    return NextResponse.json(
      { success: false, error: 'Group not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: summary });
}

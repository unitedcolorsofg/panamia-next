/**
 * A pana's visible Recommendation Lists — the endpoint the profile page calls.
 *
 * Enumeration, so unlisted lists are deliberately absent: `unlisted` means
 * reachable by direct link, and a profile listing is the exact context that
 * promise excludes. Viewing your own profile returns your private lists too,
 * because otherwise the author cannot see their own shelf.
 *
 * Each list comes back with its entries inlined. These are small collections
 * — a handful of places each — and the profile page needs the notes to render
 * anything worth looking at, so a second round trip per list would be pure
 * latency for no saved bytes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getListItems,
  getVisibleListsForOwner,
  resolveOwnerUserIdByHandle,
  serializeList,
} from '@/lib/federation/wrappers/recommendation-list';

interface RouteParams {
  params: Promise<{ handle: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { handle } = await params;
    const session = await auth();
    const viewerUserId = session?.user?.id ?? null;

    const ownerUserId = await resolveOwnerUserIdByHandle(handle);
    if (!ownerUserId) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    const lists = await getVisibleListsForOwner(ownerUserId, viewerUserId);
    const withItems = await Promise.all(
      lists.map(async (list) =>
        serializeList(list, await getListItems(list.id))
      )
    );

    return NextResponse.json({
      success: true,
      data: { handle, lists: withItems },
    });
  } catch (error) {
    console.error('Error loading profile recommendation lists:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load lists' },
      { status: 500 }
    );
  }
}

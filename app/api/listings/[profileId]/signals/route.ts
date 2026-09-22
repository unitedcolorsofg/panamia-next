import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getProfileSignalCounts,
  getViewerSignalState,
  setProfileSignal,
  type ProfileSignalKind,
} from '@/lib/server/profile-signals';

/**
 * Saves and recommendations for one listing.
 *
 * Split out from the profile page because that page is edge-cached for every
 * visitor (see app/p/[user]/page.tsx). Anything that differs per viewer —
 * "have I saved this?" — has to be fetched here instead, or the first visitor's
 * answer would be served to everyone for the next five minutes.
 */

const KINDS: ProfileSignalKind[] = ['save', 'recommend'];

function isKind(value: unknown): value is ProfileSignalKind {
  return (
    typeof value === 'string' && KINDS.includes(value as ProfileSignalKind)
  );
}

/**
 * This viewer's state for the listing, counts included.
 *
 * Anonymous callers get the counts with nothing set, rather than a 401. The
 * numbers are public and a signed-out visitor still needs to see them — that
 * count is part of how they judge whether the directory is worth joining.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    const counts = await getProfileSignalCounts(profileId);
    return NextResponse.json({
      success: true,
      data: {
        ...counts,
        saved: false,
        recommended: false,
        maySignal: false,
        isOwner: false,
      },
    });
  }

  const state = await getViewerSignalState(session.user.id, profileId);
  return NextResponse.json({ success: true, data: state });
}

/**
 * Turn a save or recommendation on or off.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  let body: { kind?: unknown; on?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!isKind(body.kind)) {
    return NextResponse.json(
      { success: false, error: "kind must be 'save' or 'recommend'" },
      { status: 400 }
    );
  }

  if (typeof body.on !== 'boolean') {
    return NextResponse.json(
      { success: false, error: 'on must be a boolean' },
      { status: 400 }
    );
  }

  const counts = await setProfileSignal(
    session.user.id,
    profileId,
    body.kind,
    body.on
  );

  // null means maySignal refused: they are acting as a business listing. The
  // UI hides these controls for businesses, but enforcement must not depend on
  // a component remembering to hide a button.
  if (!counts) {
    return NextResponse.json(
      {
        success: false,
        error: 'Switch to your personal profile to save or recommend',
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      ...counts,
      ...(body.kind === 'save'
        ? { saved: body.on }
        : { recommended: body.on }),
    },
  });
}

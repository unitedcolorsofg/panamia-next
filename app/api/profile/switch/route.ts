import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  canAdministerProfile,
  listAdministeredProfiles,
} from '@/lib/server/profile-owners';
import {
  ACTIVE_PROFILE_COOKIE,
  getActiveProfileId,
} from '@/lib/server/active-profile';

/**
 * Profiles this account can act as, plus which one is currently selected.
 *
 * The active id is resolved server-side rather than read from the cookie by the
 * client: the cookie is httpOnly, and it is only authoritative after being
 * re-validated against profile_owners.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const [administered, activeProfileId] = await Promise.all([
    listAdministeredProfiles(session.user.id),
    getActiveProfileId(session.user.id),
  ]);

  // Your own profile first, then businesses alphabetically — a stable order, so
  // the menu doesn't reshuffle between loads.
  const sorted = [...administered].sort((a, b) => {
    if (a.isPersonal !== b.isPersonal) return a.isPersonal ? -1 : 1;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  return NextResponse.json({
    success: true,
    data: sorted,
    activeProfileId,
  });
}

/**
 * Switch which profile this session is acting as.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  let profileId: unknown;
  try {
    ({ profileId } = await request.json());
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (typeof profileId !== 'string' || !profileId) {
    return NextResponse.json(
      { success: false, error: 'profileId is required' },
      { status: 400 }
    );
  }

  // Authorize before writing the cookie. getActiveProfileId re-checks on every
  // read too, but failing loudly here gives the UI something to show.
  if (!(await canAdministerProfile(session.user.id, profileId))) {
    return NextResponse.json(
      { success: false, error: 'You do not have access to this profile' },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ success: true, data: { profileId } });
  response.cookies.set(ACTIVE_PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

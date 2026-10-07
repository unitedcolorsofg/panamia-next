import { NextRequest, NextResponse } from 'next/server';
import { eq, ilike, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { checkAdminAuth } from '@/lib/server/admin-auth';
import { isAdminEmail } from '@/lib/server/admin-emails';
import {
  SEARCH_RESULT_LIMIT,
  containsPattern,
  normalizeSearchQuery,
} from '@/lib/admin/user-search';

/**
 * Find an account by name, handle or email, to give it a role.
 *
 * GET ?q=... -> { success, data: UserSearchResult[] }
 *
 * Exists because /api/getUserList only pages: granting a role to a named
 * person meant clicking through the member list until they appeared, which
 * stops being possible long before the member list stops growing.
 *
 * Gated on checkAdminAuth rather than super-admin. It reads nothing an admin
 * cannot already page to, and the grant endpoints behind it keep their own
 * tiers — searching is not granting.
 *
 * A query shorter than MIN_SEARCH_LENGTH returns an empty list rather than a
 * 400: this is called on every keystroke, and an error response would paint a
 * failure state over the first character of a working search.
 */

export interface UserSearchResult {
  userId: string;
  email: string;
  name: string | null;
  screenname: string | null;
  /** A role is stored on the profile, so no profile means a grant cannot land. */
  hasProfile: boolean;
  isSuperAdmin: boolean;
  grantedAdmin: boolean;
  isAdmin: boolean;
  isContentModerator: boolean;
}

export async function GET(request: NextRequest) {
  const actor = await checkAdminAuth();
  if (!actor) {
    return NextResponse.json(
      { error: 'Not Authorized:admin' },
      { status: 401 }
    );
  }

  const searchParams = (request.nextUrl ?? new URL(request.url)).searchParams;
  const query = normalizeSearchQuery(searchParams.get('q'));
  if (!query) {
    return NextResponse.json({ success: true, data: [] });
  }

  const pattern = containsPattern(query);

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      screenname: users.screenname,
      roles: profiles.roles,
      profileId: profiles.id,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(
      or(
        ilike(users.name, pattern),
        ilike(users.screenname, pattern),
        ilike(users.email, pattern)
      )
    )
    .limit(SEARCH_RESULT_LIMIT);

  const data: UserSearchResult[] = rows.map((row) => {
    const roles = (row.roles ?? {}) as {
      admin?: boolean;
      contentModerator?: boolean;
    };
    // Mirrors /api/getUserList and the roster: admin is the union of the env
    // tier and the column, computed server-side so no two surfaces can
    // disagree about who is already an admin.
    const isSuperAdmin = isAdminEmail(row.email);
    const grantedAdmin = roles.admin === true;
    return {
      userId: row.id,
      email: row.email,
      name: row.name,
      screenname: row.screenname,
      hasProfile: row.profileId !== null,
      isSuperAdmin,
      grantedAdmin,
      isAdmin: isSuperAdmin || grantedAdmin,
      isContentModerator: roles.contentModerator === true,
    };
  });

  return NextResponse.json({ success: true, data });
}

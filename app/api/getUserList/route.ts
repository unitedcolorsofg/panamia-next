import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { count, desc, eq } from 'drizzle-orm';
import { checkAdminAuth } from '@/lib/server/admin-auth';
import { isAdminEmail } from '@/lib/server/admin-emails';

export async function GET(request: NextRequest) {
  const adminUser = await checkAdminAuth();

  if (!adminUser) {
    return NextResponse.json(
      { error: 'Not Authorized:admin' },
      { status: 401 }
    );
  }

  let page_number = 1;
  // Accepts both spellings. The only caller sends `page`, while this route has
  // always read `page_number` — so paging silently did nothing and every page
  // showed the first twenty rows. Reading both fixes the live caller without
  // breaking a bookmarked or scripted `page_number` URL.
  const searchParams = (request.nextUrl ?? new URL(request.url)).searchParams;
  const rawPage = searchParams.get('page_number') ?? searchParams.get('page');
  if (rawPage) {
    const parsed = parseInt(rawPage, 10);
    // NaN from a junk value must not propagate into the offset arithmetic,
    // where it would produce `LIMIT 20 OFFSET NaN` and fail at the driver.
    page_number = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  const per_page = 20;
  const offset = per_page * page_number - per_page;

  const [{ total }] = await db.select({ total: count() }).from(users);
  const listCount = Number(total);
  const pagination = {
    count: listCount,
    per_page: per_page,
    offset: offset,
    page_number: page_number,
    total_pages: listCount > 0 ? Math.ceil(listCount / per_page) : 1,
  };

  // Left join rather than a second query: profiles.userId is UNIQUE, so this
  // matches at most one row per user and cannot multiply the page. That is
  // also why the count() above can keep counting `users` alone.
  const paginatedList = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      screenname: users.screenname,
      accountType: users.accountType,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      roles: profiles.roles,
      profileId: profiles.id,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .orderBy(desc(users.createdAt))
    .limit(per_page)
    .offset(offset);

  // Format response for backward compatibility
  const formattedList = paginatedList.map((user) => {
    // Mirrors enrichUserFields: admin is the union of the env tier and the
    // column. Computed here rather than inferred in the client so the list and
    // the session can never disagree about who is an admin.
    const isSuperAdmin = isAdminEmail(user.email);
    const roles = user.roles as {
      admin?: boolean;
      contentModerator?: boolean;
    } | null;
    const grantedAdmin = roles?.admin === true;
    return {
      _id: user.id,
      email: user.email,
      name: user.name,
      screenname: user.screenname,
      accountType: user.accountType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isAdmin: isSuperAdmin || grantedAdmin,
      // Distinguished from isAdmin so the UI can explain *why* a row is an
      // admin, and disable the toggle on the rows a toggle cannot affect.
      isSuperAdmin,
      grantedAdmin,
      // The moderation rota. Unlike admin there is no env tier behind it, so
      // the column is the whole answer and no union is needed.
      isContentModerator: roles?.contentModerator === true,
      // A grant needs somewhere to live; an account with no profile has none.
      hasProfile: user.profileId !== null,
    };
  });

  return NextResponse.json({
    success: true,
    data: formattedList,
    pagination: pagination,
  });
}

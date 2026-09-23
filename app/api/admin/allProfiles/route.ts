// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { DIRECTORY_ACCOUNT_TYPES } from '@/lib/accounts';

export async function GET(_request: NextRequest) {
  try {
    // Admin gate: ADMIN_EMAILS-derived session.user.isAdmin, consistent with
    // checkAdminAuth().
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Not Authorized:admin' },
        { status: 401 }
      );
    }

    // Listings only. Every signed-in member now has an active profile, so
    // filtering on `active` alone would bury the vendor list under ordinary
    // consumer signups — and this response returns name, email and phone.
    const allActiveProfiles = await db.query.profiles.findMany({
      where: and(
        eq(profiles.active, true),
        or(
          // Unclaimed legacy listings have no user to carry an account type.
          isNull(profiles.userId),
          inArray(
            profiles.userId,
            db
              .select({ id: users.id })
              .from(users)
              .where(inArray(users.accountType, DIRECTORY_ACCOUNT_TYPES))
          )
        )
      ),
      with: { user: { columns: { screenname: true } } },
    });

    const profilesList = allActiveProfiles.map((guardedProfile) => {
      return {
        name: guardedProfile.name,
        email: guardedProfile.email,
        handle: guardedProfile.user?.screenname || null,
        phone: guardedProfile.phoneNumber || '',
      };
    });

    return NextResponse.json(
      { success: true, data: profilesList },
      { status: 200 }
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json({
      success: false,
      error: `Server Error ${error}`,
    });
  }
}

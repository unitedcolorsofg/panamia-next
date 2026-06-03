// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  try {
    // Admin gate: ADMIN_EMAILS-derived session.user.isAdmin, consistent with
    // checkAdminAuth() — no reliance on the unwired users.role column.
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Not Authorized:admin' },
        { status: 401 }
      );
    }

    const allActiveProfiles = await db.query.profiles.findMany({
      where: eq(profiles.active, true),
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

export const maxDuration = 5;

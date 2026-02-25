// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users, profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';

interface ResponseData {
  error?: string;
  success?: boolean;
  msg?: string;
  data?: any[] | any;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No user session available' },
        { status: 401 }
      );
    }
    const email = session.user?.email;
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'No valid email' },
        { status: 200 }
      );
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser?.role !== 'admin') {
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

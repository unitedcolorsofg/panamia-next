// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';
import { getPrisma } from '@/lib/prisma';
import { unguardProfile } from '@/lib/profile';

interface ResponseData {
  error?: string;
  success?: boolean;
  msg?: string;
  data?: any[] | any;
}

const getUserByEmail = async (email: string) => {
  await dbConnect();
  return await user.findOne({ email: email });
};

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'No user session available',
      });
    }
    const email = session.user?.email;
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'No valid email' },
        { status: 200 }
      );
    }

    // Get user from MongoDB (following is stored there)
    const existingUser = await getUserByEmail(email);
    if (existingUser?.following?.length > 0) {
      const prisma = await getPrisma();
      // Get profiles from PostgreSQL
      const followingProfiles = await prisma.profile.findMany({
        where: {
          id: { in: existingUser.following },
        },
      });
      const profiles = followingProfiles.map((guardedProfile) => {
        return unguardProfile(guardedProfile);
      });
      if (followingProfiles) {
        return NextResponse.json(
          { success: true, data: profiles },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ success: false, error: 'Could not find User' });
  } catch (error) {
    console.log(error);
    return NextResponse.json({
      success: false,
      error: `Server Error ${error}`,
    });
  }
}

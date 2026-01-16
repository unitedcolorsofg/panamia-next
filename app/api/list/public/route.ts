import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import userlist from '@/lib/model/userlist';
import { getPrisma } from '@/lib/prisma';
import { unguardProfile } from '@/lib/profile';

async function getUserlist(id: string) {
  await dbConnect();
  const Profile = await userlist.findOne({ _id: id });
  return Profile;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const list_id = searchParams.get('id');

  if (list_id) {
    const existingUserlist = await getUserlist(list_id.toString());
    console.log('existingUserlist', existingUserlist);
    if (existingUserlist) {
      if (existingUserlist?.profiles.length > 0) {
        const prisma = await getPrisma();
        // Profiles are stored by ID in the userlist
        const listProfiles = await prisma.profile.findMany({
          where: {
            id: { in: existingUserlist.profiles },
          },
        });
        const profiles = listProfiles.map((guardedProfile) => {
          return unguardProfile(guardedProfile);
        });
        if (listProfiles) {
          return NextResponse.json({
            success: true,
            data: { list: existingUserlist, profiles: profiles },
          });
        }
      }
      return NextResponse.json({
        success: true,
        data: { list: existingUserlist, profiles: [] },
      });
    }
  }

  return NextResponse.json({ success: true });
}

export const maxDuration = 5;

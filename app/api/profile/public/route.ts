import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { unguardProfile } from '@/lib/profile';

async function getProfile(handle: string) {
  const prisma = await getPrisma();
  return await prisma.profile.findFirst({
    where: { user: { screenname: handle } },
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const handle = searchParams.get('handle');

  if (handle) {
    const existingProfile = await getProfile(handle.toLowerCase());
    if (existingProfile) {
      return NextResponse.json({
        success: true,
        data: unguardProfile(existingProfile),
      });
    }
  }

  return NextResponse.json({ success: true });
}

export const maxDuration = 5;

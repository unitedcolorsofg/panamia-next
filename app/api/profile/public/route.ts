import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { unguardProfile } from '@/lib/profile';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const handle = searchParams.get('handle');

  if (handle) {
    // Find user by screenname (case-insensitive), then load their profile
    const user = await db.query.users.findFirst({
      where: sql`lower(${users.screenname}) = lower(${handle})`,
      with: { profile: true },
    });

    if (user?.profile) {
      return NextResponse.json({
        success: true,
        data: unguardProfile(user.profile),
      });
    }
  }

  return NextResponse.json({ success: true });
}

export const maxDuration = 5;

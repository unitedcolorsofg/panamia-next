// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({
      success: false,
      error: 'No user session available',
    });
  }

  const { phone_number, pronouns } = body;

  // Find user's profile
  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
  });

  if (!existingProfile) {
    return NextResponse.json({
      success: false,
      error: 'Could not find profile',
    });
  }

  // Convert pronouns object to string
  let pronounsStr: string | null = null;
  if (pronouns) {
    if (pronouns.sheher) pronounsStr = 'she/her';
    else if (pronouns.hehim) pronounsStr = 'he/him';
    else if (pronouns.theythem) pronounsStr = 'they/them';
    else if (pronouns.other && typeof pronouns.other === 'string')
      pronounsStr = pronouns.other;
  }

  try {
    const [updatedProfile] = await db
      .update(profiles)
      .set({
        phoneNumber: phone_number || null,
        pronouns: pronounsStr,
      })
      .where(eq(profiles.id, existingProfile.id))
      .returning();

    return NextResponse.json(
      { success: true, data: updatedProfile },
      { status: 200 }
    );
  } catch (e) {
    if (e instanceof Error) {
      console.log(e.message);
      return NextResponse.json(
        { success: false, error: e.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Unknown error' },
      { status: 500 }
    );
  }
}

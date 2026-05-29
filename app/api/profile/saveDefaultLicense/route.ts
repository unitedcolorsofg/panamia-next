import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const VALID_LICENSES = ['cc-0', 'cc-by-4', 'cc-by-sa-4'] as const;
type CcLicense = (typeof VALID_LICENSES)[number];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({
      success: false,
      error: 'No user session available',
    });
  }

  const license = body?.defaultCcLicense;
  if (!VALID_LICENSES.includes(license as CcLicense)) {
    return NextResponse.json(
      { success: false, error: 'Invalid license value' },
      { status: 400 }
    );
  }

  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
  });

  if (!existingProfile) {
    return NextResponse.json({
      success: false,
      error: 'Could not find profile',
    });
  }

  try {
    const [updatedProfile] = await db
      .update(profiles)
      .set({ defaultCcLicense: license as CcLicense })
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

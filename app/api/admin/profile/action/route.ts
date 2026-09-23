import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { DIRECTORY_ACCOUNT_TYPES } from '@/lib/accounts';
import { sendTemplateEmail } from '@/lib/email';

interface ProfileStatus {
  access?: string;
  approved?: string;
  declined?: string;
  [key: string]: string | undefined;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, access, action } = body;

  let totalProfiles = 0;
  try {
    const [countResult] = await db
      .select({ count: sql<string>`count(*)` })
      .from(profiles)
      .where(
        and(
          eq(profiles.active, true),
          // This count is the membership number in the welcome email. Now that
          // every signed-in member has an active profile, counting `active`
          // alone would report the whole user base rather than the listings.
          or(
            isNull(profiles.userId),
            inArray(
              profiles.userId,
              db
                .select({ id: users.id })
                .from(users)
                .where(inArray(users.accountType, DIRECTORY_ACCOUNT_TYPES))
            )
          )
        )
      );
    totalProfiles = Number(countResult?.count ?? 0);
  } catch {
    console.log('profile.count failed');
  }

  if (email) {
    const emailCheck = email.toString().toLowerCase();
    const existingProfile = await db.query.profiles.findFirst({
      where: eq(profiles.email, emailCheck),
    });

    if (!existingProfile) {
      return NextResponse.json({ success: false, error: 'Profile Not Found' });
    }

    const profileStatus = existingProfile.status as ProfileStatus | null;

    if (profileStatus?.access !== access) {
      return NextResponse.json({ success: false, error: 'Invalid Access Key' });
    }

    if (action === 'approve') {
      const original_approved_date = profileStatus?.approved;
      const newStatus = {
        ...profileStatus,
        approved: new Date().toISOString(),
      };

      await db
        .update(profiles)
        .set({
          active: true,
          status: newStatus,
        })
        .where(eq(profiles.email, emailCheck));

      if (!original_approved_date) {
        await sendTemplateEmail(
          'profile.published',
          { name: existingProfile.name },
          existingProfile.email
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: [
            {
              message: 'Profile has been set active',
              name: existingProfile.name,
              handle: null,
              total: totalProfiles,
            },
          ],
        },
        { status: 200 }
      );
    }

    if (action === 'decline') {
      const original_declined_date = profileStatus?.declined;
      const newStatus = {
        ...profileStatus,
        declined: new Date().toISOString(),
      };

      await db
        .update(profiles)
        .set({
          active: false,
          status: newStatus,
        })
        .where(eq(profiles.email, emailCheck));

      if (!original_declined_date) {
        await sendTemplateEmail(
          'profile.not_published',
          { name: existingProfile.name },
          existingProfile.email
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: [
            {
              message: 'Profile has been declined',
              name: existingProfile.name,
              handle: null,
              total: totalProfiles,
            },
          ],
        },
        { status: 200 }
      );
    }
  }

  return NextResponse.json(
    { success: false, error: `No Profile Found` },
    { status: 200 }
  );
}

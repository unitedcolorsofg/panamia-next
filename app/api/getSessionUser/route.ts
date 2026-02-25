import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { uniqueAffiliateCode } from '@/lib/server/user';

interface AffiliateData {
  activated: boolean;
  code: string;
  accepted_tos: Date | string | null;
  tier: number;
  points: number;
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: 'No user session available' },
      { status: 401 }
    );
  }

  const email = session.user?.email
    ? (session.user?.email as string).toLowerCase()
    : null;

  if (!email) {
    return NextResponse.json(
      { error: 'Email value required' },
      { status: 200 }
    );
  }

  // Check if user exists
  let existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!existingUser) {
    // Create new user
    console.log('getSessionUser:newUser');
    const affiliateCode = await uniqueAffiliateCode();
    const affiliateData: AffiliateData = {
      activated: false,
      code: affiliateCode,
      accepted_tos: null,
      tier: 0,
      points: 0,
    };

    try {
      const affiliateJson = JSON.parse(JSON.stringify(affiliateData));
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          name: session.user?.name || null,
          role: 'user',
          affiliate: affiliateJson,
          alternateEmails: [],
        })
        .returning();
      existingUser = newUser;
      return NextResponse.json({
        success: true,
        data: formatUserResponse(existingUser),
      });
    } catch (err) {
      return NextResponse.json(
        { error: 'Error creating user: ' + err },
        { status: 400 }
      );
    }
  }

  // Check if affiliate data needs to be initialized
  const currentAffiliate = existingUser.affiliate as AffiliateData | null;
  if (!currentAffiliate || Object.keys(currentAffiliate).length === 0) {
    const affiliateCode = await uniqueAffiliateCode();
    const affiliateData: AffiliateData = {
      activated: false,
      code: affiliateCode,
      accepted_tos: null,
      tier: 0,
      points: 0,
    };

    const affiliateJson = JSON.parse(JSON.stringify(affiliateData));
    const [updatedUser] = await db
      .update(users)
      .set({ affiliate: affiliateJson })
      .where(eq(users.id, existingUser.id))
      .returning();
    existingUser = updatedUser;
  }

  return NextResponse.json({
    success: true,
    data: formatUserResponse(existingUser),
  });
}

function formatUserResponse(user: any) {
  return {
    _id: user.id,
    email: user.email,
    name: user.name,
    screenname: user.screenname,
    status: {
      role: user.role,
      locked: user.lockedAt,
    },
    affiliate: user.affiliate,
    alternate_emails: user.alternateEmails,
    zip_code: user.zipCode,
    accountType: user.accountType,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const maxDuration = 5;

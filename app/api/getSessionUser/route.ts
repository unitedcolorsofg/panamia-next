import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { uniqueAffiliateCode } from '@/lib/server/user';
import { Prisma } from '@prisma/client';

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

  const prisma = await getPrisma();

  // Check if user exists
  let existingUser = await prisma.user.findUnique({
    where: { email },
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
      // Convert to plain JSON for Prisma
      const affiliateJson = JSON.parse(
        JSON.stringify(affiliateData)
      ) as Prisma.InputJsonValue;
      existingUser = await prisma.user.create({
        data: {
          email,
          name: session.user?.name || null,
          role: 'user',
          affiliate: affiliateJson,
          alternateEmails: [],
        },
      });
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

    // Convert to plain JSON for Prisma
    const affiliateJson = JSON.parse(
      JSON.stringify(affiliateData)
    ) as Prisma.InputJsonValue;
    existingUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: { affiliate: affiliateJson },
    });
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

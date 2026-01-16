import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { unguardUser } from '@/lib/user';
import BrevoApi from '@/lib/brevo_api';
import { getBrevoConfig } from '@/config/brevo';
import { Prisma } from '@prisma/client';

interface AffiliateData {
  activated: boolean;
  code: string;
  accepted_tos: Date | string | null;
  tier: number;
  points: number;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
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

    const { accept_tos } = body;
    console.log('accept_tos', accept_tos);

    const prisma = await getPrisma();

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!existingUser) {
      return NextResponse.json({
        success: false,
        error: 'Could not find User',
      });
    }

    const currentAffiliate = existingUser.affiliate as AffiliateData | null;

    if (currentAffiliate?.accepted_tos) {
      return NextResponse.json(
        {
          success: false,
          error: "You've already accepted the Affiliate Terms of Service",
        },
        { status: 200 }
      );
    }

    if (accept_tos) {
      const updatedAffiliate: AffiliateData = {
        ...currentAffiliate,
        activated: true,
        code: currentAffiliate?.code || '',
        accepted_tos: new Date(),
        tier: currentAffiliate?.tier || 0,
        points: currentAffiliate?.points || 0,
      };

      try {
        // Convert to plain JSON for Prisma
        const affiliateJson = JSON.parse(
          JSON.stringify(updatedAffiliate)
        ) as Prisma.InputJsonValue;
        const updatedUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: { affiliate: affiliateJson },
        });
        console.log('existingUser.affiliate', updatedUser.affiliate);

        // send Brevo template email
        const brevo = new BrevoApi();
        const brevo_config = getBrevoConfig();
        const template_id = brevo_config.templates.admin.affiliate_submission;
        if (template_id) {
          const params = {
            name: updatedUser.name,
            email: updatedUser.email,
            affiliate: updatedAffiliate.code || 'n/a',
          };
          const response = await brevo.sendTemplateEmail(template_id, params);
          console.log('response', response);
        }

        return NextResponse.json({
          success: true,
          data: unguardUser(formatUserForUnguard(updatedUser)),
        });
      } catch (e) {
        if (e instanceof Error) {
          console.log(e.message);
          return NextResponse.json(
            { success: false, error: e.message },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: unguardUser(formatUserForUnguard(existingUser)),
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json({
      success: false,
      error: `Server Error ${error}`,
    });
  }
}

function formatUserForUnguard(user: any) {
  return {
    email: user.email,
    name: user.name,
    screenname: user.screenname,
    role: user.role,
    accountType: user.accountType,
  };
}

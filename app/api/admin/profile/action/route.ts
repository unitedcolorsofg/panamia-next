// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import BrevoApi from '@/lib/brevo_api';
import { getBrevoConfig } from '@/config/brevo';

interface ResponseData {
  error?: string;
  success?: boolean;
  msg?: string;
  data?: any[];
}

interface ProfileStatus {
  access?: string;
  approved?: string;
  declined?: string;
  [key: string]: any;
}

export async function POST(request: NextRequest) {
  const prisma = await getPrisma();
  const body = await request.json();
  const { email, access, action } = body;

  let totalProfiles = 0;
  try {
    totalProfiles = await prisma.profile.count({ where: { active: true } });
  } catch (e: any) {
    console.log('profile.count failed', e);
  }

  if (email) {
    const emailCheck = email.toString().toLowerCase();
    const existingProfile = await prisma.profile.findUnique({
      where: { email: emailCheck },
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

      await prisma.profile.update({
        where: { email: emailCheck },
        data: {
          active: true,
          status: newStatus as any,
        },
      });

      if (!original_approved_date) {
        // Send Approval email if first time approved
        const brevo = new BrevoApi();
        const brevo_config = getBrevoConfig();
        if (brevo_config.templates.profile.published) {
          const params = {
            name: existingProfile.name,
          };
          await brevo.sendTemplateEmail(
            brevo_config.templates.profile.published,
            params,
            existingProfile.email
          );
        }
      }

      return NextResponse.json(
        {
          success: true,
          data: [
            {
              message: 'Profile has been set active',
              name: existingProfile.name,
              handle: existingProfile.slug,
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

      await prisma.profile.update({
        where: { email: emailCheck },
        data: {
          active: false,
          status: newStatus as any,
        },
      });

      if (!original_declined_date) {
        const brevo = new BrevoApi();
        const brevo_config = getBrevoConfig();
        if (brevo_config.templates.profile.not_published) {
          const params = {
            name: existingProfile.name,
          };
          await brevo.sendTemplateEmail(
            brevo_config.templates.profile.not_published,
            params,
            existingProfile.email
          );
        }
      }

      return NextResponse.json(
        {
          success: true,
          data: [
            {
              message: 'Profile has been declined',
              name: existingProfile.name,
              handle: existingProfile.slug,
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

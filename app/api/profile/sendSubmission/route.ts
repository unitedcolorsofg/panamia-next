// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { ProfileDescriptions } from '@/lib/interfaces';
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
  [key: string]: any;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body;
  if (!email) {
    return NextResponse.json(
      { success: false, error: 'No valid email' },
      { status: 200 }
    );
  }

  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.email, email),
  });

  const brevo_config = getBrevoConfig();
  const template_id = brevo_config.templates.admin.profile_submission;
  if (template_id === 0) {
    return NextResponse.json(
      { success: false, error: 'No Template ID' },
      { status: 200 }
    );
  }
  if (existingProfile) {
    if (existingProfile.active === false) {
      // send Brevo template email
      const brevo = new BrevoApi();
      const profileStatus = existingProfile.status as ProfileStatus | null;
      const descriptions =
        existingProfile.descriptions as ProfileDescriptions | null;
      const socials = existingProfile.socials as Record<string, string> | null;
      const accessKey = profileStatus?.access;
      const base_action_url = `${process.env.NEXT_PUBLIC_HOST_URL}/admin/profile/action`;
      const approve_url = new URL(`${base_action_url}`);
      approve_url.searchParams.set('email', existingProfile.email);
      approve_url.searchParams.set('access', accessKey || '');
      approve_url.searchParams.set('action', 'approve');

      const decline_url = new URL(`${base_action_url}`);
      decline_url.searchParams.set('email', existingProfile.email);
      decline_url.searchParams.set('access', accessKey || '');
      decline_url.searchParams.set('action', 'decline');
      const promises = [];
      if (brevo_config.templates.admin.profile_submission) {
        const params_admin = {
          name: existingProfile.name,
          email: existingProfile.email,
          details: descriptions?.details || '',
          phone_number: existingProfile.phoneNumber || '',
          five_words: descriptions?.fiveWords || '',
          tags: descriptions?.tags || '',
          socials_website: socials?.website || 'n/a',
          socials_instagram: socials?.instagram || 'n/a',
          socials_facebook: socials?.facebook || 'n/a',
          socials_tiktok: socials?.tiktok || 'n/a',
          socials_twitter: socials?.twitter || 'n/a',
          socials_spotify: socials?.spotify || 'n/a',
          hearaboutus: descriptions?.hearaboutus || '',
          affiliate: existingProfile.affiliate || 'n/a',
          approve_url: approve_url.toString(),
          decline_url: decline_url.toString(),
        };
        promises.push(
          brevo.sendTemplateEmail(
            brevo_config.templates.admin.profile_submission,
            params_admin
          )
        );
      }
      if (brevo_config.templates.profile.submitted) {
        const params_submitted = {
          name: existingProfile.name,
        };
        promises.push(
          brevo.sendTemplateEmail(
            brevo_config.templates.profile.submitted,
            params_submitted,
            existingProfile.email
          )
        );
      }
      await Promise.all(promises);
      // TODO: Confirm 201 responses from Brevo
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }
    return NextResponse.json({
      success: false,
      error: 'Profile already active',
    });
  }
  return NextResponse.json({ success: false, error: 'Could not find profile' });
}

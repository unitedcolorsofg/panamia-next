import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { ProfileDescriptions } from '@/lib/interfaces';
import BrevoApi from '@/lib/brevo_api';
import { createUniqueString, slugify, splitName } from '@/lib/standardized';
import { auth } from '@/auth';

const validateEmail = (email: string): boolean => {
  const regEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return regEx.test(email);
};

const verifyRecaptcha = async (token: string): Promise<boolean> => {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error('RECAPTCHA_SECRET_KEY is not configured');
    return false;
  }

  try {
    const response = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${secretKey}&response=${token}`,
      }
    );

    const data = await response.json();

    // reCAPTCHA v3 returns a score from 0.0 to 1.0
    // Recommended threshold is 0.5
    if (data.success && data.score >= 0.5) {
      return true;
    }

    console.warn('reCAPTCHA verification failed:', {
      success: data.success,
      score: data.score,
      action: data.action,
      errors: data['error-codes'],
    });

    return false;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
};

const callBrevo_createContact = async (email: string, name: string) => {
  const brevo = new BrevoApi();

  if (brevo.ready) {
    const [firstName, lastName] = splitName(name);
    const attributes = {
      FIRSTNAME: firstName,
      LASTNAME: lastName,
    };
    let list_ids = [];
    if (brevo.config.lists.addedByWebsite) {
      list_ids.push(parseInt(brevo.config.lists.addedByWebsite));
    }
    if (brevo.config.lists.webformProfile) {
      list_ids.push(parseInt(brevo.config.lists.webformProfile));
    }
    const new_contact = await brevo.createOrUpdateContact(
      email,
      attributes,
      list_ids
    );
  }
};

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'You must be signed in to create a profile.' },
      { status: 401 }
    );
  }

  const body = await request.json();

  const {
    name,
    email,
    locally_based,
    details,
    background,
    socials,
    phone_number,
    whatsapp_community,
    pronouns,
    five_words,
    tags,
    hearaboutus,
    affiliate,
    recaptchaToken,
  } = body;

  // Verify email matches session (security check)
  if (email !== session.user.email) {
    return NextResponse.json(
      { error: 'Email does not match your signed-in account.' },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json(
      { error: 'Please enter a valid business/project name.' },
      { status: 400 }
    );
  }

  if (!validateEmail(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 }
    );
  }

  if (!socials?.website || socials.website.trim().length < 5) {
    return NextResponse.json(
      { error: 'Please provide your website URL.' },
      { status: 400 }
    );
  }

  // reCAPTCHA is optional for authenticated users
  if (recaptchaToken) {
    const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
    if (!isValidRecaptcha) {
      console.warn('reCAPTCHA verification failed for authenticated user');
    }
  }

  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.email, email.toString().toLowerCase()),
  });

  if (existingProfile) {
    return NextResponse.json(
      { error: 'This email is already being used for a profile.' },
      { status: 400 }
    );
  }

  // Convert pronouns object to string
  let pronounsStr: string | null = null;
  if (pronouns) {
    if (pronouns.sheher) pronounsStr = 'she/her';
    else if (pronouns.hehim) pronounsStr = 'he/him';
    else if (pronouns.theythem) pronounsStr = 'they/them';
    else if (pronouns.none) pronounsStr = 'prefer not to say';
    else if (pronouns.other && pronouns.other_desc)
      pronounsStr = pronouns.other_desc;
    else if (pronouns.other) pronounsStr = 'other';
  }

  // Build descriptions JSONB
  const descriptions: ProfileDescriptions = {
    details: details || null,
    background: background || null,
    fiveWords: five_words || null,
    tags: tags || null,
    hearaboutus: hearaboutus || null,
  };

  // Build status JSONB
  const status = {
    submitted: new Date().toISOString(),
    access: createUniqueString(),
  };

  try {
    await db.insert(profiles).values({
      userId: session.user.id,
      name: name,
      email: email.toString().toLowerCase(),
      active: true, // Self-created profiles are active immediately
      status: status as any,
      locallyBased: locally_based || null,
      descriptions: descriptions as any,
      socials: socials || null,
      phoneNumber: phone_number || null,
      whatsappCommunity: whatsapp_community || false,
      pronouns: pronounsStr,
      affiliate: affiliate || null,
    });
  } catch (error) {
    console.error('Database error saving profile:', error);
    return NextResponse.json(
      {
        error:
          'There was an error saving your profile. Please contact us at hola@panamia.club',
      },
      { status: 500 }
    );
  }

  // Add to Brevo (don't await, run in background)
  Promise.allSettled([callBrevo_createContact(email, name)]).catch((err) =>
    console.error('Brevo error:', err)
  );

  return NextResponse.json(
    {
      msg: 'Your profile has been created! You can now be found in the directory.',
    },
    { status: 200 }
  );
}

export const maxDuration = 5;

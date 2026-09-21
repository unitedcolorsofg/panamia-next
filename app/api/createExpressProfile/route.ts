import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { ProfileDescriptions } from '@/lib/interfaces';
import { createUniqueString } from '@/lib/standardized';
import { auth } from '@/auth';
import { verifyTurnstile } from '@/lib/turnstile';

const validateEmail = (email: string): boolean => {
  const regEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return regEx.test(email);
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
    account_type,
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
    turnstileToken,
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

  if (turnstileToken) {
    const isValid = await verifyTurnstile(turnstileToken);
    if (!isValid) {
      console.warn('Turnstile verification failed for authenticated user');
    }
  }

  const normalizedEmail = email.toString().toLowerCase();

  // Submitting this form is the act of asking to be listed, so an absent or
  // unrecognized value falls back to the ordinary listing type rather than
  // leaving the account invisible after it just asked to be seen.
  const listingType: 'small_business' | 'hybrid' =
    account_type === 'hybrid' ? 'hybrid' : 'small_business';

  // Every signed-in user already has a profile — it is created when they claim
  // a screenname — so this form upgrades that record rather than inserting a
  // second one. profiles.userId is UNIQUE and would reject the insert.
  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.email, normalizedEmail),
    columns: { id: true, userId: true },
  });

  // A row owned by somebody else is still a hard conflict: profiles.email is
  // UNIQUE, and the address belongs to whoever claimed it first.
  if (existingProfile && existingProfile.userId !== session.user.id) {
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

  const profileValues = {
    name: name,
    email: normalizedEmail,
    active: true, // Self-created profiles are active immediately
    status: status as Record<string, unknown>,
    locallyBased: locally_based || null,
    descriptions: descriptions as unknown as ProfileDescriptions,
    socials: socials || null,
    phoneNumber: phone_number || null,
    whatsappCommunity: whatsapp_community || false,
    pronouns: pronounsStr,
    affiliate: affiliate || null,
  };

  try {
    if (existingProfile) {
      await db
        .update(profiles)
        .set(profileValues)
        .where(eq(profiles.id, existingProfile.id));
    } else {
      // Accounts that predate profile-on-screenname still need one created.
      await db
        .insert(profiles)
        .values({ ...profileValues, userId: session.user.id });
    }

    // The account type is what actually publishes the listing — the directory,
    // suggestions, and sitemap all filter on it. Without this the profile is
    // saved but never appears anywhere.
    await db
      .update(users)
      .set({ accountType: listingType })
      .where(eq(users.id, session.user.id));
  } catch (error) {
    console.error('Database error saving profile:', error);
    return NextResponse.json(
      {
        error:
          'There was an error saving your profile. Please contact us at hola@pana.social',
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      msg: 'Your profile has been created! You can now be found in the directory.',
    },
    { status: 200 }
  );
}

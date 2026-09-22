import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { verifyTurnstile } from '@/lib/turnstile';
import { sendTemplateEmail } from '@/lib/email';
import { createUniqueString } from '@/lib/standardized';
import type { ProfileDescriptions } from '@/lib/interfaces';

/**
 * Public business intake — the front door for getting listed.
 *
 * Deliberately unauthenticated. Most South Florida businesses hear about Pana
 * from another Pana, not from the site, and making them create an account
 * before they can tell us they exist loses them. This writes an *unclaimed*
 * listing: `profiles.userId` stays null, and the owner attaches an account
 * later via the claim flow (magic link to the address on the listing).
 *
 * Unclaimed rows are already first-class in the directory — see
 * lib/server/directory.ts, which ORs `isNull(profiles.userId)` with the
 * account-type check — so nothing here needs to touch `users.accountType`.
 * There is no user row to carry one.
 *
 * Submissions land inactive and go through the existing email-driven review:
 * the admin notification carries approve/decline links back to
 * /admin/profile/action, which flips `active` and mails the business. That
 * loop already works for rows without a user, since it keys off email.
 */

const validateEmail = (email: string): boolean => {
  const regEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return regEx.test(email);
};

/**
 * Reduce whatever someone pasted to a bare handle. People paste full profile
 * URLs, "@handle", or a handle with a trailing slash roughly equally often.
 */
function normalizeInstagram(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const fromUrl = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/i
  );
  const handle = fromUrl ? fromUrl[1] : trimmed.replace(/^@+/, '');
  return handle.replace(/\/+$/, '').slice(0, 60);
}

/** Accept "shop.com" as readily as "https://shop.com". */
function normalizeWebsite(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString().slice(0, 200);
  } catch {
    return '';
  }
}

function asTrimmedString(raw: unknown, maxLength: number): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Could not read that submission. Please try again.' },
      { status: 400 }
    );
  }

  const name = asTrimmedString(body.name, 100);
  const email = asTrimmedString(body.email, 100).toLowerCase();
  const fiveWords = asTrimmedString(body.fiveWords, 120);
  const details = asTrimmedString(body.details, 1000);
  const phoneNumber = asTrimmedString(body.phoneNumber, 30);
  const instagram = normalizeInstagram(body.instagram);
  const website = normalizeWebsite(body.website);
  const { turnstileToken } = body;

  if (name.length < 2) {
    return NextResponse.json(
      { error: 'Please enter your business name (at least 2 characters).' },
      { status: 400 }
    );
  }

  if (!validateEmail(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 }
    );
  }

  if (fiveWords.length < 3) {
    return NextResponse.json(
      { error: 'Please tell us what you do in a few words.' },
      { status: 400 }
    );
  }

  // At least one public link. This is the only thing a reviewer can use to
  // confirm a submission is a real South Florida business rather than noise,
  // and it doubles as the source for prefilling the profile later.
  if (!instagram && !website) {
    return NextResponse.json(
      {
        error:
          'Please add an Instagram handle or a website so we can find you.',
      },
      { status: 400 }
    );
  }

  // Turnstile is required unconditionally. This endpoint has no session to
  // lean on, so the token is the only bot check standing between a scripted
  // client and the directory.
  if (!turnstileToken || typeof turnstileToken !== 'string') {
    return NextResponse.json(
      { error: 'Verification required.' },
      { status: 400 }
    );
  }

  const isValid = await verifyTurnstile(turnstileToken);
  if (!isValid) {
    return NextResponse.json(
      {
        error: 'Verification failed. Please try again or contact us in-person.',
      },
      { status: 400 }
    );
  }

  try {
    // `profiles.email` is unique, so a collision is a real conflict rather
    // than a race we can retry. The message stays deliberately vague about
    // whether the existing listing is claimed — saying so would tell a
    // stranger which businesses have accounts attached.
    const existingProfile = await db.query.profiles.findFirst({
      where: eq(profiles.email, email),
      columns: { id: true },
    });

    if (existingProfile) {
      return NextResponse.json(
        {
          error:
            'There is already a listing with this email. Sign in to manage it, or contact us if you think this is a mistake.',
        },
        { status: 409 }
      );
    }

    const descriptions: ProfileDescriptions = {
      fiveWords,
      details,
      tags: '',
      hearaboutus: '',
    };

    await db.insert(profiles).values({
      // No owner yet — this is the whole point of intake. The claim flow
      // attaches a user later.
      userId: null,
      name,
      email,
      phoneNumber: phoneNumber || null,
      active: false,
      descriptions,
      socials: { instagram, website },
      status: {
        submitted: new Date().toISOString(),
        access: createUniqueString(),
      },
    });

    await sendSubmissionEmails(email);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[listings/intake] submission failed', error);
    return NextResponse.json(
      { error: 'Something went wrong saving your listing. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Mail the business a receipt and staff an approve/decline pair. Re-reads the
 * row so the access key and normalized fields come from what actually landed.
 *
 * Best-effort on purpose: a mail provider outage must not cost us the
 * submission, which is already committed by this point. Staff can re-trigger
 * these from /api/profile/sendSubmission.
 */
async function sendSubmissionEmails(email: string): Promise<void> {
  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.email, email),
    });
    if (!profile) return;

    const status = profile.status as { access?: string } | null;
    const descriptions = profile.descriptions as ProfileDescriptions | null;
    const socials = profile.socials as Record<string, string> | null;

    const baseActionUrl = `${process.env.NEXT_PUBLIC_HOST_URL}/admin/profile/action`;
    const approveUrl = new URL(baseActionUrl);
    approveUrl.searchParams.set('email', profile.email);
    approveUrl.searchParams.set('access', status?.access || '');
    approveUrl.searchParams.set('action', 'approve');

    const declineUrl = new URL(baseActionUrl);
    declineUrl.searchParams.set('email', profile.email);
    declineUrl.searchParams.set('access', status?.access || '');
    declineUrl.searchParams.set('action', 'decline');

    await Promise.all([
      sendTemplateEmail('admin.profile_submission', {
        name: profile.name,
        email: profile.email,
        details: descriptions?.details || '',
        phone_number: profile.phoneNumber || '',
        five_words: descriptions?.fiveWords || '',
        tags: descriptions?.tags || '',
        socials_website: socials?.website || 'n/a',
        socials_instagram: socials?.instagram || 'n/a',
        hearaboutus: 'Public business intake form',
        affiliate: profile.affiliate || 'n/a',
        approve_url: approveUrl.toString(),
        decline_url: declineUrl.toString(),
      }),
      sendTemplateEmail(
        'profile.submitted',
        { name: profile.name },
        profile.email
      ),
    ]);
  } catch (error) {
    console.error('[listings/intake] notification email failed', error);
  }
}

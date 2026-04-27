import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { newsletterSignups } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { sendTemplateEmail } from '@/lib/email';
import { verifyTurnstile } from '@/lib/turnstile';

const validateEmail = (email: string): boolean => {
  const regEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return regEx.test(email);
};

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { name, email, signup_type, turnstileToken } = body;

  if (!validateEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' });
  }

  if (!turnstileToken) {
    return NextResponse.json(
      { error: 'Verification required.' },
      { status: 400 }
    );
  }

  const isValid = await verifyTurnstile(turnstileToken);
  if (!isValid) {
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 400 }
    );
  }

  const existingSignup = await db.query.newsletterSignups.findFirst({
    where: eq(newsletterSignups.email, email.toLowerCase()),
  });
  if (existingSignup) {
    return NextResponse.json(
      { error: 'You are already registered.' },
      { status: 200 }
    );
  }

  try {
    await db.insert(newsletterSignups).values({
      name: name,
      email: email.toLowerCase(),
      signupType: signup_type,
    });

    sendTemplateEmail('admin.newsletter_submission', {
      name,
      email,
      signup_type,
    }).catch((err) => console.error('Admin notification email error:', err));

    return NextResponse.json({
      msg: 'Successfully created new Signup',
      success: true,
    });
  } catch (error) {
    return NextResponse.json({
      error: "Error on '/api/createSignup': " + error,
    });
  }
}

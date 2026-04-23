import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { newsletterSignups } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { sendTemplateEmail } from '@/lib/email';

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
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${secretKey}&response=${token}`,
      }
    );
    const data = await response.json();
    if (data.success && data.score >= 0.5) return true;

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

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { name, email, signup_type, recaptchaToken } = body;

  if (!validateEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' });
  }

  if (!recaptchaToken) {
    return NextResponse.json(
      { error: 'reCAPTCHA verification required.' },
      { status: 400 }
    );
  }

  const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
  if (!isValidRecaptcha) {
    return NextResponse.json(
      { error: 'reCAPTCHA verification failed. Please try again.' },
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

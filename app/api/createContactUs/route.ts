import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { contactSubmissions } from '@/lib/schema';
import { verifyTurnstile } from '@/lib/turnstile';

const validateEmail = (email: string): boolean => {
  const regEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return regEx.test(email);
};

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Get and validate body variables
  const { name, email, message, turnstileToken } = body;

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json(
      { error: 'Please enter a valid name (at least 2 characters).' },
      { status: 400 }
    );
  }

  if (!validateEmail(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 }
    );
  }

  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    return NextResponse.json(
      { error: 'Please enter a message (at least 10 characters).' },
      { status: 400 }
    );
  }

  // Check if user is authenticated
  const session = await auth();
  const isAuthenticated = !!session?.user?.email;

  // For unauthenticated users, verify Turnstile
  if (!isAuthenticated) {
    if (!turnstileToken) {
      return NextResponse.json(
        { error: 'Verification required.' },
        { status: 400 }
      );
    }

    const isValid = await verifyTurnstile(turnstileToken);
    if (!isValid) {
      return NextResponse.json(
        {
          error: 'Verification failed. Please try again or contact support.',
        },
        { status: 400 }
      );
    }
  }

  // Save to database
  try {
    await db.insert(contactSubmissions).values({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      message: message.trim(),
      acknowledged: false,
    });
  } catch (error) {
    console.error('Database error saving contact form:', error);
    return NextResponse.json(
      {
        error:
          'There was an error saving your message. Please try again later.',
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      msg: 'Your message has been received. We will get back to you soon!',
    },
    { status: 200 }
  );
}

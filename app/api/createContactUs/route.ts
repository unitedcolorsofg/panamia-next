// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { contactSubmissions } from '@/lib/schema';
import BrevoApi from '@/lib/brevo_api';
import { splitName } from '@/lib/standardized';

interface ResponseData {
  error?: string;
  msg?: string;
}

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
    // 0.0 is very likely a bot, 1.0 is very likely a good interaction
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
    // const contact = await brevo.findContact(email);
    const [firstName, lastName] = splitName(name);
    const attributes = {
      FIRSTNAME: firstName,
      LASTNAME: lastName,
    };
    let list_ids = [];
    if (brevo.config.lists.addedByWebsite) {
      list_ids.push(parseInt(brevo.config.lists.addedByWebsite));
    }
    if (brevo.config.lists.webformContactUs) {
      list_ids.push(parseInt(brevo.config.lists.webformContactUs));
    }
    const new_contact = await brevo.createOrUpdateContact(
      email,
      attributes,
      list_ids
    );
  }
};

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Get and validate body variables
  const { name, email, message, recaptchaToken } = body;

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

  // For unauthenticated users, verify reCAPTCHA
  if (!isAuthenticated) {
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: 'reCAPTCHA verification required.' },
        { status: 400 }
      );
    }

    const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
    if (!isValidRecaptcha) {
      return NextResponse.json(
        {
          error:
            'reCAPTCHA verification failed. Please try again or contact support.',
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

  // Add to Brevo (don't await, run in background)
  Promise.allSettled([callBrevo_createContact(email, name)]).catch((err) =>
    console.error('Brevo error:', err)
  );

  return NextResponse.json(
    {
      msg: 'Your message has been received. We will get back to you soon!',
    },
    { status: 200 }
  );
}

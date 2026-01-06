import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json(
      { error: 'reCAPTCHA token required' },
      { status: 400 }
    );
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error('RECAPTCHA_SECRET_KEY is not configured');
    return NextResponse.json(
      { error: 'reCAPTCHA not configured on server' },
      { status: 500 }
    );
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
      return NextResponse.json({ success: true, score: data.score });
    }

    // Allow v2 keys in development or Vercel preview deployments (v2 doesn't return score)
    // Note: dev script uses `env -u NODE_ENV` so NODE_ENV is undefined in dev
    const host = request.headers.get('host') || '';
    const isDevOrPreview =
      process.env.NODE_ENV !== 'production' || host.includes('vercel.app');
    if (data.success && data.score === undefined && isDevOrPreview) {
      console.warn('reCAPTCHA: v2 keys detected in dev mode, allowing request');
      return NextResponse.json({ success: true, score: 1.0 });
    }

    console.warn('reCAPTCHA verification failed:', {
      success: data.success,
      score: data.score,
      action: data.action,
      errors: data['error-codes'],
    });

    return NextResponse.json(
      { error: 'reCAPTCHA verification failed' },
      { status: 400 }
    );
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify reCAPTCHA' },
      { status: 500 }
    );
  }
}

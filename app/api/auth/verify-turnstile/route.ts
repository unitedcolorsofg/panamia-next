import { NextRequest, NextResponse } from 'next/server';
import { verifyTurnstile } from '@/lib/turnstile';

export async function POST(request: NextRequest) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json(
      { error: 'Turnstile token required' },
      { status: 400 }
    );
  }

  const success = await verifyTurnstile(token);

  if (success) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: 'Turnstile verification failed' },
    { status: 400 }
  );
}

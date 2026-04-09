/**
 * DELETE ACCOUNT — POST
 *
 * Executes permanent account deletion after user confirmation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteAccount } from '@/lib/server/delete-account';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  let body: { attributionChoice?: string; confirmEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { attributionChoice, confirmEmail } = body;

  // Validate attribution choice
  if (attributionChoice !== 'keep' && attributionChoice !== 'anonymize') {
    return NextResponse.json(
      { error: 'attributionChoice must be "keep" or "anonymize"' },
      { status: 400 }
    );
  }

  // Verify email confirmation
  if (
    !confirmEmail ||
    confirmEmail.toLowerCase() !== session.user.email.toLowerCase()
  ) {
    return NextResponse.json(
      { error: 'Email confirmation does not match' },
      { status: 400 }
    );
  }

  // Extract IP
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    undefined;

  const result = await deleteAccount(session.user.id, {
    attributionChoice,
    ip,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, warnings: result.warnings },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    warnings: result.warnings,
  });
}

export const maxDuration = 30;

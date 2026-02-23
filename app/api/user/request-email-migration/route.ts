import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  emailMigrationVerificationHtml,
  emailMigrationVerificationText,
} from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import BrevoApi from '@/lib/brevo_api';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'You must be signed in to migrate your email' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { newEmail } = body;

    if (!newEmail || typeof newEmail !== 'string') {
      return NextResponse.json(
        { error: 'New email address is required' },
        { status: 400 }
      );
    }

    const normalizedNewEmail = newEmail.toLowerCase().trim();
    const currentEmail = session.user.email.toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedNewEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if same as current email
    if (normalizedNewEmail === currentEmail) {
      return NextResponse.json(
        { error: 'New email must be different from current email' },
        { status: 400 }
      );
    }

    const prisma = await getPrisma();

    // Check if new email already exists (using Prisma)
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedNewEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email address already in use' },
        { status: 400 }
      );
    }

    // Check for existing pending migration for this user
    const existingMigration = await prisma.emailMigration.findFirst({
      where: {
        userId: session.user.id,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingMigration) {
      return NextResponse.json(
        {
          error:
            'A migration is already pending. Please wait for it to expire or complete it.',
        },
        { status: 400 }
      );
    }

    // Check for pending migration to the same email
    const duplicateMigration = await prisma.emailMigration.findFirst({
      where: {
        newEmail: normalizedNewEmail,
        expiresAt: { gt: new Date() },
      },
    });

    if (duplicateMigration) {
      return NextResponse.json(
        { error: 'A migration to this email is already pending' },
        { status: 400 }
      );
    }

    // Generate migration token
    const migrationToken = nanoid(32);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create pending migration record
    await prisma.emailMigration.create({
      data: {
        userId: session.user.id,
        oldEmail: currentEmail,
        newEmail: normalizedNewEmail,
        migrationToken,
        expiresAt,
      },
    });

    // Send verification email to new address
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const migrationUrl = `${protocol}://${host}/migrate-email?token=${migrationToken}`;

    await new BrevoApi().sendEmail(
      normalizedNewEmail,
      'Verify Your Pana MIA Email Migration',
      emailMigrationVerificationHtml({
        url: migrationUrl,
        oldEmail: currentEmail,
        newEmail: normalizedNewEmail,
      }),
      emailMigrationVerificationText({
        url: migrationUrl,
        oldEmail: currentEmail,
        newEmail: normalizedNewEmail,
      })
    );

    return NextResponse.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Email migration request error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate email migration. Please try again.' },
      { status: 500 }
    );
  }
}

export const maxDuration = 10;

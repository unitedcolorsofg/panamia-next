import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    const prisma = await getPrisma();

    // Find verification record
    const verification = await prisma.oAuthVerification.findUnique({
      where: { verificationToken: token },
    });

    if (!verification) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > verification.expiresAt) {
      await prisma.oAuthVerification.delete({ where: { id: verification.id } });
      return NextResponse.json(
        {
          error:
            'Verification link has expired. Please sign in again to receive a new verification email.',
        },
        { status: 400 }
      );
    }

    const { email, provider, providerAccountId } = verification;

    // Use Prisma transaction for atomic user/account creation
    const result = await prisma.$transaction(async (tx) => {
      // Check if user already exists with this email
      let userId: string;
      let existingUser = await tx.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        userId = existingUser.id;

        // Check if account link already exists
        const existingAccount = await tx.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider,
              providerAccountId,
            },
          },
        });

        if (!existingAccount) {
          // Create account link
          await tx.account.create({
            data: {
              userId,
              type: 'oauth',
              provider,
              providerAccountId,
            },
          });
        }
      } else {
        // Create new user with account in one transaction
        const newUser = await tx.user.create({
          data: {
            email,
            emailVerified: new Date(),
            accounts: {
              create: {
                type: 'oauth',
                provider,
                providerAccountId,
              },
            },
          },
        });
        userId = newUser.id;
      }

      return { userId };
    });

    // Auto-claim profile (PostgreSQL operation, separate from transaction)
    const unclaimedProfile = await prisma.profile.findFirst({
      where: {
        email: email.toLowerCase(),
        userId: null,
      },
    });

    if (unclaimedProfile) {
      console.log(
        'Auto-claiming profile for user:',
        email,
        'after email verification for provider:',
        provider
      );
      await prisma.profile.update({
        where: { id: unclaimedProfile.id },
        data: { userId: result.userId },
      });
      console.log('Profile claimed successfully');
    }

    // Delete verification record
    await prisma.oAuthVerification.delete({ where: { id: verification.id } });

    return NextResponse.json({
      success: true,
      message: 'Email verified! You can now sign in.',
    });
  } catch (error) {
    console.error('OAuth verification completion error:', error);
    return NextResponse.json(
      { error: 'Failed to complete verification. Please try again.' },
      { status: 500 }
    );
  }
}

export const maxDuration = 10;

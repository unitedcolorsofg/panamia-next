import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import oauthVerification from '@/lib/model/oauthVerification';
import profile from '@/lib/model/profile';
import { getPrismaSync } from '@/lib/prisma';

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

    await dbConnect();

    // Find verification record (still in MongoDB for now)
    const verification = await oauthVerification.findOne({
      verificationToken: token,
    });

    if (!verification) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > verification.expiresAt) {
      await oauthVerification.deleteOne({ _id: verification._id });
      return NextResponse.json(
        {
          error:
            'Verification link has expired. Please sign in again to receive a new verification email.',
        },
        { status: 400 }
      );
    }

    const { email, provider, providerAccountId } = verification;

    // Use Prisma for PostgreSQL auth operations
    const prisma = getPrismaSync();

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

    // Auto-claim profile (MongoDB operation, separate from transaction)
    const unclaimedProfile = await profile.findOne({
      email: email.toLowerCase(),
      $or: [{ userId: { $exists: false } }, { userId: null }],
    });

    if (unclaimedProfile) {
      console.log(
        'Auto-claiming profile for user:',
        email,
        'after email verification for provider:',
        provider
      );
      unclaimedProfile.userId = result.userId;
      await unclaimedProfile.save();
      console.log('Profile claimed successfully');
    }

    // Delete verification record
    await oauthVerification.deleteOne({ _id: verification._id });

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

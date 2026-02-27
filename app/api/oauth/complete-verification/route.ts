import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { oAuthVerifications, users, accounts, profiles } from '@/lib/schema';
import { and, eq, isNull } from 'drizzle-orm';

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

    // Find verification record
    const verification = await db.query.oAuthVerifications.findFirst({
      where: eq(oAuthVerifications.verificationToken, token),
    });

    if (!verification) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > verification.expiresAt) {
      await db
        .delete(oAuthVerifications)
        .where(eq(oAuthVerifications.id, verification.id));
      return NextResponse.json(
        {
          error:
            'Verification link has expired. Please sign in again to receive a new verification email.',
        },
        { status: 400 }
      );
    }

    const { email, provider, providerAccountId } = verification;

    // Check if user already exists with this email
    let userId: string;
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      userId = existingUser.id;

      // Check if account link already exists
      const existingAccount = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.providerId, provider),
          eq(accounts.accountId, providerAccountId)
        ),
      });

      if (!existingAccount) {
        // Create account link
        const now = new Date();
        await db.insert(accounts).values({
          userId,
          providerId: provider,
          accountId: providerAccountId,
          createdAt: now,
          updatedAt: now,
        });
      }
    } else {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          emailVerified: new Date(),
        })
        .returning({ id: users.id });
      userId = newUser.id;

      // Create account link
      const now = new Date();
      await db.insert(accounts).values({
        userId,
        providerId: provider,
        accountId: providerAccountId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Auto-claim profile
    const unclaimedProfile = await db.query.profiles.findFirst({
      where: and(
        eq(profiles.email, email.toLowerCase()),
        isNull(profiles.userId)
      ),
    });

    if (unclaimedProfile) {
      console.log(
        'Auto-claiming profile for user:',
        email,
        'after email verification for provider:',
        provider
      );
      await db
        .update(profiles)
        .set({ userId })
        .where(eq(profiles.id, unclaimedProfile.id));
      console.log('Profile claimed successfully');
    }

    // Delete verification record
    await db
      .delete(oAuthVerifications)
      .where(eq(oAuthVerifications.id, verification.id));

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

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { oAuthVerifications, users, accounts, profiles } from '@/lib/schema';
import { and, eq, isNull } from 'drizzle-orm';
import {
  addProfileOwner,
  notBusinessListing,
} from '@/lib/server/profile-owners';

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

      // Must match the key better-auth writes for this provider, or the next
      // sign-in looks up a different row and links a second account.
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
          emailVerified: true,
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
        isNull(profiles.userId),
        // Same exclusion as auth.ts: an unclaimed *business* listing must not
        // become this user's personal profile. Without this, a business owner
        // who submits /form/list-your-business and later signs in with the
        // same address through OAuth has their listing welded to their
        // identity, consuming their single profiles.userId slot and silently
        // barring them from ever running a second listing.
        // See lib/server/profile-owners.ts.
        notBusinessListing
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
      // Keep the ownership table in step with the identity link so permission
      // checks have one consistent answer. canAdministerProfile accepts either
      // link, so omitting this does not lock anyone out — it just leaves the
      // two sources of truth disagreeing for anything that reads
      // profileOwners directly.
      await addProfileOwner(unclaimedProfile.id, userId);
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

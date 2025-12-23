import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import oauthVerification from '@/lib/model/oauthVerification';
import user from '@/lib/model/user';
import profile from '@/lib/model/profile';
import clientPromise from '@/lib/mongodb';
import mongoose from 'mongoose';

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

    // Find verification record
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

    const { email, provider, providerAccountId, oauthProfile } = verification;

    // Use MongoDB transaction for atomic account creation
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if user already exists with this email
      let userId;
      const existingUser = await user.findOne({ email });

      if (existingUser) {
        userId = existingUser._id.toString();

        // Check if account link already exists
        const client = await clientPromise;
        const db = client.db();
        const existingAccount = await db
          .collection('nextauth_accounts')
          .findOne({
            userId,
            provider,
            providerAccountId,
          });

        if (!existingAccount) {
          // Create account link
          await db.collection('nextauth_accounts').insertOne({
            userId,
            type: 'oauth',
            provider,
            providerAccountId,
            // @ts-ignore - MongoDB client session type mismatch
            session,
          });
        }
      } else {
        // Create new user
        const newUser = await user.create(
          [
            {
              email,
              emailVerified: new Date(),
              name: oauthProfile.name,
              image: oauthProfile.image,
            },
          ],
          { session }
        );
        userId = newUser[0]._id.toString();

        // Create account link
        const client = await clientPromise;
        const db = client.db();
        await db.collection('nextauth_accounts').insertOne(
          {
            userId,
            type: 'oauth',
            provider,
            providerAccountId,
          },
          // @ts-ignore - MongoDB client session type mismatch
          { session }
        );
      }

      // Auto-claim profile
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
        unclaimedProfile.userId = userId;
        await unclaimedProfile.save({ session });
        console.log('Profile claimed successfully');
      }

      // Delete verification record
      await oauthVerification.deleteOne({ _id: verification._id }, { session });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

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

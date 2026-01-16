import { NextRequest, NextResponse } from 'next/server';
import {
  emailMigrationConfirmationHtml,
  emailMigrationConfirmationText,
} from '@/auth';
import dbConnect from '@/lib/connectdb';
import emailMigration from '@/lib/model/emailMigration';
import nodemailer from 'nodemailer';
import { getPrisma, getPrismaSync } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Migration token is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find migration record
    const migration = await emailMigration.findOne({
      migrationToken: token,
    });

    if (!migration) {
      return NextResponse.json(
        { error: 'Invalid migration token' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > migration.expiresAt) {
      await emailMigration.deleteOne({ _id: migration._id });
      return NextResponse.json(
        {
          error:
            'Migration link has expired. Please request a new email migration.',
        },
        { status: 400 }
      );
    }

    const { userId, oldEmail, newEmail } = migration;
    const prisma = getPrismaSync();

    // Check if new email was taken while migration was pending
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail },
    });
    if (existingUser && existingUser.id !== userId) {
      await emailMigration.deleteOne({ _id: migration._id });
      return NextResponse.json(
        { error: 'Email address is no longer available' },
        { status: 400 }
      );
    }

    // Use Prisma transaction for atomic PostgreSQL operations
    await prisma.$transaction(async (tx) => {
      // Update user email in PostgreSQL
      await tx.user.update({
        where: { id: userId },
        data: {
          email: newEmail,
          emailVerified: new Date(),
        },
      });

      // Invalidate all sessions for this user (sign out from all devices)
      await tx.session.deleteMany({
        where: { userId },
      });
    });

    // Update profile email in PostgreSQL (separate from Prisma transaction)
    const prismaAsync = await getPrisma();
    await prismaAsync.profile.updateMany({
      where: { userId },
      data: { email: newEmail },
    });

    // Delete the migration record
    await emailMigration.deleteOne({ _id: migration._id });

    // Send confirmation email to old address
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST!,
      port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_SERVER_USER!,
        pass: process.env.EMAIL_SERVER_PASSWORD!,
      },
    });

    // Send confirmation to old email (non-blocking - don't fail migration if this fails)
    transport
      .sendMail({
        from: process.env.EMAIL_FROM!,
        to: oldEmail,
        subject: 'Your Pana MIA Account Email Was Changed',
        html: emailMigrationConfirmationHtml({
          oldEmail,
          newEmail,
          timestamp,
        }),
        text: emailMigrationConfirmationText({
          oldEmail,
          newEmail,
          timestamp,
        }),
      })
      .catch((error: Error) => {
        console.error('Failed to send confirmation email:', error);
      });

    return NextResponse.json({
      success: true,
      message: 'Email migrated successfully',
      newEmail,
    });
  } catch (error) {
    console.error('Email migration completion error:', error);
    return NextResponse.json(
      { error: 'Failed to complete email migration. Please try again.' },
      { status: 500 }
    );
  }
}

export const maxDuration = 10;

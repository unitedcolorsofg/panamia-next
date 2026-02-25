import { NextRequest, NextResponse } from 'next/server';
import {
  emailMigrationConfirmationHtml,
  emailMigrationConfirmationText,
} from '@/auth';
import { db } from '@/lib/db';
import { emailMigrations, users, sessions, profiles } from '@/lib/schema';
import { and, eq, gt } from 'drizzle-orm';
import BrevoApi from '@/lib/brevo_api';

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

    // Find migration record
    const migration = await db.query.emailMigrations.findFirst({
      where: eq(emailMigrations.migrationToken, token),
    });

    if (!migration) {
      return NextResponse.json(
        { error: 'Invalid migration token' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > migration.expiresAt) {
      await db
        .delete(emailMigrations)
        .where(eq(emailMigrations.id, migration.id));
      return NextResponse.json(
        {
          error:
            'Migration link has expired. Please request a new email migration.',
        },
        { status: 400 }
      );
    }

    const { userId, oldEmail, newEmail } = migration;

    // Check if new email was taken while migration was pending
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, newEmail),
    });
    if (existingUser && existingUser.id !== userId) {
      await db
        .delete(emailMigrations)
        .where(eq(emailMigrations.id, migration.id));
      return NextResponse.json(
        { error: 'Email address is no longer available' },
        { status: 400 }
      );
    }

    // Execute atomic operations (Drizzle does not have $transaction, use sequential)
    // Update user email
    await db
      .update(users)
      .set({ email: newEmail, emailVerified: new Date() })
      .where(eq(users.id, userId));

    // Invalidate all sessions for this user
    await db.delete(sessions).where(eq(sessions.userId, userId));

    // Update profile email
    await db
      .update(profiles)
      .set({ email: newEmail })
      .where(eq(profiles.userId, userId));

    // Delete the migration record
    await db
      .delete(emailMigrations)
      .where(eq(emailMigrations.id, migration.id));

    // Send confirmation email to old address
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    // Send confirmation to old email (non-blocking - don't fail migration if this fails)
    new BrevoApi()
      .sendEmail(
        oldEmail,
        'Your Pana MIA Account Email Was Changed',
        emailMigrationConfirmationHtml({ oldEmail, newEmail, timestamp }),
        emailMigrationConfirmationText({ oldEmail, newEmail, timestamp })
      )
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

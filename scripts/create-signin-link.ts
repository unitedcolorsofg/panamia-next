#!/usr/bin/env npx tsx
/**
 * Create Sign-In Link Script
 *
 * Generates a magic sign-in link for a given email address.
 * Uses PostgreSQL verification_tokens table via Drizzle.
 *
 * Usage: npx tsx scripts/create-signin-link.ts <email>
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../lib/schema';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';
import crypto from 'crypto';

// Load environment variables from .env.local
config({ path: '.env.local' });

const { verificationTokens } = schema;
const EMAIL = process.argv[2];

async function createSignInLink() {
  if (!EMAIL) {
    console.error('❌ Error: Please provide an email address');
    console.log('Usage: npx tsx scripts/create-signin-link.ts <email>');
    process.exit(1);
  }

  if (!process.env.POSTGRES_URL) {
    console.error('❌ Error: POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client, { schema });

  try {
    console.log('Connecting to PostgreSQL...');

    // Delete any existing tokens for this email
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, EMAIL));

    // Generate a random token (similar to how NextAuth does it)
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Set expiration to 24 hours from now
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    // NextAuth v5 hashes tokens as: SHA-256(token + NEXTAUTH_SECRET)
    // When user clicks link with rawToken, NextAuth will hash it with secret and search DB
    // So we need to store: SHA-256(rawToken + NEXTAUTH_SECRET)
    const secret = process.env.NEXTAUTH_SECRET || '';
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken + secret)
      .digest('hex');

    // Create new verification token (store the HASHED token)
    await db.insert(verificationTokens).values({
      identifier: EMAIL,
      token: hashedToken,
      expires,
    });

    // Construct the sign-in URL (use the RAW token in the URL)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const signInUrl = `${baseUrl}/api/auth/callback/email?token=${rawToken}&email=${encodeURIComponent(EMAIL)}`;

    console.log('✅ New sign-in link created!\n');
    console.log('Email:', EMAIL);
    console.log('Expires:', expires.toISOString());
    console.log('\n📧 Sign-in link:');
    console.log(signInUrl);
    console.log('\nCopy and paste this URL into your browser to sign in.\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createSignInLink();

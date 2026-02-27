#!/usr/bin/env npx tsx
/**
 * Get Sign-In Token Status Script
 *
 * Checks if a verification token exists for a given email address.
 * Uses PostgreSQL verification_tokens table via Drizzle.
 *
 * NOTE: This script cannot reconstruct a sign-in URL because NextAuth
 * stores hashed tokens (SHA-256(rawToken + secret)). To create a new
 * sign-in link, use create-signin-link.ts instead.
 *
 * Usage: npx tsx scripts/get-signin-link.ts <email>
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../lib/schema';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const { verification } = schema;
const EMAIL = process.argv[2];

async function getSignInTokenStatus() {
  if (!EMAIL) {
    console.error('Error: Please provide an email address');
    console.log('Usage: npx tsx scripts/get-signin-link.ts <email>');
    process.exit(1);
  }

  if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client, { schema });

  try {
    console.log('Connecting to PostgreSQL...');

    // Find verification tokens for this email
    const tokens = await db.query.verification.findMany({
      where: eq(verification.identifier, EMAIL),
      orderBy: (vt, { desc }) => [desc(vt.expiresAt)],
    });

    if (tokens.length === 0) {
      console.log('No sign-in tokens found for:', EMAIL);
      console.log(
        '\nTo create a new sign-in link, run:\n  npx tsx scripts/create-signin-link.ts',
        EMAIL
      );
      process.exit(1);
    }

    const now = new Date();
    const validTokens = tokens.filter((t) => t.expiresAt > now);
    const expiredTokens = tokens.filter((t) => t.expiresAt <= now);

    console.log(`\nToken status for: ${EMAIL}\n`);

    if (validTokens.length > 0) {
      console.log(`[ok] ${validTokens.length} valid token(s):`);
      validTokens.forEach((t, i) => {
        console.log(`   ${i + 1}. Expires: ${t.expiresAt.toISOString()}`);
      });
    }

    if (expiredTokens.length > 0) {
      console.log(`\n[warning]  ${expiredTokens.length} expired token(s):`);
      expiredTokens.forEach((t, i) => {
        console.log(`   ${i + 1}. Expired: ${t.expiresAt.toISOString()}`);
      });
    }

    console.log('\n---');
    console.log(
      'NOTE: Stored tokens are hashed and cannot be used to reconstruct URLs.'
    );
    console.log('To create a new sign-in link, run:');
    console.log(`  npx tsx scripts/create-signin-link.ts ${EMAIL}`);
    console.log('');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

getSignInTokenStatus();

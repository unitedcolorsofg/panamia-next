#!/usr/bin/env npx tsx
/**
 * Create Sign-In Link Script
 *
 * Mints a better-auth magic-link sign-in URL for an email address, without
 * sending mail. Useful for QA on an account whose inbox you cannot read.
 *
 * Usage: npx tsx scripts/create-signin-link.ts <email> [baseUrl]
 *
 * How the token works (better-auth magicLink plugin):
 *   - The plugin's `storeToken` default is "plain" and auth.ts does not
 *     override it, so the verification row holds the RAW token. If that option
 *     ever changes to "hashed", this script must hash with
 *     base64url(SHA-256(token)) to match defaultKeyHasher.
 *   - The row is { identifier: token, value: JSON {email}, expiresAt }.
 *   - The link is {baseUrl}/api/auth/magic-link/verify?token=...&callbackURL=/
 *   - Tokens are consumed atomically on first verification: one use only.
 *
 * Expiry is the plugin default of 5 minutes, so use the link promptly.
 *
 * This script previously minted a NextAuth v5 token — SHA-256(token + secret)
 * against /api/auth/callback/email — which stopped working at the better-auth
 * migration and pointed at an endpoint that no longer exists.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../lib/schema';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';
import crypto from 'crypto';
import { createId } from '@paralleldrive/cuid2';

config({ path: '.env.local' });

const { verification } = schema;
const EMAIL = process.argv[2];
const BASE_URL =
  process.argv[3] ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

// Matches better-auth's generateRandomString(32, "a-z", "A-Z").
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
function generateToken(length = 32): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

async function createSignInLink(): Promise<void> {
  if (!EMAIL) {
    console.error('Error: Please provide an email address');
    console.log(
      'Usage: npx tsx scripts/create-signin-link.ts <email> [baseUrl]'
    );
    process.exit(1);
  }

  const connectionString =
    process.env.POSTGRES_DIRECT_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('Error: POSTGRES_DIRECT_URL or POSTGRES_URL is required');
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });

  try {
    // Say where this is going before it goes there — the connection string
    // comes from .env.local, which points at production.
    console.log(
      'Database:',
      connectionString.replace(/\/\/[^@]*@/, '//***@').split('?')[0]
    );
    console.log('Base URL:', BASE_URL);

    // Clear stale tokens for this address so an old link cannot be replayed.
    await db.delete(verification).where(eq(verification.identifier, EMAIL));

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.insert(verification).values({
      id: createId(),
      identifier: token,
      value: JSON.stringify({ email: EMAIL }),
      expiresAt,
    });

    const url = `${BASE_URL}/api/auth/magic-link/verify?token=${token}&callbackURL=${encodeURIComponent('/')}`;

    console.log('\n[ok] Sign-in link created\n');
    console.log('Email:  ', EMAIL);
    console.log('Expires:', expiresAt.toISOString(), '(5 minutes)');
    console.log('\nSign-in link:');
    console.log(url);
    console.log(
      '\nSingle use — the token is consumed on first verification.\n'
    );
  } catch (error) {
    console.error('Error:', error);
    process.exitCode = 1;
  } finally {
    await client.end({ timeout: 5 });
  }
}

createSignInLink();

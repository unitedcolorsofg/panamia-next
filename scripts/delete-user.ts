#!/usr/bin/env npx tsx
/**
 * Delete User Script
 *
 * Completely removes a user and all associated data using the shared
 * deleteAccount() executor. Admin-initiated deletions default to anonymize.
 *
 * Usage: npx tsx scripts/delete-user.ts <email>
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../lib/schema';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';
import { deleteAccount } from '../lib/server/delete-account';

// Load environment variables from .env.local
config({ path: '.env.local' });

const { users } = schema;
const USER_EMAIL = process.argv[2];

async function deleteUser() {
  if (!USER_EMAIL) {
    console.error('Error: Please provide an email address');
    console.log('Usage: npx tsx scripts/delete-user.ts <email>');
    process.exit(1);
  }

  if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client, { schema });

  try {
    console.log(`\nDeleting all data for: ${USER_EMAIL}\n`);

    // Find user first
    const user = await db.query.users.findFirst({
      where: eq(users.email, USER_EMAIL),
      columns: { id: true, email: true },
    });

    if (!user) {
      console.log('[warning] User not found');
      console.log('\n[ok] No user to delete.\n');
      return;
    }

    const result = await deleteAccount(user.id, {
      attributionChoice: 'anonymize',
      ip: 'cli-script',
    });

    if (result.success) {
      console.log(
        `\n[ok] User deletion complete! (log: ${result.deletionLogId})`
      );
      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        for (const w of result.warnings) {
          console.log(`  - ${w}`);
        }
      }
      console.log(`\nAll data for ${USER_EMAIL} has been removed.\n`);
    } else {
      console.error(`\n[error] Deletion failed: ${result.error}`);
      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        for (const w of result.warnings) {
          console.log(`  - ${w}`);
        }
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

deleteUser();

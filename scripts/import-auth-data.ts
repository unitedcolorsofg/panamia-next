#!/usr/bin/env npx tsx
/**
 * Import Auth Data to PostgreSQL Script
 *
 * This script imports authentication data exported from MongoDB
 * into PostgreSQL using Prisma. It generates new cuid IDs and
 * maintains an ID mapping for reference updates.
 *
 * Usage: npx tsx scripts/import-auth-data.ts <export-file.json>
 *
 * Example: npx tsx scripts/import-auth-data.ts scripts/auth-data-export-2024-01-15.json
 *
 * Tables populated:
 *   - users
 *   - accounts
 *   - sessions
 *   - verification_tokens
 *
 * Output: scripts/id-mapping-{timestamp}.json (MongoDB ID -> PostgreSQL ID)
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local (Next.js convention)
config({ path: '.env.local' });

// Simple cuid-like ID generator (compatible with Prisma's cuid())
function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${randomPart}${randomPart2}`.substring(0, 25);
}

interface ExportData {
  exportedAt: string;
  version: '1.0';
  counts: {
    users: number;
    accounts: number;
    sessions: number;
    verificationTokens: number;
  };
  idMapping: {
    users: Record<string, string>;
  };
  users: Array<{
    mongoId: string;
    email: string;
    emailVerified: string | null;
    screenname: string | null;
    role: string;
    createdAt: string;
    updatedAt: string;
  }>;
  accounts: Array<{
    mongoId: string;
    userMongoId: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token: string | null;
    access_token: string | null;
    expires_at: number | null;
    token_type: string | null;
    scope: string | null;
    id_token: string | null;
    session_state: string | null;
  }>;
  sessions: Array<{
    mongoId: string;
    sessionToken: string;
    userMongoId: string;
    expires: string;
  }>;
  verificationTokens: Array<{
    identifier: string;
    token: string;
    expires: string;
  }>;
}

interface IdMapping {
  createdAt: string;
  exportFile: string;
  users: Record<string, string>; // MongoDB ObjectId -> PostgreSQL cuid
  accounts: Record<string, string>;
  sessions: Record<string, string>;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      'Usage: npx tsx scripts/import-auth-data.ts <export-file.json>'
    );
    console.error(
      '\nExample: npx tsx scripts/import-auth-data.ts scripts/auth-data-export-2024-01-15.json'
    );
    process.exit(1);
  }

  const exportFilePath = args[0];
  if (!existsSync(exportFilePath)) {
    console.error(`Error: Export file not found: ${exportFilePath}`);
    process.exit(1);
  }

  // Check for DRY_RUN mode
  const isDryRun = process.env.DRY_RUN === 'true' || args.includes('--dry-run');
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No data will be written to PostgreSQL\n');
  }

  // Read export file
  console.log(`📖 Reading export file: ${exportFilePath}`);
  const exportData: ExportData = JSON.parse(
    readFileSync(exportFilePath, 'utf-8')
  );

  console.log(`   Exported at: ${exportData.exportedAt}`);
  console.log(`   Users: ${exportData.counts.users}`);
  console.log(`   Accounts: ${exportData.counts.accounts}`);
  console.log(`   Sessions: ${exportData.counts.sessions}`);
  console.log(
    `   Verification Tokens: ${exportData.counts.verificationTokens}\n`
  );

  // Initialize Prisma client
  if (!process.env.POSTGRES_URL && process.env.USE_MEMORY_POSTGRES !== 'true') {
    console.error(
      'Error: POSTGRES_URL environment variable is not set and USE_MEMORY_POSTGRES is not true'
    );
    process.exit(1);
  }

  console.log('🔌 Connecting to PostgreSQL...');

  // Support PGLite for testing the migration flow locally
  let prisma: PrismaClient;
  if (process.env.USE_MEMORY_POSTGRES === 'true') {
    console.log('   Using PGLite in-memory PostgreSQL for testing');
    const { PGlite } = await import('@electric-sql/pglite');
    const { PrismaPGlite } = await import('pglite-prisma-adapter');
    const { readFileSync, readdirSync } = await import('fs');
    const { join } = await import('path');

    // Create PGLite instance and run migrations
    const pglite = new PGlite();
    const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
    const migrations = readdirSync(migrationsDir)
      .filter((dir: string) => dir.match(/^\d{14}_/))
      .sort();

    console.log('   Running migrations...');
    for (const migration of migrations) {
      const sqlPath = join(migrationsDir, migration, 'migration.sql');
      try {
        const sql = readFileSync(sqlPath, 'utf-8');
        await pglite.exec(sql);
        console.log(`   ✓ ${migration}`);
      } catch (error) {
        console.error(`   ✗ ${migration}:`, error);
        throw error;
      }
    }

    const adapter = new PrismaPGlite(pglite);
    prisma = new PrismaClient({ adapter } as any);
  } else {
    // Prisma 7 reads URL from prisma.config.ts which uses process.env.POSTGRES_URL
    console.log(
      `   Using URL: ${process.env.POSTGRES_URL?.substring(0, 30)}...`
    );
    prisma = new PrismaClient();
  }

  // ID mapping to track MongoDB -> PostgreSQL ID transformations
  const idMapping: IdMapping = {
    createdAt: new Date().toISOString(),
    exportFile: exportFilePath,
    users: {},
    accounts: {},
    sessions: {},
  };

  try {
    // Generate new IDs for users
    console.log('\n📝 Generating new IDs for users...');
    for (const user of exportData.users) {
      idMapping.users[user.mongoId] = generateCuid();
    }
    console.log(`   Generated ${Object.keys(idMapping.users).length} user IDs`);

    // Generate new IDs for accounts
    console.log('📝 Generating new IDs for accounts...');
    for (const account of exportData.accounts) {
      idMapping.accounts[account.mongoId] = generateCuid();
    }
    console.log(
      `   Generated ${Object.keys(idMapping.accounts).length} account IDs`
    );

    // Generate new IDs for sessions
    console.log('📝 Generating new IDs for sessions...');
    for (const session of exportData.sessions) {
      idMapping.sessions[session.mongoId] = generateCuid();
    }
    console.log(
      `   Generated ${Object.keys(idMapping.sessions).length} session IDs`
    );

    if (isDryRun) {
      console.log('\n🔍 DRY RUN - Skipping database writes\n');
      console.log('Would import:');
      console.log(`   - ${exportData.users.length} users`);
      console.log(`   - ${exportData.accounts.length} accounts`);
      console.log(`   - ${exportData.sessions.length} sessions`);
      console.log(
        `   - ${exportData.verificationTokens.length} verification tokens`
      );
    } else {
      // Check if data already exists
      const existingUsers = await prisma.user.count();
      if (existingUsers > 0) {
        console.log(
          `\n⚠️  Warning: PostgreSQL already has ${existingUsers} users.`
        );
        console.log(
          '   This import will SKIP existing records (based on email).'
        );
        console.log('   To do a clean import, clear the tables first.\n');
      }

      // Import users
      console.log('\n📥 Importing users...');
      let usersCreated = 0;
      let usersSkipped = 0;

      for (const user of exportData.users) {
        try {
          await prisma.user.create({
            data: {
              id: idMapping.users[user.mongoId],
              email: user.email,
              emailVerified: user.emailVerified
                ? new Date(user.emailVerified)
                : null,
              screenname: user.screenname,
              role: user.role,
              createdAt: new Date(user.createdAt),
              updatedAt: new Date(user.updatedAt),
            },
          });
          usersCreated++;
        } catch (error: any) {
          if (error.code === 'P2002') {
            // Unique constraint violation
            usersSkipped++;
          } else {
            throw error;
          }
        }
      }
      console.log(
        `   Created: ${usersCreated}, Skipped (already exists): ${usersSkipped}`
      );

      // Import accounts
      console.log('📥 Importing accounts...');
      let accountsCreated = 0;
      let accountsSkipped = 0;

      for (const account of exportData.accounts) {
        const userId = idMapping.users[account.userMongoId];
        if (!userId) {
          console.warn(
            `   Warning: No user ID mapping for account ${account.mongoId}`
          );
          accountsSkipped++;
          continue;
        }

        try {
          await prisma.account.create({
            data: {
              id: idMapping.accounts[account.mongoId],
              userId: userId,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state,
            },
          });
          accountsCreated++;
        } catch (error: any) {
          if (error.code === 'P2002') {
            accountsSkipped++;
          } else if (error.code === 'P2003') {
            // Foreign key constraint (user doesn't exist)
            console.warn(
              `   Warning: User ${userId} doesn't exist for account ${account.mongoId}`
            );
            accountsSkipped++;
          } else {
            throw error;
          }
        }
      }
      console.log(
        `   Created: ${accountsCreated}, Skipped: ${accountsSkipped}`
      );

      // Import sessions (skip expired sessions)
      console.log('📥 Importing sessions...');
      let sessionsCreated = 0;
      let sessionsSkipped = 0;
      let sessionsExpired = 0;

      const now = new Date();
      for (const session of exportData.sessions) {
        const expires = new Date(session.expires);
        if (expires < now) {
          sessionsExpired++;
          continue;
        }

        const userId = idMapping.users[session.userMongoId];
        if (!userId) {
          console.warn(
            `   Warning: No user ID mapping for session ${session.mongoId}`
          );
          sessionsSkipped++;
          continue;
        }

        try {
          await prisma.session.create({
            data: {
              id: idMapping.sessions[session.mongoId],
              sessionToken: session.sessionToken,
              userId: userId,
              expires: expires,
            },
          });
          sessionsCreated++;
        } catch (error: any) {
          if (error.code === 'P2002') {
            sessionsSkipped++;
          } else if (error.code === 'P2003') {
            console.warn(
              `   Warning: User ${userId} doesn't exist for session ${session.mongoId}`
            );
            sessionsSkipped++;
          } else {
            throw error;
          }
        }
      }
      console.log(
        `   Created: ${sessionsCreated}, Skipped: ${sessionsSkipped}, Expired: ${sessionsExpired}`
      );

      // Import verification tokens (skip expired tokens)
      console.log('📥 Importing verification tokens...');
      let tokensCreated = 0;
      let tokensSkipped = 0;
      let tokensExpired = 0;

      for (const token of exportData.verificationTokens) {
        const expires = new Date(token.expires);
        if (expires < now) {
          tokensExpired++;
          continue;
        }

        try {
          await prisma.verificationToken.create({
            data: {
              identifier: token.identifier,
              token: token.token,
              expires: expires,
            },
          });
          tokensCreated++;
        } catch (error: any) {
          if (error.code === 'P2002') {
            tokensSkipped++;
          } else {
            throw error;
          }
        }
      }
      console.log(
        `   Created: ${tokensCreated}, Skipped: ${tokensSkipped}, Expired: ${tokensExpired}`
      );
    }

    // Write ID mapping file (always, even for dry run)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const mappingFilename = `id-mapping-${timestamp}.json`;
    const mappingFilepath = join(process.cwd(), 'scripts', mappingFilename);
    writeFileSync(mappingFilepath, JSON.stringify(idMapping, null, 2));

    console.log('\n✅ Import complete!');
    console.log(`   ID Mapping saved: scripts/${mappingFilename}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Update NextAuth to use Prisma adapter');
    console.log('   2. Test authentication flow');
    console.log(
      '   3. Use the ID mapping file to update MongoDB profile references'
    );
    console.log('\n📋 ID Mapping Summary:');
    console.log(`   Users: ${Object.keys(idMapping.users).length} mapped`);
    console.log(
      `   Accounts: ${Object.keys(idMapping.accounts).length} mapped`
    );
    console.log(
      `   Sessions: ${Object.keys(idMapping.sessions).length} mapped`
    );
  } catch (error) {
    console.error('\n❌ Error importing auth data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

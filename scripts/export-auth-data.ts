#!/usr/bin/env npx tsx
/**
 * Export MongoDB Auth Data Script
 *
 * This script exports authentication data from MongoDB collections
 * for migration to PostgreSQL. It creates a JSON file with all
 * auth-related data that can be imported by import-auth-data.ts.
 *
 * Usage: npx tsx scripts/export-auth-data.ts
 *
 * Collections exported:
 *   - nextauth_users
 *   - nextauth_accounts
 *   - nextauth_sessions
 *   - nextauth_verification_tokens
 *
 * Output: scripts/auth-data-export-{timestamp}.json
 */

import { MongoClient, ObjectId } from 'mongodb';
import { writeFileSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

interface MongoUser {
  _id: ObjectId;
  email: string;
  emailVerified?: Date | null;
  screenname?: string;
  role?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MongoAccount {
  _id: ObjectId;
  userId: ObjectId;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
}

interface MongoSession {
  _id: ObjectId;
  sessionToken: string;
  userId: ObjectId;
  expires: Date;
}

interface MongoVerificationToken {
  _id?: ObjectId;
  identifier: string;
  token: string;
  expires: Date;
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
    // MongoDB ObjectId -> PostgreSQL cuid (to be filled by import script)
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

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db();

    console.log('📤 Exporting auth data from MongoDB...\n');

    // Export users
    console.log('  Exporting users...');
    const usersCollection = db.collection<MongoUser>('nextauth_users');
    const users = await usersCollection.find({}).toArray();
    console.log(`    Found ${users.length} users`);

    // Export accounts
    console.log('  Exporting accounts...');
    const accountsCollection = db.collection<MongoAccount>('nextauth_accounts');
    const accounts = await accountsCollection.find({}).toArray();
    console.log(`    Found ${accounts.length} accounts`);

    // Export sessions
    console.log('  Exporting sessions...');
    const sessionsCollection = db.collection<MongoSession>('nextauth_sessions');
    const sessions = await sessionsCollection.find({}).toArray();
    console.log(`    Found ${sessions.length} sessions`);

    // Export verification tokens
    console.log('  Exporting verification tokens...');
    const verificationTokensCollection = db.collection<MongoVerificationToken>(
      'nextauth_verification_tokens'
    );
    const verificationTokens = await verificationTokensCollection
      .find({})
      .toArray();
    console.log(`    Found ${verificationTokens.length} verification tokens`);

    // Build export data structure
    const exportData: ExportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      counts: {
        users: users.length,
        accounts: accounts.length,
        sessions: sessions.length,
        verificationTokens: verificationTokens.length,
      },
      idMapping: {
        users: {},
      },
      users: users.map((user) => ({
        mongoId: user._id.toString(),
        email: user.email,
        emailVerified: user.emailVerified?.toISOString() || null,
        screenname: user.screenname || null,
        role: user.role || 'user',
        createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
      })),
      accounts: accounts.map((account) => ({
        mongoId: account._id.toString(),
        userMongoId: account.userId.toString(),
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: account.refresh_token || null,
        access_token: account.access_token || null,
        expires_at: account.expires_at || null,
        token_type: account.token_type || null,
        scope: account.scope || null,
        id_token: account.id_token || null,
        session_state: account.session_state || null,
      })),
      sessions: sessions.map((session) => ({
        mongoId: session._id.toString(),
        sessionToken: session.sessionToken,
        userMongoId: session.userId.toString(),
        expires: session.expires.toISOString(),
      })),
      verificationTokens: verificationTokens.map((token) => ({
        identifier: token.identifier,
        token: token.token,
        expires: token.expires.toISOString(),
      })),
    };

    // Write to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `auth-data-export-${timestamp}.json`;
    const filepath = join(process.cwd(), 'scripts', filename);

    writeFileSync(filepath, JSON.stringify(exportData, null, 2));

    console.log('\n✅ Export complete!');
    console.log(`   File: scripts/${filename}`);
    console.log('\n📊 Summary:');
    console.log(`   - Users: ${exportData.counts.users}`);
    console.log(`   - Accounts: ${exportData.counts.accounts}`);
    console.log(`   - Sessions: ${exportData.counts.sessions}`);
    console.log(
      `   - Verification Tokens: ${exportData.counts.verificationTokens}`
    );
    console.log(
      '\n💡 Next step: Run import-auth-data.ts with this file to import to PostgreSQL'
    );
  } catch (error) {
    console.error('Error exporting auth data:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();

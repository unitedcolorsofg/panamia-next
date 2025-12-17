require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const USER_EMAIL = process.argv[2];
const MONGODB_URI = process.env.MONGODB_URI;

async function deleteUser() {
  if (!USER_EMAIL) {
    console.error('❌ Error: Please provide an email address');
    console.log('Usage: node scripts/delete-user.js <email>');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected successfully!');

    const db = client.db();

    console.log(`\n🗑️  Deleting all data for: ${USER_EMAIL}\n`);

    // Delete from NextAuth collections
    const nextAuthCollections = [
      'nextauth_accounts',
      'nextauth_sessions',
      'nextauth_users',
      'nextauth_verification_tokens'
    ];

    for (const collectionName of nextAuthCollections) {
      const collection = db.collection(collectionName);

      // For verification_tokens, delete by identifier
      if (collectionName === 'nextauth_verification_tokens') {
        const result = await collection.deleteMany({ identifier: USER_EMAIL });
        console.log(`✓ ${collectionName}: deleted ${result.deletedCount} document(s)`);
      }
      // For other NextAuth collections, we need to find the user ID first
      else if (collectionName === 'nextauth_users') {
        const user = await collection.findOne({ email: USER_EMAIL });
        if (user) {
          const userId = user._id.toString();

          // Delete user
          await collection.deleteOne({ email: USER_EMAIL });
          console.log(`✓ ${collectionName}: deleted user`);

          // Delete sessions for this user
          const sessionsResult = await db.collection('nextauth_sessions').deleteMany({ userId });
          console.log(`✓ nextauth_sessions: deleted ${sessionsResult.deletedCount} session(s)`);

          // Delete accounts for this user
          const accountsResult = await db.collection('nextauth_accounts').deleteMany({ userId });
          console.log(`✓ nextauth_accounts: deleted ${accountsResult.deletedCount} account(s)`);
        } else {
          console.log(`⚠ ${collectionName}: user not found`);
        }
      }
    }

    // Delete from app collections
    const usersResult = await db.collection('users').deleteMany({ email: USER_EMAIL });
    console.log(`✓ users: deleted ${usersResult.deletedCount} document(s)`);

    const profilesResult = await db.collection('profiles').deleteMany({ email: USER_EMAIL });
    console.log(`✓ profiles: deleted ${profilesResult.deletedCount} document(s)`);

    console.log('\n✅ User deletion complete!');
    console.log(`All data for ${USER_EMAIL} has been removed from the database.`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed.');
  }
}

deleteUser();

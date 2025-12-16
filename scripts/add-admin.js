require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const ADMIN_EMAIL = process.argv[2];
const MONGODB_URI = process.env.MONGODB_URI;

async function addAdmin() {
  if (!ADMIN_EMAIL) {
    console.error('❌ Error: Please provide an email address');
    console.log('Usage: node scripts/add-admin.js <email>');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected successfully!');

    const db = client.db();

    // Update or create User with admin role
    console.log(`\nSetting up user: ${ADMIN_EMAIL}`);
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOneAndUpdate(
      { email: ADMIN_EMAIL },
      {
        $set: {
          email: ADMIN_EMAIL,
          'status.role': 'admin',
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    console.log('✓ User updated/created with admin role');

    // Check if profile exists and update active status
    console.log(`\nChecking profile for: ${ADMIN_EMAIL}`);
    const profilesCollection = db.collection('profiles');
    const profile = await profilesCollection.findOne({ email: ADMIN_EMAIL });

    if (profile) {
      await profilesCollection.updateOne(
        { email: ADMIN_EMAIL },
        { $set: { active: true } }
      );
      console.log('✓ Profile marked as active');
      console.log(`  Profile name: ${profile.name}`);
      console.log(`  Profile slug: ${profile.slug || 'Not set'}`);
    } else {
      console.log(
        '⚠ No profile found - user will need to create a profile through the UI'
      );
    }

    console.log('\n✅ Admin setup complete!');
    console.log(`\nUser ${ADMIN_EMAIL} is now:`);
    console.log('  - Admin role: ✓');
    console.log(`  - Profile active: ${profile ? '✓' : 'N/A (no profile)'}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed.');
  }
}

addAdmin();

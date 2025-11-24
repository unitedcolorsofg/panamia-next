require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

// Import models
const User = require('../pages/api/auth/lib/model/user').default;
const Profile = require('../pages/api/auth/lib/model/profile').default;

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.argv[2];

async function addAdmin() {
  if (!ADMIN_EMAIL) {
    console.error('❌ Error: Please provide an email address');
    console.log('Usage: node scripts/add-admin.js <email>');
    process.exit(1);
  }
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!');

    // Update or create User with admin role
    console.log(`\nSetting up user: ${ADMIN_EMAIL}`);
    const user = await User.findOneAndUpdate(
      { email: ADMIN_EMAIL },
      {
        $set: {
          email: ADMIN_EMAIL,
          'status.role': 'admin',
        },
      },
      { upsert: true, new: true }
    );
    console.log('✓ User updated/created with admin role');

    // Check if profile exists and update active status
    console.log(`\nChecking profile for: ${ADMIN_EMAIL}`);
    const profile = await Profile.findOne({ email: ADMIN_EMAIL });

    if (profile) {
      profile.active = true;
      await profile.save();
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
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

addAdmin();

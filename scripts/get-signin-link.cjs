require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const EMAIL = process.argv[2];
const Schema = mongoose.Schema;

// Define VerificationToken schema (NextAuth)
const verificationTokenSchema = new Schema({
  identifier: String,
  token: String,
  expires: Date,
});

const VerificationToken =
  mongoose.models.nextauth_verification_tokens ||
  mongoose.model(
    'nextauth_verification_tokens',
    verificationTokenSchema,
    'nextauth_verification_tokens'
  );

const MONGODB_URI = process.env.MONGODB_URI;

async function getSignInLink() {
  if (!EMAIL) {
    console.error('❌ Error: Please provide an email address');
    console.log('Usage: node scripts/get-signin-link.js <email>');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!\n');

    // Find the most recent verification token for this email
    const token = await VerificationToken.findOne({ identifier: EMAIL })
      .sort({ expires: -1 })
      .exec();

    if (!token) {
      console.log('❌ No sign-in token found for:', EMAIL);
      console.log(
        '\nPlease try signing in through the UI first, then run this script again.'
      );
      process.exit(1);
    }

    // Check if token is expired
    const now = new Date();
    if (token.expires < now) {
      console.log('⚠️  Token has expired at:', token.expires);
      console.log('Please request a new sign-in link from the UI.\n');
      process.exit(1);
    }

    // Construct the sign-in URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const signInUrl = `${baseUrl}/api/auth/callback/email?token=${token.token}&email=${encodeURIComponent(EMAIL)}`;

    console.log('✅ Sign-in link found!\n');
    console.log('Email:', EMAIL);
    console.log('Expires:', token.expires);
    console.log('\n📧 Sign-in link:');
    console.log(signInUrl);
    console.log('\nCopy and paste this URL into your browser to sign in.\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

getSignInLink();

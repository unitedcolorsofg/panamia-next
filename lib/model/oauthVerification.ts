import { Schema, model, models } from 'mongoose';

const oauthVerificationSchema = new Schema({
  email: { type: String, required: true, lowercase: true, index: true },
  provider: { type: String, required: true },
  providerAccountId: { type: String, required: true },
  verificationToken: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  expiresAt: { type: Date, required: true }, // TTL index defined below
  createdAt: { type: Date, default: Date.now },
  // Store OAuth profile data to create account after verification
  oauthProfile: { type: Schema.Types.Mixed, required: true },
});

// Auto-delete expired verifications
oauthVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for finding pending verifications
oauthVerificationSchema.index({ provider: 1, providerAccountId: 1 });

const OAuthVerification =
  models.OAuthVerification ||
  model('OAuthVerification', oauthVerificationSchema);

export default OAuthVerification;

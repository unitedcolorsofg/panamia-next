import mongoose from 'mongoose';
const Schema = mongoose.Schema;

/**
 * Notification preferences schema
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * See: lib/database/sql/accounts.ts for email preferences pattern
 */
const notificationPreferencesSchema = new Schema(
  {
    coauthorInvites: { type: Boolean, default: true },
    reviewRequests: { type: Boolean, default: true },
    articlePublished: { type: Boolean, default: true },
    articleReplies: { type: Boolean, default: true },
    revisionNeeded: { type: Boolean, default: true },
    mentoringRequests: { type: Boolean, default: true },
    systemAnnouncements: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    screenname: String,
    name: String,
    status: {
      role: String,
      locked: Date,
    },
    affiliate: {},
    alternate_emails: [],
    zip_code: String,
    following: [],
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Case-insensitive unique index for screenname
userSchema.index(
  { screenname: 1 },
  {
    unique: true,
    sparse: true,
    collation: { locale: 'en', strength: 2 },
  }
);

const user = mongoose.models.user || mongoose.model('user', userSchema);
export default user;

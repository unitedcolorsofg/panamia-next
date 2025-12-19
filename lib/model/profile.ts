import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const profileSchema = new Schema(
  {
    userId: {
      type: String,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    slug: String,
    active: Boolean,
    status: {},
    administrative: {},
    locally_based: String,
    details: String,
    background: String,
    five_words: {
      type: String,
      required: true,
      index: true,
    },
    socials: {},
    phone_number: String,
    whatsapp_community: Boolean,
    pronouns: {},
    tags: String,
    hearaboutus: String,
    affiliate: String,
    counties: {},
    categories: {},
    primary_address: {},
    gentedepana: {},
    geo: {},
    locations: [],
    images: {},
    linked_profiles: [],
    mentoring: {
      enabled: { type: Boolean, default: false },
      expertise: [String], // Tags like "JavaScript", "Career Advice", etc.
      languages: [String], // ["English", "Spanish"]
      bio: String, // Mentoring-specific bio
      videoIntroUrl: String, // Optional video introduction
      goals: String, // What they want to achieve as mentor/mentee
      hourlyRate: Number, // Optional, 0 for free mentoring
    },
    availability: {
      timezone: String, // e.g., "America/New_York"
      schedule: [
        {
          day: {
            type: String,
            enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
          },
          startTime: String, // "09:00"
          endTime: String, // "17:00"
        },
      ],
    },
    pusherChannelId: String, // Unique identifier for user's Pusher channel
    verification: {
      panaVerified: { type: Boolean, default: false }, // Social verification (not identity)
      legalAgeVerified: { type: Boolean, default: false }, // Legal age verification
      verifiedOn: Date, // Date of verification
      verifiedBy: String, // Admin who verified (email or userId)
    },
    roles: {
      mentoringModerator: { type: Boolean, default: false }, // Moderator for mentoring section
      eventOrganizer: { type: Boolean, default: false }, // Can organize events
      contentModerator: { type: Boolean, default: false }, // Can moderate content
    },
  },
  {
    timestamps: true,
  }
);

const profile =
  mongoose.models.profile || mongoose.model('profile', profileSchema);

export default profile;

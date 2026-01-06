import mongoose from 'mongoose';

/**
 * Session Types:
 * - artistic: Creative consultation (draft poem, art critique, music feedback)
 * - knowledge_transfer: Business advice, career guidance, technical skills
 * - panamia_planning: Pana MIA community planning (always free)
 * - pana_support: True peer mentoring - personal support and comradery
 */
export const SESSION_TYPES = [
  'artistic',
  'knowledge_transfer',
  'panamia_planning',
  'pana_support',
] as const;

export type SessionType = (typeof SESSION_TYPES)[number];

const sessionSchema = new mongoose.Schema(
  {
    mentorEmail: { type: String, required: true, index: true },
    menteeEmail: { type: String, required: true, index: true },
    mentorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      index: true,
    },
    menteeUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      index: true,
    },
    scheduledAt: { type: Date, required: true, index: true },
    duration: { type: Number, required: true, default: 60 }, // minutes
    topic: { type: String, required: true },
    sessionType: {
      type: String,
      enum: SESSION_TYPES,
      required: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'scheduled',
        'in_progress',
        'completed',
        'cancelled',
        'declined',
      ],
      default: 'pending',
    },
    sessionId: { type: String, required: true, unique: true }, // Used as Pusher channel
    notes: { type: String }, // Collaborative notes
    completedAt: Date,
    cancelledAt: Date,
    cancelledBy: String, // Email of user who cancelled
    cancelReason: String,
    declinedAt: Date,
    declinedBy: String, // Email of mentor who declined
    declineReason: String,
  },
  {
    timestamps: true,
    collection: 'mentorSessions', // Explicitly set collection name
  }
);

// Indexes for efficient queries
sessionSchema.index({ mentorEmail: 1, scheduledAt: -1 });
sessionSchema.index({ menteeEmail: 1, scheduledAt: -1 });
// Note: sessionId index is created automatically via unique: true

const mentorSession =
  mongoose.models.mentorSession ||
  mongoose.model('mentorSession', sessionSchema);

export default mentorSession;

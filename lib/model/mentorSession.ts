import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    mentorEmail: { type: String, required: true, index: true },
    menteeEmail: { type: String, required: true, index: true },
    scheduledAt: { type: Date, required: true, index: true },
    duration: { type: Number, required: true, default: 60 }, // minutes
    topic: { type: String, required: true },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    sessionId: { type: String, required: true, unique: true }, // Used as Pusher channel
    notes: { type: String }, // Collaborative notes
    completedAt: Date,
    cancelledAt: Date,
    cancelledBy: String, // Email of user who cancelled
    cancelReason: String,
  },
  { timestamps: true }
);

// Indexes for efficient queries
sessionSchema.index({ mentorEmail: 1, scheduledAt: -1 });
sessionSchema.index({ menteeEmail: 1, scheduledAt: -1 });
sessionSchema.index({ sessionId: 1 });

const mentorSession =
  mongoose.models.mentorSession ||
  mongoose.model('mentorSession', sessionSchema);

export default mentorSession;

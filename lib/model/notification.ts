/**
 * Notification Schema
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * See: lib/database/types/ for comparable patterns
 *
 * This schema is intentionally "ActivityPub-shaped" to enable
 * future federation without schema migration.
 *
 * ActivityPub Activity Types: https://www.w3.org/TR/activitystreams-vocabulary/#activity-types
 */

import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// ActivityPub-compatible activity types
// See: https://www.w3.org/TR/activitystreams-vocabulary/#activity-types
export type NotificationActivityType =
  | 'Invite' // Co-author/reviewer invitation
  | 'Accept' // Invitation accepted
  | 'Reject' // Invitation declined
  | 'Create' // Article published, comment added
  | 'Update' // Revision requested, article updated
  | 'Delete' // Content removed
  | 'Announce' // Boost/share (future)
  | 'Like' // Favorite (future)
  | 'Follow' // User followed (future)
  | 'Undo'; // Undo previous action

// Pana MIA-specific context for the activity
export type NotificationContext =
  | 'coauthor' // Co-authorship workflow
  | 'review' // Peer review workflow
  | 'article' // Article lifecycle
  | 'mentoring' // Mentoring sessions
  | 'mention' // User mentioned (future)
  | 'follow' // Follow relationship (future)
  | 'system'; // System announcements

export interface INotification {
  _id: string;
  // ActivityPub-compatible core fields
  type: NotificationActivityType;
  actor: mongoose.Types.ObjectId; // Who triggered this (→ AS2 actor)
  object?: mongoose.Types.ObjectId; // What it's about (→ AS2 object)
  target: mongoose.Types.ObjectId; // Who receives this (→ AS2 target)

  // Pana MIA context
  context: NotificationContext;

  // Denormalized data for display (avoids extra queries)
  actorScreenname?: string;
  actorName?: string;
  objectType?: 'article' | 'profile' | 'session' | 'comment';
  objectTitle?: string;
  objectUrl?: string;
  message?: string; // Personal message (invitation text)

  // State
  read: boolean;
  readAt?: Date;

  // Email notification tracking
  emailSent: boolean;
  emailSentAt?: Date;
  emailPreferenceKey?: string; // Which preference controls this

  // Retention
  expiresAt?: Date; // TTL for auto-cleanup

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema(
  {
    // Core ActivityPub-shaped fields
    type: {
      type: String,
      required: true,
      enum: [
        'Invite',
        'Accept',
        'Reject',
        'Create',
        'Update',
        'Delete',
        'Announce',
        'Like',
        'Follow',
        'Undo',
      ],
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      index: true,
    },
    object: {
      type: Schema.Types.ObjectId,
      refPath: 'objectType',
    },
    target: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      index: true,
    },

    // Context
    context: {
      type: String,
      required: true,
      enum: [
        'coauthor',
        'review',
        'article',
        'mentoring',
        'mention',
        'follow',
        'system',
      ],
      index: true,
    },

    // Denormalized display data
    actorScreenname: String,
    actorName: String,
    objectType: {
      type: String,
      enum: ['article', 'profile', 'session', 'comment'],
    },
    objectTitle: String,
    objectUrl: String,
    message: String,

    // State
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: Date,

    // Email tracking
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: Date,
    emailPreferenceKey: String,

    // Retention (TTL index)
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
notificationSchema.index({ target: 1, read: 1, createdAt: -1 });
notificationSchema.index({ target: 1, context: 1, createdAt: -1 });

// TTL index for auto-cleanup of expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const notification =
  mongoose.models.notification ||
  mongoose.model('notification', notificationSchema);

export default notification;

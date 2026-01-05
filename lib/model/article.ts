/**
 * Article Model
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Schema designed for future ActivityPub federation as Note/Article objects
 */

import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const reviewCommentSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    contentRef: String,
    resolved: { type: Boolean, default: false },
    resolvedAt: Date,
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const reviewChecklistSchema = new Schema(
  {
    factsVerified: { type: Boolean, default: false },
    sourcesChecked: { type: Boolean, default: false },
    communityStandards: { type: Boolean, default: false },
  },
  { _id: false }
);

const reviewRecordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    requestedAt: { type: Date, default: Date.now },
    invitationMessage: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'revision_needed'],
      default: 'pending',
    },
    checklist: { type: reviewChecklistSchema, default: () => ({}) },
    comments: [reviewCommentSchema],
    approvedAt: Date,
  },
  { _id: false }
);

const coAuthorSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    invitedAt: { type: Date, default: Date.now },
    invitationMessage: String,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
    acceptedAt: Date,
  },
  { _id: false }
);

const articleSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
    },
    excerpt: {
      type: String,
      maxlength: 500,
    },
    coverImage: String,

    // Classification
    articleType: {
      type: String,
      enum: ['business_update', 'community_commentary'],
      required: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },

    // Attribution
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      index: true,
    },
    coAuthors: [coAuthorSchema],
    reviewedBy: reviewRecordSchema,

    // Threading
    inReplyTo: {
      type: Schema.Types.ObjectId,
      ref: 'article',
      index: true,
    },

    // Workflow
    status: {
      type: String,
      enum: [
        'draft',
        'pending_review',
        'revision_needed',
        'published',
        'removed',
      ],
      default: 'draft',
      index: true,
    },
    publishedAt: {
      type: Date,
      index: true,
    },
    removedAt: Date,
    removedBy: { type: Schema.Types.ObjectId, ref: 'user' },
    removalReason: String,

    // Metadata
    readingTime: {
      type: Number,
      default: 1,
    },

    // Mastodon comments integration
    // URL to the Mastodon post that announced this article
    // Replies to this post will be displayed as comments
    mastodonPostUrl: {
      type: String,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ authorId: 1, status: 1 });
articleSchema.index({ 'coAuthors.userId': 1, status: 1 });

const article =
  mongoose.models.article || mongoose.model('article', articleSchema);
export default article;

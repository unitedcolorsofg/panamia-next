# Notifications System Roadmap

This document outlines the implementation plan for Pana MIA's in-app notification system, designed to be **ActivityPub-compatible from the start** for future federation.

---

## Upstream Reference

> **IMPORTANT**: This implementation is designed to align with [llun/activities.next](https://github.com/llun/activities.next), a Next.js-native ActivityPub server.
>
> When implementing notification features, always check activities.next for:
>
> - Database schema patterns (`lib/database/`)
> - ActivityPub activity types (`lib/activities/`)
> - Job queue patterns (`lib/jobs/`)
>
> The goal is to enable future integration or migration to a federated architecture.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         panamia.club                                │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Notification System (Phase 1 - Now)                          │ │
│  │  - MongoDB collection with ActivityPub-shaped schema          │ │
│  │  - Flower button UI in header                                 │ │
│  │  - Co-author/review workflows                                 │ │
│  │  - Email notifications via Brevo                              │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              ↑                                      │
│                       Internal events                               │
│                              ↓                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Federation Bridge (Phase 2 - Later)                          │ │
│  │  - Translate internal notifications → ActivityPub Activities  │ │
│  │  - Import ActivityPub Activities → internal notifications     │ │
│  │  - Connect to activities.next sidecar                         │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              ↕
               (future: federation via ActivityPub)
                              ↕
┌─────────────────────────────────────────────────────────────────────┐
│                  social.panamia.club (Phase 2)                      │
│                  activities.next instance                           │
│                  - Full ActivityPub federation                      │
│                  - Mastodon-compatible                              │
│                  - Article comments from Fediverse                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Design Principles

### 1. ActivityPub-Shaped Schema

Internal notification types map directly to [ActivityPub Activity Types](https://www.w3.org/TR/activitystreams-vocabulary/#activity-types):

| Pana MIA Event     | ActivityPub Activity | Description                   |
| ------------------ | -------------------- | ----------------------------- |
| Co-author invite   | `Invite`             | Invite someone to collaborate |
| Invite accepted    | `Accept`             | Accept an invitation          |
| Invite declined    | `Reject`             | Decline an invitation         |
| Article published  | `Create`             | Create new content            |
| Revision requested | `Update`             | Request changes               |
| Article boosted    | `Announce`           | Share/repost content          |
| Article liked      | `Like`               | Favorite content              |
| User followed      | `Follow`             | Follow an actor               |

### 2. Actor Model Compatibility

Users are treated as "Actors" with:

- Unique identifier (userId/screenname)
- Public profile URL
- Potential federated address (`@user@panamia.club`)

### 3. Object References

All notifications reference:

- **Actor**: Who triggered the notification
- **Object**: What the notification is about (article, profile, etc.)
- **Target**: Who receives the notification

This mirrors ActivityPub's Actor → Activity → Object model.

---

## Data Model

### Notification Schema

```typescript
/**
 * Notification Schema
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * See: lib/database/types/ for comparable patterns
 *
 * This schema is intentionally "ActivityPub-shaped" to enable
 * future federation without schema migration.
 */

import { Schema, model, models, Document, Types } from 'mongoose';

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
  | 'mention' // User mentioned (future)
  | 'follow' // Follow relationship (future)
  | 'system'; // System announcements

export interface INotification extends Document {
  // ActivityPub-compatible core fields
  type: NotificationActivityType;
  actor: Types.ObjectId; // Who triggered this (→ AS2 actor)
  object?: Types.ObjectId; // What it's about (→ AS2 object)
  target: Types.ObjectId; // Who receives this (→ AS2 target)

  // Pana MIA context
  context: NotificationContext;

  // Denormalized data for display (avoids extra queries)
  actorScreenname?: string;
  objectType?: 'article' | 'profile' | 'comment';
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

const notificationSchema = new Schema<INotification>(
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
      enum: ['coauthor', 'review', 'article', 'mention', 'follow', 'system'],
      index: true,
    },

    // Denormalized display data
    actorScreenname: String,
    objectType: {
      type: String,
      enum: ['article', 'profile', 'comment'],
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

export const Notification =
  models.notification ||
  model<INotification>('notification', notificationSchema);
```

### User Schema Additions

```typescript
/**
 * Add to existing user model
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * See: lib/database/sql/accounts.ts for email preferences pattern
 */

interface UserNotificationPreferences {
  // Article workflow
  coauthorInvites: boolean; // Default: true
  reviewRequests: boolean; // Default: true
  articlePublished: boolean; // Default: true
  revisionNeeded: boolean; // Default: true

  // Social (future)
  newFollower: boolean; // Default: true
  articleReplies: boolean; // Default: true
  mentions: boolean; // Default: true

  // System
  systemAnnouncements: boolean; // Default: true
}
```

---

## Retention Policy

| Notification Type                  | Read Retention | Unread Retention |
| ---------------------------------- | -------------- | ---------------- |
| Invitations (Invite/Accept/Reject) | Indefinite     | Indefinite       |
| Article lifecycle (Create/Update)  | 90 days        | Indefinite       |
| Social (Like/Follow/Announce)      | 30 days        | 90 days          |
| System announcements               | 30 days        | 90 days          |

Implemented via MongoDB TTL index on `expiresAt` field. Set at creation time based on notification type.

---

## Implementation Phases

### Phase 1: Core Notification System

**Status**: 📋 Planned

Build the foundation that articles, mentoring, and future features will use.

#### Files to Create

| File                                           | Purpose                 |
| ---------------------------------------------- | ----------------------- |
| `lib/model/notification.ts`                    | Mongoose schema (above) |
| `lib/notifications.ts`                         | Helper functions        |
| `app/api/notifications/route.ts`               | List notifications      |
| `app/api/notifications/unread-count/route.ts`  | Badge count             |
| `app/api/notifications/[id]/read/route.ts`     | Mark as read            |
| `app/api/notifications/mark-all-read/route.ts` | Mark all read           |
| `app/account/notifications/page.tsx`           | Full history page       |
| `components/NotificationFlower.tsx`            | Header button           |
| `components/NotificationDropdown.tsx`          | Quick view dropdown     |
| `components/NotificationItem.tsx`              | Individual notification |

#### Helper Functions

```typescript
/**
 * lib/notifications.ts
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * See: lib/activities/actions/ for comparable patterns
 */

import {
  Notification,
  NotificationActivityType,
  NotificationContext,
} from './model/notification';
import { sendEmail } from './brevo_api';
import user from './model/user';

interface CreateNotificationParams {
  type: NotificationActivityType;
  actor: string; // userId
  target: string; // userId
  context: NotificationContext;
  object?: string; // objectId
  objectType?: 'article' | 'profile' | 'comment';
  objectTitle?: string;
  objectUrl?: string;
  message?: string;
}

/**
 * Create a notification and optionally send email
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Maps to ActivityPub Activity creation pattern
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  // Get actor screenname for denormalization
  const actorUser = await user.findById(params.actor).select('screenname');

  // Determine expiration based on type
  const expiresAt = getExpirationDate(params.type, params.context);

  // Create notification
  const notification = await Notification.create({
    ...params,
    actorScreenname: actorUser?.screenname,
    read: false,
    emailSent: false,
    expiresAt,
  });

  // Check email preferences and send if enabled
  await maybeSendNotificationEmail(notification);
}

/**
 * Determine notification expiration based on type
 */
function getExpirationDate(
  type: NotificationActivityType,
  context: NotificationContext
): Date | undefined {
  // Invitations never expire (audit trail)
  if (type === 'Invite' || type === 'Accept' || type === 'Reject') {
    return undefined;
  }

  // System announcements expire after 30 days
  if (context === 'system') {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  // Article lifecycle expires after 90 days
  if (context === 'article' || context === 'coauthor' || context === 'review') {
    return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  }

  // Social expires after 30 days
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}
```

#### API Endpoints

| Endpoint                           | Method | Description                    |
| ---------------------------------- | ------ | ------------------------------ |
| `/api/notifications`               | GET    | List notifications (paginated) |
| `/api/notifications/unread-count`  | GET    | Get unread count for badge     |
| `/api/notifications/[id]/read`     | POST   | Mark single as read            |
| `/api/notifications/mark-all-read` | POST   | Mark all as read               |

#### Components

| Component                  | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `NotificationFlower.tsx`   | Pana flower button in header with unread badge |
| `NotificationDropdown.tsx` | Dropdown showing recent notifications          |
| `NotificationItem.tsx`     | Individual notification with icon, text, time  |
| `NotificationList.tsx`     | Full paginated list for account page           |

#### UI/UX

The notification flower button:

- Displays in header next to theme toggle
- Shows unread count badge (red dot or number)
- Clicking opens dropdown with recent notifications
- "View all" links to `/account/notifications`
- Polling every 30 seconds for unread count (no WebSocket needed)

---

### Phase 2: Federation Bridge (Future)

**Status**: 📋 Future

Connect internal notifications to ActivityPub ecosystem.

#### Option A: activities.next Sidecar

Deploy [activities.next](https://github.com/llun/activities.next) as `social.panamia.club`:

```
panamia.club                    social.panamia.club
     ↓                                ↑
Article published ──────────→ Create Note activity
     ↓                                ↓
Fediverse reply  ←──────────── Inbox receives reply
     ↓                                ↓
Show as comment                Stored in activities.next
```

#### Option B: Native ActivityPub

Implement ActivityPub directly in Pana MIA using patterns from activities.next:

- WebFinger endpoint (`/.well-known/webfinger`)
- Actor endpoints (`/users/[screenname]`)
- Inbox/Outbox handlers
- HTTP Signatures

**Recommendation**: Start with Option A (sidecar) for faster iteration, migrate to Option B if needed for tighter integration.

---

### Phase 3: Lists Alignment (Future)

**Status**: 📋 Future

The current `userlist` model can be aligned with ActivityPub Collections:

| Current Field | ActivityPub Equivalent          |
| ------------- | ------------------------------- |
| `user_id`     | `attributedTo` (owner)          |
| `name`        | `name`                          |
| `desc`        | `summary`                       |
| `public`      | `to: public` vs `to: followers` |
| `profiles[]`  | `items[]` (OrderedCollection)   |

**UPSTREAM REFERENCE**: See activities.next `lib/database/sql/` for Collection patterns.

---

## Code Comment Standard

All notification-related code MUST include upstream reference comments:

```typescript
/**
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * See: [specific file path] for comparable pattern
 *
 * This [component/function/schema] is designed to align with
 * activities.next for future ActivityPub federation.
 */
```

---

## Dependencies

### Required (Already in project)

- MongoDB / Mongoose
- NextAuth (user context)
- Nodemailer / Brevo (email)

### New Dependencies

| Package | Purpose                     | Phase |
| ------- | --------------------------- | ----- |
| None    | Phase 1 uses existing stack | 1     |

### Future Dependencies

| Package           | Purpose                | Phase         |
| ----------------- | ---------------------- | ------------- |
| `activities.next` | Federation sidecar     | 2             |
| `http-signature`  | ActivityPub signatures | 2 (if native) |

---

## Revision History

| Date       | Change                                                     |
| ---------- | ---------------------------------------------------------- |
| 2024-12-29 | Initial roadmap created with ActivityPub-compatible design |

# Community Articles Feature Roadmap

This document outlines the staged implementation plan for adding WordPress-like community article functionality to Pana MIA.

> **Related Documentation**:
>
> - [NOTIFICATIONS-ROADMAP.md](./NOTIFICATIONS-ROADMAP.md) - In-app notification system (prerequisite)
> - [FEATURES.md](./FEATURES.md) - Platform feature overview
>
> **Upstream Reference**: [llun/activities.next](https://github.com/llun/activities.next) - Next.js ActivityPub server for future federation

## Overview

Community articles enable users to publish content with collaborative authorship and peer review. Key differentiators:

- **Collaborative requirement**: Articles must have at least one co-author OR be reviewed by another user
- **Reviewer accountability**: Reviewers attest to factual accuracy (not lazy sign-offs)
- **Article threading**: Articles can be "in reply to" other articles
- **No pre-publication approval**: Section 230 compliance; admins can only remove post-publication

---

## Core Concepts

### Article Types

| Type                     | Purpose                                | Example                            |
| ------------------------ | -------------------------------------- | ---------------------------------- |
| **Business Update**      | Self-promotional content (encouraged!) | "New menu items at our restaurant" |
| **Community Commentary** | Opinion, analysis, local interest      | "The State of Miami's Music Scene" |

### Account Types

| Type               | Description                                     |
| ------------------ | ----------------------------------------------- |
| **Small Business** | Local business promoting products/services      |
| **Personal**       | Individual community member                     |
| **Hybrid**         | Business owner who also writes personal content |
| **Other**          | Organizations, non-profits, etc.                |

### Workflow States

| Status            | Description                                     |
| ----------------- | ----------------------------------------------- |
| `draft`           | Author(s) editing, not visible to public        |
| `pending_review`  | Awaiting reviewer approval                      |
| `revision_needed` | Reviewer requested changes, returned to authors |
| `published`       | Live, visible to public                         |
| `removed`         | Admin-removed (soft delete, retained for audit) |

---

## Data Models

### Article Schema

```typescript
interface Article {
  _id: ObjectId;
  slug: string; // URL-safe unique identifier

  // Content
  title: string;
  content: string; // Markdown (Tiptap JSON in future)
  excerpt: string; // Manual or auto-generated
  coverImage?: string; // BunnyCDN URL

  // Classification
  articleType: 'business_update' | 'community_commentary';
  tags: string[];

  // Attribution
  authorId: ObjectId; // Primary author
  coAuthors: CoAuthor[];
  reviewedBy?: ReviewRecord;

  // Threading
  inReplyTo?: ObjectId; // Parent article reference

  // Workflow
  status:
    | 'draft'
    | 'pending_review'
    | 'revision_needed'
    | 'published'
    | 'removed';
  publishedAt?: Date;
  removedAt?: Date;
  removedBy?: ObjectId;
  removalReason?: string;

  // Metadata
  readingTime: number; // Computed from content

  timestamps: true; // createdAt, updatedAt
}

interface CoAuthor {
  userId: ObjectId;
  invitedAt: Date;
  invitationMessage?: string; // Personal note from author
  status: 'pending' | 'accepted' | 'declined';
  acceptedAt?: Date;
}

interface ReviewRecord {
  userId: ObjectId;
  requestedAt: Date;
  invitationMessage?: string; // Context for reviewer
  status: 'pending' | 'approved' | 'revision_needed';
  checklist: ReviewChecklist;
  comments: ReviewComment[];
  approvedAt?: Date;
}

interface ReviewChecklist {
  factsVerified: boolean;
  sourcesChecked: boolean;
  communityStandards: boolean;
}

interface ReviewComment {
  id: string;
  text: string;
  contentRef?: string; // Reference to flagged content (like {{citation_needed}})
  createdAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
}
```

### Notification Schema

> **See [NOTIFICATIONS-ROADMAP.md](./NOTIFICATIONS-ROADMAP.md)** for the full ActivityPub-compatible notification schema.
>
> The notification system uses ActivityPub Activity types (`Invite`, `Accept`, `Create`, etc.) to enable future federation with [activities.next](https://github.com/llun/activities.next).

Article-specific notification contexts:

| Event               | ActivityPub Type | Context    |
| ------------------- | ---------------- | ---------- |
| Co-author invited   | `Invite`         | `coauthor` |
| Invitation accepted | `Accept`         | `coauthor` |
| Invitation declined | `Reject`         | `coauthor` |
| Review requested    | `Invite`         | `review`   |
| Review approved     | `Accept`         | `review`   |
| Revision needed     | `Update`         | `review`   |
| Article published   | `Create`         | `article`  |
| Article removed     | `Delete`         | `article`  |
| Reply published     | `Create`         | `article`  |

### User Schema Additions

```typescript
// Add to existing user model
interface UserAdditions {
  accountType: 'small_business' | 'personal' | 'hybrid' | 'other';

  emailPreferences: {
    coauthorInvites: boolean; // Default: true
    reviewRequests: boolean; // Default: true
    articlePublished: boolean; // Default: true
    articleReplies: boolean; // Default: true
    revisionNeeded: boolean; // Default: true
  };
}
```

---

## Implementation Stages

### Stage 0: Prerequisites

**Status**: ✅ Complete

- Screenname feature implemented
- AuthorBadge component ready

---

### Stage 1: In-App Notification System

**Status**: ✅ Complete (not yet user tested)

**Foundation for all invitation and review workflows**

> **Full specification**: See [NOTIFICATIONS-ROADMAP.md](./NOTIFICATIONS-ROADMAP.md)
>
> The notification system is designed to be ActivityPub-compatible from the start,
> enabling future federation with [activities.next](https://github.com/llun/activities.next).

#### Key Design Decisions

- **ActivityPub-shaped schema**: Uses Activity types (`Invite`, `Accept`, `Create`, etc.)
- **Actor model**: Notifications reference actor (who), object (what), target (recipient)
- **Retention policy**: Invitations kept indefinitely (audit trail), others expire after 30-90 days
- **No WebSocket**: Simple polling for unread count (30-second interval)

#### Components

| Component                  | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `NotificationFlower.tsx`   | Pana flower button in header (like dark mode toggle) |
| `NotificationDropdown.tsx` | Dropdown showing recent notifications                |
| `NotificationList.tsx`     | Full notification list for account page              |
| `NotificationItem.tsx`     | Individual notification display                      |

#### API Endpoints

| Endpoint                           | Method | Description                           |
| ---------------------------------- | ------ | ------------------------------------- |
| `/api/notifications`               | GET    | List user's notifications (paginated) |
| `/api/notifications/unread-count`  | GET    | Get unread count for badge            |
| `/api/notifications/[id]/read`     | POST   | Mark as read                          |
| `/api/notifications/mark-all-read` | POST   | Mark all as read                      |

#### Pages

| Page                     | Description                   |
| ------------------------ | ----------------------------- |
| `/account/notifications` | Full notification history     |
| `/account/user/edit`     | Add email preferences section |

#### Helpers

| File                        | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `lib/notifications.ts`      | `createNotification()`, `sendNotificationEmail()` |
| `lib/model/notification.ts` | Mongoose schema                                   |

#### Email Integration

- Use existing Nodemailer/Brevo setup
- Respect user's `emailPreferences`
- Branded email templates matching existing magic link style

#### Code Standards

All notification code MUST include upstream reference comments:

```typescript
/**
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * See: [specific file path] for comparable pattern
 */
```

---

### Stage 2: Account Type & Article Schema

**Status**: ✅ Complete (not yet user tested)

#### User Model Updates

- Add `accountType` field to user schema
- Add `emailPreferences` object
- Update account settings UI to select account type

#### Article Model

- Create `lib/model/article.ts`
- Implement slug generation (unique, URL-safe)
- Implement reading time calculation

#### Basic CRUD

| Endpoint               | Method | Description                |
| ---------------------- | ------ | -------------------------- |
| `/api/articles`        | POST   | Create new article         |
| `/api/articles/[slug]` | GET    | Get article by slug        |
| `/api/articles/[slug]` | PATCH  | Update article             |
| `/api/articles/[slug]` | DELETE | Delete draft (author only) |
| `/api/articles/my`     | GET    | List user's articles       |

#### Pages

| Page                    | Description                 |
| ----------------------- | --------------------------- |
| `/articles/new`         | Create new article          |
| `/articles/[slug]/edit` | Edit article (authors only) |
| `/account/articles`     | Author's article dashboard  |

#### Editor

**Phase 1**: Markdown + live preview

- Textarea for markdown input
- Side-by-side or toggle preview
- Basic toolbar (bold, italic, links, headers)
- Image upload to BunnyCDN

**Future**: Tiptap migration with SVG-Edit integration

---

### Stage 3: Co-Author & Reviewer Workflow

#### Invitation Flow

```
Author writes draft
       ↓
Author clicks "Invite Co-Author" or "Request Review"
       ↓
Search users by screenname
       ↓
Add personal message (optional)
       ↓
Send invitation → Notification created
       ↓
Invitee sees notification (flower icon badge)
       ↓
Invitee clicks → lands on invitation page
       ↓
Accept: gains edit access, can now see/edit draft
Decline: removed from list, author notified
```

#### Reviewer Workflow

```
Author requests review
       ↓
Reviewer receives notification
       ↓
Reviewer opens article in review mode
       ↓
Reviewer can:
  • Read full content
  • Add comments (general feedback)
  • Flag specific passages ({{citation_needed}} equivalent)
  • Check required boxes when satisfied
       ↓
Approve: Article becomes publishable
Request Revision: Status → 'revision_needed', authors notified
       ↓
[If revision needed]
Authors see comments, address issues
Re-request review when ready
```

#### API Endpoints

| Endpoint                                            | Method | Description                 |
| --------------------------------------------------- | ------ | --------------------------- |
| `/api/articles/[slug]/coauthors/invite`             | POST   | Invite co-author            |
| `/api/articles/[slug]/coauthors/respond`            | POST   | Accept/decline invitation   |
| `/api/articles/[slug]/review/request`               | POST   | Request review              |
| `/api/articles/[slug]/review/respond`               | POST   | Approve or request revision |
| `/api/articles/[slug]/review/comments`              | POST   | Add reviewer comment        |
| `/api/articles/[slug]/review/comments/[id]/resolve` | POST   | Mark comment resolved       |

#### Pages

| Page                      | Description                |
| ------------------------- | -------------------------- |
| `/articles/[slug]/invite` | Invitation acceptance page |
| `/articles/[slug]/review` | Reviewer interface         |

#### Components

| Component            | Description                                |
| -------------------- | ------------------------------------------ |
| `UserSearch.tsx`     | Search users by screenname for invitations |
| `InvitationCard.tsx` | Accept/decline UI with message             |
| `ReviewerPanel.tsx`  | Sidebar with checklist and comments        |
| `ReviewComment.tsx`  | Individual comment with resolve button     |
| `FlaggedContent.tsx` | Highlighted text with reviewer note        |

---

### Stage 4: Publishing & Public Display

#### Publishing Rules

Article is publishable when ALL conditions met:

1. Has title (non-empty)
2. Has content (non-empty)
3. Has at least ONE of:
   - Accepted co-author(s)
   - Approved reviewer
4. Status is `draft` or `revision_needed` (with new approval)

#### API Endpoints

| Endpoint                         | Method | Description                        |
| -------------------------------- | ------ | ---------------------------------- |
| `/api/articles/[slug]/publish`   | POST   | Publish article                    |
| `/api/articles/[slug]/unpublish` | POST   | Revert to draft (author only)      |
| `/api/articles/recent`           | GET    | Recent published articles          |
| `/api/articles/featured`         | GET    | Featured articles (admin curated?) |
| `/api/articles/[slug]/replies`   | GET    | Articles that reply to this one    |

#### Pages

| Page               | Description                     |
| ------------------ | ------------------------------- |
| `/articles`        | Article exploration/browse page |
| `/articles/[slug]` | Public article view             |

#### Article Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Cover Image - full width]                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ BUSINESS UPDATE | #tag1 #tag2                               │
│                                                             │
│ Article Title Here                                          │
│                                                             │
│ By [AuthorBadge] & [CoAuthorBadge]                         │
│ Reviewed by [ReviewerBadge]                                 │
│ Published January 1, 2025 · 5 min read                      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ In reply to: "Original Article Title" →                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Article content rendered from Markdown...                   │
│                                                             │
│ Lorem ipsum dolor sit amet, consectetur adipiscing elit.    │
│ Sed do eiusmod tempor incididunt ut labore et dolore.       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Follow-up Articles                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ "A Response: ..." by [AuthorBadge] · Jan 5, 2025       │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ "Update: Additional thoughts..." by [AuthorBadge]      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Homepage Integration

Add new section to existing homepage:

```
┌─────────────────────────────────────────────────────────────┐
│ Community Articles                                          │
│                                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ [Card 1]    │ │ [Card 2]    │ │ [Card 3]    │            │
│ │ Title       │ │ Title       │ │ Title       │            │
│ │ Excerpt...  │ │ Excerpt...  │ │ Excerpt...  │            │
│ │ By Author   │ │ By Author   │ │ By Author   │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│                    [Explore More →]                         │
└─────────────────────────────────────────────────────────────┘
```

#### /articles Exploration Page

- Filter by article type (business update / community commentary)
- Filter by tags
- Search by title/content
- Sort by recent / popular
- Paginated results

#### Components

| Component              | Description                                  |
| ---------------------- | -------------------------------------------- |
| `ArticleCard.tsx`      | Preview card for listings                    |
| `ArticleByline.tsx`    | Author, co-authors, reviewer attribution     |
| `ArticleTypeBadge.tsx` | Business Update / Community Commentary label |
| `ReplyToLink.tsx`      | "In reply to: [Title]" with link             |
| `FollowUpArticles.tsx` | List of reply articles                       |
| `HomepageArticles.tsx` | Homepage section                             |

---

### Stage 5: RSS Feeds

#### Endpoints

| Endpoint                        | Format    | Description               |
| ------------------------------- | --------- | ------------------------- |
| `/feed.xml`                     | RSS 2.0   | All published articles    |
| `/feed.json`                    | JSON Feed | Developer-friendly format |
| `/feed/tag/[tag].xml`           | RSS 2.0   | Articles by tag           |
| `/feed/author/[screenname].xml` | RSS 2.0   | Articles by author        |
| `/feed/type/[type].xml`         | RSS 2.0   | By article type           |

#### RSS Item Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Pana MIA Community Articles</title>
    <link>https://panamia.club/articles</link>
    <description>Community articles from South Florida</description>
    <language>en-us</language>
    <lastBuildDate>RFC 822 date</lastBuildDate>

    <item>
      <title>Article Title</title>
      <link>https://panamia.club/articles/slug</link>
      <description><![CDATA[Excerpt or first paragraph...]]></description>
      <dc:creator>Author Screenname</dc:creator>
      <pubDate>RFC 822 date</pubDate>
      <category>tag1</category>
      <category>tag2</category>
      <guid isPermaLink="true">https://panamia.club/articles/slug</guid>
    </item>
  </channel>
</rss>
```

#### Autodiscovery

Add to `<head>` in layout:

```html
<link
  rel="alternate"
  type="application/rss+xml"
  title="Pana MIA Articles"
  href="/feed.xml"
/>
<link
  rel="alternate"
  type="application/feed+json"
  title="Pana MIA Articles"
  href="/feed.json"
/>
```

---

### Stage 6: Article Threading

#### "In Reply To" Feature

When creating/editing an article:

- Optional "This is a reply to..." field
- Search published articles by title
- Select parent article
- Creates bidirectional link

#### Reply Chain Display

Parent article shows "Follow-up Articles" section.
Child article shows "In reply to: [Title]" header.

#### API

| Endpoint                       | Method | Description                         |
| ------------------------------ | ------ | ----------------------------------- |
| `/api/articles/search`         | GET    | Search articles for reply selection |
| `/api/articles/[slug]/replies` | GET    | Get articles replying to this one   |

#### Components

| Component           | Description                       |
| ------------------- | --------------------------------- |
| `ArticleSearch.tsx` | Search/select for "in reply to"   |
| `ReplyChain.tsx`    | Visual thread of related articles |

---

### Stage 7: Admin Moderation

#### Capabilities

- View all published articles
- Remove articles (with reason)
- View removed articles
- Restore removed articles (if appropriate)

#### API Endpoints

| Endpoint                             | Method | Description                    |
| ------------------------------------ | ------ | ------------------------------ |
| `/api/admin/articles`                | GET    | List all articles (any status) |
| `/api/admin/articles/[slug]/remove`  | POST   | Remove with reason             |
| `/api/admin/articles/[slug]/restore` | POST   | Restore removed article        |

#### Pages

| Page                      | Description              |
| ------------------------- | ------------------------ |
| `/account/admin/articles` | Admin article management |

---

### Future Stages (Not in Initial Scope)

| Stage | Feature              | Description                        |
| ----- | -------------------- | ---------------------------------- |
| 8     | Tiptap Editor        | Rich text editing, better UX       |
| 9     | SVG-Edit Integration | Embedded vector doodle editor      |
| 10    | Hocuspocus           | Real-time collaborative editing    |
| 11    | ActivityPub          | Fediverse syndication              |
| 12    | View Analytics       | Privacy-respecting metrics         |
| 13    | Bookmarks            | Users can save articles            |
| 14    | Comments             | Fediverse replies as comments      |
| 15    | Lists Alignment      | Align with ActivityPub Collections |

---

### Stage 11: ActivityPub Federation (Detailed)

**Upstream Reference**: [llun/activities.next](https://github.com/llun/activities.next)

#### Architecture Options

**Option A: activities.next Sidecar (Recommended)**

Deploy activities.next as a separate instance at `social.panamia.club`:

```
panamia.club                         social.panamia.club
(Next.js app)                        (activities.next)
     │                                      │
     │ Article published ──────────→ Create Note activity
     │                                      │
     │                                      ↓
     │                              Federation to Fediverse
     │                                      │
     │ Fediverse replies ←────────── Inbox receives
     │                                      │
     └── Display as comments ───────────────┘
```

**Benefits**:

- activities.next handles all ActivityPub complexity
- Pana MIA remains focused on core features
- Shared authentication via SSO
- Proven Vercel deployment

**Option B: Native ActivityPub**

Implement ActivityPub directly in Pana MIA using patterns from activities.next.

**When to consider**: If sidecar architecture becomes limiting.

#### Stage 14: Comments via Fediverse

Instead of building a custom comment system:

1. Article published → Toot created on `social.panamia.club`
2. Mastodon users reply to the toot
3. Fetch replies via Mastodon API
4. Display below article as comments

See [NOTIFICATIONS-ROADMAP.md](./NOTIFICATIONS-ROADMAP.md) for "Mastodon API Fetch" pattern.

---

## File Structure

```
lib/
├── model/
│   ├── article.ts
│   └── notification.ts
├── article.ts              # Helpers (slug, reading time)
└── notifications.ts        # Create, send email

app/
├── api/
│   ├── articles/
│   │   ├── route.ts                    # Create, list
│   │   ├── my/route.ts                 # User's articles
│   │   ├── recent/route.ts             # Recent published
│   │   ├── search/route.ts             # Search for replies
│   │   └── [slug]/
│   │       ├── route.ts                # Get, update, delete
│   │       ├── publish/route.ts
│   │       ├── coauthors/
│   │       │   ├── invite/route.ts
│   │       │   └── respond/route.ts
│   │       ├── review/
│   │       │   ├── request/route.ts
│   │       │   ├── respond/route.ts
│   │       │   └── comments/route.ts
│   │       └── replies/route.ts
│   ├── notifications/
│   │   ├── route.ts
│   │   ├── unread-count/route.ts
│   │   ├── mark-all-read/route.ts
│   │   └── [id]/
│   │       └── read/route.ts
│   └── admin/
│       └── articles/
│           └── [slug]/
│               ├── remove/route.ts
│               └── restore/route.ts
├── articles/
│   ├── page.tsx                        # Browse/explore
│   ├── new/page.tsx                    # Create
│   └── [slug]/
│       ├── page.tsx                    # Public view
│       ├── edit/page.tsx               # Edit (authors)
│       ├── invite/page.tsx             # Accept invitation
│       └── review/page.tsx             # Reviewer interface
├── account/
│   ├── articles/page.tsx               # Author dashboard
│   ├── notifications/page.tsx          # Notification history
│   └── admin/
│       └── articles/page.tsx           # Admin moderation
├── feed.xml/route.ts
├── feed.json/route.ts
└── feed/
    ├── tag/[tag]/route.ts
    ├── author/[screenname]/route.ts
    └── type/[type]/route.ts

components/
├── NotificationFlower.tsx
├── NotificationDropdown.tsx
├── NotificationItem.tsx
├── ArticleCard.tsx
├── ArticleByline.tsx
├── ArticleTypeBadge.tsx
├── ArticleEditor.tsx                   # Markdown + preview
├── UserSearch.tsx
├── InvitationCard.tsx
├── ReviewerPanel.tsx
├── ReviewComment.tsx
├── ReplyToLink.tsx
├── FollowUpArticles.tsx
├── ArticleSearch.tsx
└── HomepageArticles.tsx
```

---

## Dependencies

### Required (Already in project)

- Next.js 16
- MongoDB / Mongoose
- NextAuth
- Nodemailer / Brevo
- BunnyCDN (images)
- Tailwind CSS
- Radix UI

### New Dependencies

| Package                      | Purpose                  | Stage |
| ---------------------------- | ------------------------ | ----- |
| `marked` or `react-markdown` | Markdown rendering       | 2     |
| `slugify`                    | URL-safe slug generation | 2     |
| `reading-time`               | Calculate read time      | 2     |
| `feed`                       | RSS/JSON feed generation | 5     |

### Future Dependencies

| Package               | Purpose                 | Stage |
| --------------------- | ----------------------- | ----- |
| `@tiptap/react`       | Rich text editor        | 8     |
| `@tiptap/extension-*` | Tiptap extensions       | 8     |
| `@hocuspocus/server`  | Real-time collaboration | 10    |

---

## Open Questions

1. **Featured articles**: Admin-curated, or algorithmic (recent + engagement)?
2. **Article limits**: Max articles per user per day/week?
3. **Image limits**: Max images per article? Max file size?
4. **Tag limits**: Max tags per article? Pre-defined tag list or freeform?
5. **Reviewer limits**: Can same reviewer review multiple articles from same author?

---

## Revision History

| Date       | Change                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| 2024-12-29 | Added ActivityPub integration plan with activities.next upstream reference |
| 2024-12-29 | Split notification system to NOTIFICATIONS-ROADMAP.md                      |
| 2024-12-26 | Initial roadmap created                                                    |

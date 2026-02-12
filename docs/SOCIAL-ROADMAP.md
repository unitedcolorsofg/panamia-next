# Social Roadmap

Integrated social features for panamia.club using [activities.next](https://github.com/llun/activities.next) as a capability provider.

## Overview

This document outlines the plan to add native social features to panamia.club. Behind the scenes, the social layer federates with Mastodon, Pixelfed, and other ActivityPub servers.

### Design Philosophy

1. **Native experience**: Social features feel like part of panamia, not a "federation" bolt-on
2. **Invisible federation**: Users follow accounts and see posts; implementation details are not displayed
3. **Articles + Social**: Article comments come from the social layer (local + remote replies)
4. **Read-only upstream**: activities.next code imported via git subtree, never modified

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          panamia.club                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────┐     ┌─────────────────────────────────────┐   │
│  │    Article      │     │         Social Timeline             │   │
│  │  "My New Post"  │     │  ┌─────────────────────────────┐    │   │
│  │                 │     │  │ @author: Check out my new   │    │   │
│  │  [content...]   │     │  │ article about...            │    │   │
│  │                 │     │  │ 🔗 panamia.club/a/...│    │   │
│  │  ─────────────  │     │  └─────────────────────────────┘    │   │
│  │  Comments:      │     │  ┌─────────────────────────────┐    │   │
│  │  ┌───────────┐  │     │  │ @coauthor: Excited to share │    │   │
│  │  │ @user@mast│◄─┼─────┼──│ this new article...         │    │   │
│  │  │ Great!    │  │     │  │ 🔗 panamia.club/a/...│    │   │
│  │  └───────────┘  │     │  └─────────────────────────────┘    │   │
│  │  ┌───────────┐  │     │  ┌─────────────────────────────┐    │   │
│  │  │ @local    │◄─┼─────┼──│ @someone@mastodon.social    │    │   │
│  │  │ Love it!  │  │     │  │ replied to @author...       │    │   │
│  │  └───────────┘  │     │  └─────────────────────────────┘    │   │
│  └─────────────────┘     └─────────────────────────────────────┘   │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  lib/federation/           external/activities.next/ (Read-only)   │
│  └── Panamia wrappers      └── ActivityPub capability provider     │
├────────────────────────────────────────────────────────────────────┤
│  PostgreSQL                                                        │
│  ├── articles, profiles, users (panamia tables)                    │
│  └── social_actors, social_statuses, social_follows (social_*)     │
└────────────────────────────────────────────────────────────────────┘
```

### Dependency Management

We selectively import and execute code from `external/activities.next/`. To avoid pulling in 50+ unnecessary dependencies, we trace only what's needed.

**Approach**: When importing modules from activities.next, track their dependencies in a manifest:

```
lib/federation/DEPENDENCIES.json    ← Generated manifest of required deps
scripts/trace-federation-deps.ts    ← Analyzes imports, generates manifest
scripts/validate-federation-deps.ts ← CI check: deps in manifest exist in package.json
```

**Workflow**:

1. Import a module from `external/activities.next/lib/...`
2. Run `npx tsx scripts/trace-federation-deps.ts <entry-files>`
3. Script traces imports, outputs `DEPENDENCIES.json`
4. Add missing deps to root `package.json`
5. CI validates deps stay in sync

**Example DEPENDENCIES.json**:

```json
{
  "description": "Dependencies required for ActivityPub federation",
  "source": "external/activities.next",
  "dependencies": {
    "jsonwebtoken": {
      "version": "^9.0.0",
      "reason": "HTTP signature signing",
      "imports": ["external/activities.next/lib/utils/signature.ts"]
    }
  },
  "existingInRoot": ["zod"],
  "newDepsNeeded": ["jsonwebtoken"]
}
```

### Article ↔ Social Integration

When an article is published:

1. **Author + co-authors** can each pre-compose an announcement post (optional)
2. **On publish**: All announcement posts go live simultaneously for "social splash effect"
3. **Replies to announcements** appear as comments below the article
4. **Comments section** shows replies from local users AND remote users (Mastodon, etc.)

```
Article (published)
├── Announcement by @author (SocialStatus, optional)
│   └── Reply from @reader@mastodon.social
│   └── Reply from @local_user
├── Announcement by @coauthor1 (SocialStatus, optional)
│   └── Reply from @fan@pixelfed.social
└── Announcement by @coauthor2 (SocialStatus, optional)

Comments Section renders ALL replies across ALL announcements
```

## Database Strategy

### Schema Namespacing

Prefix all social tables with `social_` to avoid conflicts with panamia tables:

| Table              | Purpose                                 |
| ------------------ | --------------------------------------- |
| social_actors      | ActivityPub actors (linked to Profile)  |
| social_statuses    | Posts, announcements, replies           |
| social_follows     | Follow relationships (local + remote)   |
| social_likes       | Likes/favorites                         |
| social_timelines   | Timeline entries for each actor         |
| social_attachments | Media attachments on posts              |
| social_tags        | Hashtags and mentions                   |
| social_recipients  | Post recipients (to/cc for ActivityPub) |

### Key Models

```prisma
// Profile ↔ SocialActor (1:1, optional)
// Local users who enable social features get an actor

model SocialActor {
  id                  String    @id @default(cuid())
  username            String    // screenname
  domain              String    // panamia.club for local, remote domain for others
  profileId           String?   @unique
  profile             Profile?  @relation(fields: [profileId], references: [id])

  // ActivityPub fields
  publicKey           String
  privateKey          String?   // null for remote actors
  inboxUrl            String
  outboxUrl           String
  followersUrl        String
  followingUrl        String

  // Metadata
  name                String?
  summary             String?
  iconUrl             String?

  // Counts
  followingCount      Int       @default(0)
  followersCount      Int       @default(0)
  statusCount         Int       @default(0)

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  statuses            SocialStatus[]
  outgoingFollows     SocialFollow[] @relation("FollowActor")
  incomingFollows     SocialFollow[] @relation("FollowTarget")

  @@unique([username, domain])
  @@map("social_actors")
}

// SocialStatus - posts, announcements, replies
// NOT 1:1 with Article - multiple authors can announce the same article

model SocialStatus {
  id              String        @id @default(cuid())
  uri             String        @unique  // ActivityPub URI
  actorId         String
  actor           SocialActor   @relation(fields: [actorId], references: [id])

  // Link to article (for announcements)
  articleId       String?
  article         Article?      @relation(fields: [articleId], references: [id])

  // Content
  type            String        // Note (default), Article, etc.
  content         String?       // HTML content
  contentWarning  String?       // CW/spoiler text
  url             String?       // Canonical URL

  // Threading
  inReplyToUri    String?       // AP URI of parent status
  inReplyToId     String?       // Local ID if we have the parent
  inReplyTo       SocialStatus? @relation("StatusReplies", fields: [inReplyToId], references: [id])
  replies         SocialStatus[] @relation("StatusReplies")

  // For article announcements: draft content before publish
  isDraft         Boolean       @default(false)

  // Timestamps
  published       DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  attachments     SocialAttachment[]
  tags            SocialTag[]
  likes           SocialLike[]

  @@index([articleId])
  @@index([inReplyToUri])
  @@index([actorId, published])
  @@map("social_statuses")
}

// ArticleAnnouncement - draft announcements that publish with article
// Separate from SocialStatus to track pre-composed drafts

model ArticleAnnouncement {
  id          String   @id @default(cuid())
  articleId   String
  article     Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  authorId    String   // User ID (author or co-author)
  author      User     @relation(fields: [authorId], references: [id])

  // Draft content
  content     String   // The announcement text
  attachments Json     @default("[]")  // Optional media

  // After publish, links to the created SocialStatus
  statusId    String?  @unique
  status      SocialStatus? @relation(fields: [statusId], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([articleId, authorId])  // One announcement per author per article
  @@map("article_announcements")
}
```

### Migration Notes

- **Deprecate `mastodonPostUrl`** on Article model (will be removed in future migration)
- Add `ArticleAnnouncement` relation to Article
- Add `SocialStatus` relation to Article (for published announcements)

## Implementation Phases

### Phase 1: Infrastructure Setup ✓

**Status**: Complete

- [x] Add activities.next as git subtree in `external/activities.next/`
- [x] Create pre-commit hook to prevent external modifications
- [x] Add Playwright upstream integrity test
- [x] Add GitHub Actions workflow for upstream monitoring
- [x] Create `lib/federation/` directory structure
- [x] Add TypeScript path alias for external imports

### Phase 2: Database Schema ✓

**Status**: Complete

**Goal**: Add social tables to PostgreSQL

- [x] Create Prisma models with `social_` prefix
- [x] Add SocialActor model (linked to Profile)
- [x] Add SocialStatus model (posts, replies)
- [x] Add ArticleAnnouncement model (draft announcements)
- [x] Add SocialFollow model (follow relationships)
- [x] Add SocialLike model (favorites)
- [x] Add supporting models (attachments, tags, recipients)
- [x] Create migration
- [x] Deprecate `mastodonPostUrl` field on Article

### Phase 3: Actor Management ✓

**Status**: Complete

**Goal**: Local users can have social identities

- [x] Create actor when user enables social features
- [x] Generate RSA keypair for HTTP signatures
- [x] WebFinger endpoint (`/.well-known/webfinger`)
- [x] Actor endpoint (`/users/[screenname]`)
- [x] Sync actor when profile changes (name, bio, avatar)

**Note on Username Sync**: The actor `username` is set from `profile.slug` at
creation time and is **never updated** afterward. This is intentional—changing
ActivityPub usernames breaks federation since remote servers cache the old
username. The `syncActorFromProfile()` function updates `name`, `summary`, and
`iconUrl` but not `username`. If a user needs a different social username, they
would need to delete and recreate their actor (losing followers).

### Phase 3.5: Legacy Feature Removal ✓

**Status**: Complete

**Goal**: Remove legacy UserFollow/UserList features to make way for social layer

The existing following and lists features were removed to avoid parallel
feature sets. SocialFollow is now the sole follow mechanism.

**Removed**:

- Database models: `UserFollow`, `UserList`, `UserListMember`
- API routes: `/api/user/getFollowing`, `/api/user/updateFollowing`,
  `/api/user/getList`, `/api/user/updateList`, `/api/list/*`, and legacy
  `/api/addFollower`, `/api/removeFollower`, `/api/getFollowing`, etc.
- UI pages: `/account/user/following`, `/account/user/lists`, `/list/[id]`
- Query hooks: `useUserFollowing`, `useMutateUserFollowing`, `useUserLists`,
  `useMutateUserLists`

**Added**:

- Navigation item "Timeline Posts" → `/timeline`
- Migration to drop `user_follows`, `user_lists`, `user_list_members` tables

### Phase 4: Social Timeline (Local) ✓

**Status**: Complete

**Goal**: Users can post and see posts from followed accounts

- [x] Create post composer UI (`PostComposer` with 500 char limit, CW support)
- [x] Timeline page showing posts from followed accounts (`/timeline`)
- [x] Post detail page (`/status/[statusId]`)
- [x] Reply to posts (inline composer on post detail)
- [x] Like posts (optimistic UI with `useLikePost`/`useUnlikePost`)
- [x] Follow/unfollow local users (`FollowButton` component)
- [x] User's own posts list (`/p/[user]` profile page)
- [x] Follow buttons in directory search results

**Implementation**:

- Wrappers: `lib/federation/wrappers/{status,follow,timeline}.ts`
- API routes: `app/api/social/{timeline,statuses,actors,follows}/`
- React Query hooks: `lib/query/social.ts`
- UI components: `components/social/`
- Pages: `app/{timeline,p/[user],status/[statusId]}/`

**Hybrid Layout**: Actor profile page uses tabs (Posts | Followers | Following)
instead of separate pages. Timeline page has Home/Public tabs.

### Phase 4B: Markdown Editor & Media Attachments

**Status**: Complete

**Goal**: Upgrade PostComposer with markdown editing and media upload support

**Markdown Editor**:

- [x] Write/Preview tabs in PostComposer (matching ArticleEditor UX)
- [x] Monospace textarea with markdown hint text
- [x] Client-side preview via `react-markdown`
- [x] Server-side MD-to-HTML conversion via `marked` for ActivityPub compatibility
- [x] Stored content is HTML (federation-ready `Note.content`)

**Media Attachments**:

- [x] Upload endpoint (`POST /api/social/media`) using Vercel Blob storage
- [x] Accepted types: images (jpeg, png, webp, gif) and audio (webm for voice memos)
- [x] Max file size: 10 MB, max 4 attachments per post
- [x] `SocialAttachment` records created alongside status
- [x] Thumbnail previews in PostComposer with remove button
- [x] `AttachmentGrid` component for display (responsive image grid, inline audio player)
- [x] Attachments included in all timeline queries

**Files**:

- `components/social/PostComposer.tsx` — Write/Preview tabs, media upload button, attachment previews
- `components/social/AttachmentGrid.tsx` — Responsive display grid for images and audio
- `app/api/social/media/route.ts` — Vercel Blob upload endpoint
- `lib/federation/wrappers/status.ts` — MD-to-HTML via `marked`, `SocialAttachment` creation
- `lib/federation/wrappers/timeline.ts` — `include: { attachments: true }` on all queries
- `lib/interfaces.ts` — `attachments` field on `SocialStatusDisplay`

### Phase 4C: Voice Memo Direct Messages

**Status**: Complete

**Goal**: Send private voice memos to other users

Voice memos are ActivityPub `direct` visibility messages sent to specific recipients (1-8 users). They use the existing post infrastructure but with a dedicated composer and auto-expiration.

**Features**:

- [x] @-mention autocomplete for recipient selection (1-8 recipients)
- [x] Voice recording (WebM audio, max 60 seconds)
- [x] Optional text content alongside or instead of voice recording
- [x] Direct visibility (recipients receive via ActivityPub `recipientTo`)
- [x] Auto-expiration: 7-day soft delete via `expiresAt` timestamp
- [x] Profile page "Send Voice Memo" button
- [x] Relocated notifications to `/updates/` with VoiceMemoComposer integration

**Technical Details**:

- `expiresAt` field on `SocialStatus` for soft delete
- Timeline queries filter out statuses where `expiresAt < now()`
- `VoiceMemoComposer` component with recipient chips and audio recording
- `SendVoiceMemoButton` component for profile pages
- Actor search API (`GET /api/social/actors/search`) for @-autocomplete

**Files**:

- `components/social/VoiceMemoComposer.tsx` — DM-specific composer with recipient selection
- `components/social/SendVoiceMemoButton.tsx` — Dialog trigger for profile pages
- `app/api/social/actors/search/route.ts` — Actor username search for autocomplete
- `lib/federation/wrappers/status.ts` — `direct` visibility + `expiresAt` handling
- `lib/federation/wrappers/timeline.ts` — `notExpiredFilter` on all timeline queries
- `app/updates/page.tsx` — Relocated from `/account/notifications/`

**TODO**: Implement hard delete via Vercel Pro cron to clean up blob storage for expired messages.

### Phase 5: Article Announcements

**Goal**: Authors can announce articles when published

- [ ] Add announcement composer to article edit page
- [ ] Each author/co-author can write their own announcement
- [ ] Draft announcements stored in ArticleAnnouncement
- [ ] On article publish: create SocialStatus for each announcement
- [ ] Announcements include link to article

### Phase 6: Article Comments from Social

**Goal**: Article comments section shows social replies

- [ ] Query all SocialStatuses that are replies to article announcements
- [ ] Render replies as comments below article
- [ ] Allow logged-in users to reply (creates SocialStatus)
- [ ] Show reply author info (local or remote)
- [ ] Threaded replies support

### Phase 7: Federation - Outbound

**Goal**: Local posts federate to remote servers

- [ ] HTTP signature signing for outgoing requests
- [ ] Deliver Create activities to followers' inboxes
- [ ] Deliver Follow activities to remote actors
- [ ] Deliver Like activities
- [ ] Deliver Undo activities (unfollow, unlike)

### Phase 8: Federation - Inbound

**Goal**: Receive and process activities from remote servers

- [ ] Inbox endpoint (`/p/[user]/inbox`)
- [ ] HTTP signature verification
- [ ] Process Follow activities (follow requests)
- [ ] Process Create activities (remote posts/replies)
- [ ] Process Like activities
- [ ] Process Delete activities
- [ ] Process Undo activities

### Phase 9: Remote Follows & Discovery

**Goal**: Users can follow accounts on other servers

- [ ] Search for remote accounts by handle (@user@domain)
- [ ] WebFinger lookup for remote actors
- [ ] Fetch and cache remote actor profiles
- [ ] Follow remote accounts
- [ ] Display remote posts in timeline

### Phase 10: Polish & Moderation

**Goal**: Production-ready social features

- [ ] Block users (local and remote)
- [ ] Block instances
- [ ] Report content
- [ ] Content warnings support
- [ ] Rate limiting on federation endpoints
- [ ] Admin dashboard for moderation

## Directory Structure

```
lib/federation/
├── index.ts                 # Public API exports
├── config.ts                # Configuration
│
├── wrappers/                # High-level APIs
│   ├── actor.ts             # Actor CRUD
│   ├── status.ts            # Post/reply CRUD
│   ├── follow.ts            # Follow management
│   ├── timeline.ts          # Timeline queries
│   └── announcement.ts      # Article announcements
│
├── bridges/                 # Data transformation
│   ├── profile-to-actor.ts  # Profile → SocialActor
│   └── status-to-comment.ts # SocialStatus → Comment display
│
├── activities/              # ActivityPub handlers
│   ├── inbox.ts             # Incoming processing
│   ├── outbox.ts            # Outgoing delivery
│   └── handlers/
│       ├── create.ts
│       ├── follow.ts
│       ├── like.ts
│       └── delete.ts
│
├── crypto/                  # HTTP signatures
│   ├── keys.ts
│   ├── sign.ts
│   └── verify.ts
│
└── webfinger/               # WebFinger protocol
    └── index.ts
```

## Configuration

Social features use the existing `NEXT_PUBLIC_HOST_URL` for domain detection. No additional environment variables required for basic functionality.

Optional variables for ActivityPub metadata (shown to remote servers):

```bash
# Optional: Instance metadata for ActivityPub
SOCIAL_INSTANCE_NAME="Pana Mia Club"
SOCIAL_INSTANCE_DESCRIPTION="Panama's creative community"
SOCIAL_ADMIN_EMAIL=admin@panamia.club
```

Note: No `SOCIAL_ENABLED` flag—ship when ready, fix when broken.

## User Experience

### For Article Authors

1. Write article as normal
2. Before publishing, optionally write an announcement post
3. Co-authors can each write their own announcement
4. On publish, announcements go live automatically
5. View comments (replies) below the article

### For Social Users

1. Enable social features in account settings
2. Choose a handle (@screenname@panamia.club)
3. Post updates, follow others, engage with content
4. See posts from followed accounts in timeline
5. Follow accounts from other servers (@user@mastodon.social)

### For Article Readers

1. Read article
2. See comments section below (powered by social replies)
3. Reply to join the conversation (requires account)
4. Comments from Mastodon users appear alongside local comments

## Security

1. **HTTP Signatures**: All federation requests signed/verified
2. **Domain Verification**: Actor domains must match request origins
3. **Rate Limiting**: Protect against abuse from remote servers
4. **Content Sanitization**: Strip unsafe HTML from federated content
5. **Private Keys**: Encrypted at rest
6. **Moderation Tools**: Block users, instances, report content

## Rollback

If social features cause issues:

1. Revert the deployment or push a fix
2. Articles and core features continue working normally
3. Existing social data preserved in database

## References

- [ActivityPub W3C Spec](https://www.w3.org/TR/activitypub/)
- [activities.next Repository](https://github.com/llun/activities.next)
- [Mastodon ActivityPub Docs](https://docs.joinmastodon.org/spec/activitypub/)
- [WebFinger RFC 7033](https://tools.ietf.org/html/rfc7033)

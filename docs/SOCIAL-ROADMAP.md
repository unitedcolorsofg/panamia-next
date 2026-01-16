# Social Federation Roadmap

Integration of [activities.next](https://github.com/llun/activities.next) as a capability provider for ActivityPub federation.

## Overview

This document outlines the plan to integrate activities.next into panamia.club, enabling federation with the Fediverse (Mastodon, Pixelfed, etc.). Rather than running activities.next as a separate sidecar service, we integrate it as a **capability provider** with panamia-specific wrappers.

### Key Principles

1. **Read-only upstream**: activities.next code is imported via git subtree and must not be modified
2. **Wrapper pattern**: All integration happens through wrapper modules in `lib/federation/`
3. **Shared database**: Single PostgreSQL instance with namespaced tables (`social_` prefix)
4. **Gradual rollout**: Federation features released incrementally behind feature flags

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        panamia.club                              │
├─────────────────────────────────────────────────────────────────┤
│  app/                    │  lib/federation/                     │
│  ├── api/                │  ├── wrappers/     ← Panamia APIs    │
│  ├── articles/           │  │   ├── actor.ts                    │
│  └── profile/            │  │   ├── status.ts                   │
│                          │  │   ├── follow.ts                   │
│                          │  │   └── timeline.ts                 │
│                          │  ├── bridges/      ← Data mapping    │
│                          │  │   ├── profile-to-actor.ts         │
│                          │  │   └── article-to-status.ts        │
│                          │  └── index.ts      ← Public API      │
├──────────────────────────┴──────────────────────────────────────┤
│  external/activities.next/  ← Git subtree (READ-ONLY)           │
│  ├── lib/                                                        │
│  │   ├── actions/                                                │
│  │   ├── activities/                                             │
│  │   ├── database/                                               │
│  │   ├── models/                                                 │
│  │   └── services/                                               │
│  └── migrations/                                                 │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL (shared)                                             │
│  ├── users, accounts, sessions, profiles, articles (panamia)    │
│  └── social_actors, social_statuses, social_follows, ... (fed)  │
└─────────────────────────────────────────────────────────────────┘
```

## Database Strategy

### Schema Namespacing

activities.next uses Knex.js for migrations with these tables:

- `actors`, `accounts`, `sessions` (auth - conflicts with panamia!)
- `statuses`, `attachments`, `tags`, `recipients`
- `follows`, `likes`, `timelines`
- `medias`, `poll_choices`, `poll_answers`
- `clients`, `tokens`, `auth_codes` (OAuth)

**Solution**: Prefix all federation tables with `social_`:

| Original Table | Namespaced Table   | Purpose                                 |
| -------------- | ------------------ | --------------------------------------- |
| actors         | social_actors      | ActivityPub actors (linked to profiles) |
| statuses       | social_statuses    | Federated posts/articles                |
| follows        | social_follows     | Federation follow relationships         |
| likes          | social_likes       | Federated likes/favorites               |
| timelines      | social_timelines   | Federated timeline entries              |
| attachments    | social_attachments | Media attachments                       |
| tags           | social_tags        | Hashtags and mentions                   |
| recipients     | social_recipients  | Post recipients (to/cc)                 |
| medias         | social_medias      | Uploaded media files                    |
| counters       | social_counters    | Activity counters                       |

**Excluded tables** (use panamia's existing auth):

- `accounts`, `sessions`, `account_providers` → Use panamia's PostgreSQL auth
- `clients`, `tokens`, `auth_codes` → Use panamia's NextAuth.js

### Migration Strategy

1. **Convert Knex to Prisma**: Transform activities.next migrations to Prisma format
2. **Namespace prefix**: All tables get `social_` prefix via `@@map("social_tablename")`
3. **Separate migration folder**: `prisma/migrations/federation/`
4. **Migration naming**: `YYYYMMDD_social_description.sql`

Example Prisma schema addition:

```prisma
// Federation tables (activities.next integration)
// These tables are namespaced with 'social_' prefix

model SocialActor {
  id                  String    @id @default(cuid())
  username            String
  domain              String
  profileId           String?   @unique  // Link to panamia Profile
  profile             Profile?  @relation(fields: [profileId], references: [id])
  name                String?
  summary             String?
  publicKey           String
  privateKey          String?
  iconUrl             String?
  headerImageUrl      String?
  followersUrl        String
  inboxUrl            String
  sharedInboxUrl      String?
  followingCount      Int       @default(0)
  followersCount      Int       @default(0)
  statusCount         Int       @default(0)
  manuallyApprovesFollowers Boolean @default(false)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  statuses            SocialStatus[]
  outgoingFollows     SocialFollow[] @relation("FollowActor")
  incomingFollows     SocialFollow[] @relation("FollowTarget")
  likes               SocialLike[]

  @@unique([username, domain])
  @@map("social_actors")
}

model SocialStatus {
  id          String   @id @default(cuid())
  actorId     String
  actor       SocialActor  @relation(fields: [actorId], references: [id])
  articleId   String?  @unique  // Link to panamia Article
  article     Article? @relation(fields: [articleId], references: [id])
  type        String   // Note, Article, etc.
  content     String?
  summary     String?  // Content warning
  inReplyTo   String?
  url         String?
  published   DateTime @default(now())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  attachments SocialAttachment[]
  tags        SocialTag[]
  recipients  SocialRecipient[]
  likes       SocialLike[]

  @@map("social_statuses")
}

// ... additional models
```

## Git Subtree Integration

### Initial Setup

```bash
# Add activities.next as a remote
git remote add activities-upstream https://github.com/llun/activities.next.git

# Fetch and add subtree
git subtree add --prefix=external/activities.next activities-upstream main --squash

# Create .gitattributes to mark as read-only (informational)
echo "external/activities.next/** linguist-vendored" >> .gitattributes
```

### Updating Upstream

```bash
# Pull latest changes from upstream
git subtree pull --prefix=external/activities.next activities-upstream main --squash
```

### Directory Structure

```
external/
└── activities.next/
    ├── lib/
    │   ├── actions/        # Action handlers
    │   ├── activities/     # ActivityPub activity processing
    │   ├── database/       # Database abstraction
    │   ├── models/         # Data models (Actor, Status, etc.)
    │   └── services/       # Business logic
    ├── migrations/         # Original Knex migrations (reference only)
    └── README.md
```

## Enforcement Mechanisms

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check for modifications to external/activities.next
EXTERNAL_CHANGES=$(git diff --cached --name-only | grep "^external/activities.next/")

if [ -n "$EXTERNAL_CHANGES" ]; then
  echo "❌ ERROR: Modifications to external/activities.next/ are not allowed!"
  echo ""
  echo "The following files were modified:"
  echo "$EXTERNAL_CHANGES"
  echo ""
  echo "This directory contains read-only upstream code from activities.next."
  echo "To update upstream code, use: git subtree pull --prefix=external/activities.next activities-upstream main --squash"
  echo ""
  echo "If you need to extend functionality, create wrappers in lib/federation/"
  exit 1
fi
```

### Playwright Upstream Verification Test

Create `tests/e2e/upstream-integrity.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Upstream Integrity', () => {
  test('external/activities.next matches upstream', async () => {
    // Skip in CI if explicitly disabled
    if (process.env.SKIP_UPSTREAM_CHECK === 'true') {
      test.skip();
      return;
    }

    const externalPath = path.join(process.cwd(), 'external/activities.next');

    // Check if external directory exists
    expect(fs.existsSync(externalPath)).toBe(true);

    // Get the subtree commit hash
    const subtreeLog = execSync(
      'git log -1 --format="%H" -- external/activities.next',
      { encoding: 'utf-8' }
    ).trim();

    // Verify subtree was properly added
    expect(subtreeLog.length).toBe(40); // Git SHA length

    // Check for local modifications
    const localChanges = execSync(
      'git status --porcelain external/activities.next',
      { encoding: 'utf-8' }
    ).trim();

    expect(localChanges).toBe('');
  });

  test('no uncommitted changes to external code', async () => {
    const status = execSync('git diff --name-only external/activities.next', {
      encoding: 'utf-8',
    }).trim();

    expect(status).toBe('');
  });
});
```

### GitHub Actions Workflow

Add to `.github/workflows/upstream-check.yml`:

```yaml
name: Upstream Integrity Check

on:
  push:
    paths:
      - 'external/activities.next/**'
  pull_request:
    paths:
      - 'external/activities.next/**'
  schedule:
    # Check weekly for upstream updates
    - cron: '0 0 * * 0'

jobs:
  verify-upstream:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Add upstream remote
        run: git remote add activities-upstream https://github.com/llun/activities.next.git || true

      - name: Fetch upstream
        run: git fetch activities-upstream main

      - name: Check for upstream updates
        id: check-updates
        run: |
          # Get current subtree state
          CURRENT=$(git log -1 --format="%H" -- external/activities.next)

          # Check if upstream has newer commits
          UPSTREAM_HEAD=$(git rev-parse activities-upstream/main)

          echo "current=$CURRENT" >> $GITHUB_OUTPUT
          echo "upstream=$UPSTREAM_HEAD" >> $GITHUB_OUTPUT

          if [ "$CURRENT" != "$UPSTREAM_HEAD" ]; then
            echo "updates_available=true" >> $GITHUB_OUTPUT
          else
            echo "updates_available=false" >> $GITHUB_OUTPUT
          fi

      - name: Notify if updates available
        if: steps.check-updates.outputs.updates_available == 'true'
        run: |
          echo "::warning::Upstream activities.next has updates available"
          echo "Current: ${{ steps.check-updates.outputs.current }}"
          echo "Upstream: ${{ steps.check-updates.outputs.upstream }}"
```

## Implementation Phases

### Phase 1: Infrastructure Setup

**Goal**: Set up git subtree and enforcement mechanisms

- [ ] Add activities.next as git subtree in `external/activities.next/`
- [ ] Create pre-commit hook to prevent external modifications
- [ ] Add Playwright upstream integrity test
- [ ] Add GitHub Actions workflow for upstream monitoring
- [ ] Create `lib/federation/` directory structure
- [ ] Add TypeScript path alias for external imports

**Files created**:

- `external/activities.next/` (subtree)
- `.husky/pre-commit` (updated)
- `tests/e2e/upstream-integrity.spec.ts`
- `.github/workflows/upstream-check.yml`
- `lib/federation/index.ts`

### Phase 2: Database Schema Integration

**Goal**: Add namespaced federation tables to PostgreSQL

- [ ] Create Prisma models for federation tables with `social_` prefix
- [ ] Create migration: `prisma/migrations/YYYYMMDD_add_federation_tables/`
- [ ] Add Profile ↔ SocialActor relationship
- [ ] Add Article ↔ SocialStatus relationship
- [ ] Document schema in DATABASE-ROADMAP.md

**Prisma models**:

- `SocialActor` - ActivityPub actors (linked to Profile)
- `SocialStatus` - Federated posts (linked to Article)
- `SocialFollow` - Follow relationships
- `SocialLike` - Likes/favorites
- `SocialAttachment` - Media attachments
- `SocialTag` - Hashtags and mentions
- `SocialRecipient` - To/cc recipients
- `SocialTimeline` - Timeline entries

### Phase 3: Actor Bridge

**Goal**: Bridge panamia profiles to ActivityPub actors

- [ ] Create `lib/federation/bridges/profile-to-actor.ts`
- [ ] Implement actor creation from profile
- [ ] Generate RSA keypair for signing
- [ ] Create WebFinger endpoint (`/.well-known/webfinger`)
- [ ] Create actor endpoint (`/users/[screenname]`)
- [ ] Add actor update sync when profile changes

**Key functions**:

```typescript
// lib/federation/wrappers/actor.ts
export async function createActorFromProfile(
  profileId: string
): Promise<SocialActor>;
export async function updateActorFromProfile(
  profileId: string
): Promise<SocialActor>;
export async function getActorByScreenname(
  screenname: string
): Promise<SocialActor | null>;
export async function getActorByHandle(
  handle: string
): Promise<SocialActor | null>;
```

### Phase 4: Status Bridge (Articles)

**Goal**: Federate published articles as ActivityPub Notes/Articles

- [ ] Create `lib/federation/bridges/article-to-status.ts`
- [ ] Create status when article is published
- [ ] Update status when article is edited
- [ ] Delete status when article is unpublished/removed
- [ ] Add federation toggle to article publish flow

**Key functions**:

```typescript
// lib/federation/wrappers/status.ts
export async function federateArticle(articleId: string): Promise<SocialStatus>;
export async function updateFederatedArticle(
  articleId: string
): Promise<SocialStatus>;
export async function unfederateArticle(articleId: string): Promise<void>;
```

### Phase 5: Inbox/Outbox Implementation

**Goal**: Handle incoming and outgoing ActivityPub activities

- [ ] Create inbox endpoint (`/users/[screenname]/inbox`)
- [ ] Create outbox endpoint (`/users/[screenname]/outbox`)
- [ ] Implement HTTP signature verification
- [ ] Implement HTTP signature signing for outgoing requests
- [ ] Handle Follow activities (incoming follow requests)
- [ ] Handle Accept/Reject activities (follow responses)
- [ ] Handle Create activities (incoming posts)
- [ ] Handle Like activities (incoming likes)
- [ ] Handle Announce activities (boosts)
- [ ] Handle Delete activities (post deletions)
- [ ] Handle Undo activities (unfollows, unlikes)

### Phase 6: Timeline & Discovery

**Goal**: Display federated content in panamia

- [ ] Create federated timeline view
- [ ] Add followers/following lists
- [ ] Implement user search (local + federated)
- [ ] Add follow button to profiles
- [ ] Display boost/like counts on articles

### Phase 7: Notifications Integration

**Goal**: Integrate federation events with panamia notifications

- [ ] Create federation notification types
- [ ] Notify on new followers
- [ ] Notify on mentions
- [ ] Notify on boosts
- [ ] Notify on likes

## Wrapper Module Structure

```
lib/federation/
├── index.ts                 # Public API exports
├── config.ts               # Federation configuration
├── constants.ts            # ActivityPub constants
│
├── wrappers/               # High-level panamia APIs
│   ├── actor.ts            # Actor management
│   ├── status.ts           # Status/post management
│   ├── follow.ts           # Follow management
│   ├── timeline.ts         # Timeline queries
│   └── webfinger.ts        # WebFinger resolution
│
├── bridges/                # Data transformation
│   ├── profile-to-actor.ts # Profile → ApActor
│   ├── article-to-status.ts# Article → ApStatus
│   └── notification.ts     # Fed events → Notifications
│
├── activities/             # ActivityPub activity handlers
│   ├── inbox.ts            # Incoming activity processing
│   ├── outbox.ts           # Outgoing activity creation
│   └── handlers/           # Specific activity type handlers
│       ├── follow.ts
│       ├── create.ts
│       ├── like.ts
│       ├── announce.ts
│       └── delete.ts
│
├── crypto/                 # HTTP signatures
│   ├── keys.ts             # RSA keypair management
│   ├── sign.ts             # Request signing
│   └── verify.ts           # Signature verification
│
└── utils/                  # Utilities
    ├── url.ts              # URL construction
    ├── json-ld.ts          # JSON-LD context handling
    └── content-type.ts     # Accept header handling
```

## Configuration

### Environment Variables

```bash
# Federation configuration
FEDERATION_ENABLED=true
FEDERATION_DOMAIN=panamia.club
FEDERATION_INSTANCE_NAME="Pana Mia Club"
FEDERATION_INSTANCE_DESCRIPTION="Panama's creative community"
FEDERATION_ADMIN_EMAIL=admin@panamia.club

# Feature flags
FEDERATION_AUTO_FEDERATE_ARTICLES=false  # Require opt-in per article
FEDERATION_ALLOW_REMOTE_FOLLOWS=true
FEDERATION_ALLOW_REMOTE_INTERACTIONS=true
```

### lib/federation/config.ts

```typescript
export const federationConfig = {
  enabled: process.env.FEDERATION_ENABLED === 'true',
  domain: process.env.FEDERATION_DOMAIN || 'panamia.club',
  instanceName: process.env.FEDERATION_INSTANCE_NAME || 'Pana Mia Club',
  instanceDescription: process.env.FEDERATION_INSTANCE_DESCRIPTION,
  adminEmail: process.env.FEDERATION_ADMIN_EMAIL,

  features: {
    autoFederateArticles:
      process.env.FEDERATION_AUTO_FEDERATE_ARTICLES === 'true',
    allowRemoteFollows: process.env.FEDERATION_ALLOW_REMOTE_FOLLOWS !== 'false',
    allowRemoteInteractions:
      process.env.FEDERATION_ALLOW_REMOTE_INTERACTIONS !== 'false',
  },

  // ActivityPub endpoints
  endpoints: {
    webfinger: '/.well-known/webfinger',
    nodeinfo: '/.well-known/nodeinfo',
    actor: (screenname: string) => `/users/${screenname}`,
    inbox: (screenname: string) => `/users/${screenname}/inbox`,
    outbox: (screenname: string) => `/users/${screenname}/outbox`,
    followers: (screenname: string) => `/users/${screenname}/followers`,
    following: (screenname: string) => `/users/${screenname}/following`,
  },
};
```

## Testing Strategy

### Unit Tests

- Wrapper functions (mock database)
- Bridge transformations (profile ↔ actor, article ↔ status)
- HTTP signature generation/verification
- ActivityPub JSON-LD validation

### Integration Tests

- Actor creation from profile
- Article federation flow
- Follow/unfollow flow
- Inbox activity processing

### E2E Tests (Playwright)

- WebFinger resolution
- Actor profile fetch
- Follow button interaction
- Federated timeline display
- Upstream integrity verification

## Security Considerations

1. **HTTP Signatures**: All federation requests must be signed
2. **Domain Verification**: Verify actor domains match request origins
3. **Rate Limiting**: Limit incoming federation requests
4. **Content Sanitization**: Sanitize all federated content (HTML, URLs)
5. **Block Lists**: Support instance and user blocking
6. **Private Keys**: Store actor private keys encrypted at rest

## Rollback Plan

If federation causes issues:

1. Set `FEDERATION_ENABLED=false` to disable all federation
2. Federation endpoints return 503 Service Unavailable
3. Existing federated content remains but stops syncing
4. Local functionality continues unaffected

## References

- [ActivityPub W3C Spec](https://www.w3.org/TR/activitypub/)
- [activities.next Repository](https://github.com/llun/activities.next)
- [ActivityPub Rocks](https://activitypub.rocks/)
- [Mastodon ActivityPub Docs](https://docs.joinmastodon.org/spec/activitypub/)
- [Guide for ActivityPub Implementers](https://socialhub.activitypub.rocks/t/guide-for-new-activitypub-implementers/479)

# Database Architecture Roadmap

This document outlines the strategy for evolving Pana MIA's database architecture to support transactional features (bookings, marketplace, etc.) while preserving the flexibility of document-based content storage.

---

## Problem Statement

Pana MIA was built on MongoDB/Mongoose, which is an excellent match for the current feature set:

- **Profiles**: Flexible, nested documents (social links, hours, categories)
- **Articles**: Content-centric with varied metadata
- **Notifications**: Simple documents with references

However, the prospective long-term roadmap includes features that are inherently relational:

| Planned Feature | Data Characteristics                               |
| --------------- | -------------------------------------------------- |
| Pet sitting     | Availability calendars, booking conflicts, reviews |
| Item exchange   | Listings, bids, transactions, escrow states        |
| Rentals         | Date range conflicts, reservations                 |
| ActivityPub     | Federation requires activities.next (PostgreSQL)   |

These features share common patterns:

- **Transactional integrity** (double-booking prevention, payment states)
- **Relational queries** (user → listing → bid → transaction)
- **Complex filtering** (date ranges, geo, multi-table joins)

MongoDB can implement these, but requires significant application-level code to compensate for what PostgreSQL provides natively: ACID transactions, foreign key constraints, and efficient JOINs.

**The question**: How do we add relational capabilities without abandoning MongoDB's document flexibility or rewriting the entire application?

---

## Key Concepts

### Polyglot Persistence

**Polyglot persistence** is an architectural pattern where different data storage technologies are used within the same application, each chosen for its strengths.

Instead of forcing all data into one database paradigm:

```
Traditional: One database for everything
┌─────────────────────────────────┐
│           MongoDB               │
│  users, profiles, articles,     │
│  bookings, transactions...      │
└─────────────────────────────────┘
```

Polyglot persistence matches storage to data characteristics:

```
Polyglot: Right tool for each job
┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │    MongoDB      │
│   (relational)  │  │   (documents)   │
├─────────────────┤  ├─────────────────┤
│ users           │  │ profiles        │
│ bookings        │  │ articles        │
│ transactions    │  │ notifications   │
│ listings        │  │ (flexible data) │
└─────────────────┘  └─────────────────┘
```

**Trade-off**: Operational complexity increases, but each data type is stored optimally.

### Sidecar Architecture

A **sidecar** is a separate service that runs alongside the main application, handling a specific domain or capability.

```
Main Application              Sidecar Service
┌─────────────────┐          ┌─────────────────┐
│   panamia.club  │  ←────→  │ pets.panamia.club│
│   (Next.js)     │   API    │   (Next.js)     │
│                 │          │                 │
│   MongoDB       │          │   PostgreSQL    │
│   PostgreSQL    │  shared  │   (same DB)     │
└─────────────────┘   users  └─────────────────┘
```

Benefits:

- **Separation of concerns**: Each sidecar owns its domain
- **Independent deployment**: Update pet sitting without touching main app
- **Shared identity**: All sidecars reference the same `users` table
- **Technology flexibility**: Sidecars can use different frameworks if needed

---

## The Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Main Next.js App                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐         ┌──────────────────────────────┐ │
│  │   PostgreSQL         │         │         MongoDB              │ │
│  │   (via Prisma)       │         │       (via Mongoose)         │ │
│  ├──────────────────────┤         ├──────────────────────────────┤ │
│  │ users (authoritative)│         │ profiles                     │ │
│  │ - id (cuid) PK ──────────────────→ userId                     │ │
│  │ - email              │         │ - bio, images, social...     │ │
│  │ - screenname         │         ├──────────────────────────────┤ │
│  │ - role               │         │ articles (pending migration) │ │
│  ├──────────────────────┤         │ - authorEmail                │ │
│  │ accounts (NextAuth)  │         │ - coAuthors[].userId         │ │
│  │ sessions (NextAuth)  │         └──────────────────────────────┘ │
│  │ verification_tokens  │                                         │
│  ├──────────────────────┤                                         │
│  │ notifications        │                                         │
│  │ - actor → users.id   │                                         │
│  │ - target → users.id  │                                         │
│  └──────────────────────┘                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
              │
              │ Same PostgreSQL instance
              │ Real foreign keys
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Pet Sitting Sidecar                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐                                           │
│  │ listings             │                                           │
│  │ - sitter_id ─────────────→ users.id (FK)                         │
│  ├──────────────────────┤                                           │
│  │ bookings             │                                           │
│  │ - owner_id ──────────────→ users.id (FK)                         │
│  │ - sitter_id ─────────────→ users.id (FK)                         │
│  │ - listing_id ────────────→ listings.id (FK)                      │
│  └──────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Decision Framework

```
┌─────────────────────────────────────────────────────────────┐
│                    Where does data go?                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PostgreSQL if:                 MongoDB if:                 │
│  ─────────────                  ──────────                  │
│  • Identity/auth                • Flexible/nested structure │
│  • Needs FK constraints         • Varied schemas per doc    │
│  • Transactional (bookings)     • Content-centric           │
│  • Complex relational queries   • Rapid schema iteration    │
│  • Sidecar will reference it    • Document fits naturally   │
│                                                             │
│  Examples:                      Examples:                   │
│  • users ✓                      • profiles ✓                │
│  • accounts ✓                   • articles (pending)        │
│  • sessions ✓                                               │
│  • notifications ✓                                          │
│  • bookings ✓                                               │
│  • listings ✓                                               │
│  • transactions ✓                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Why This Plan Is Worth It

### 1. Sidecars Get Real Foreign Keys

Without this architecture, sidecars must either:

- Duplicate user data (sync headaches)
- Use string IDs without constraints (no referential integrity)
- Query MongoDB for user lookups (slow, no JOINs)

With PostgreSQL as the authoritative user store:

```sql
-- This just works
CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  sitter_id TEXT NOT NULL REFERENCES users(id)
);

-- Efficient JOINs
SELECT b.*, u.screenname
FROM bookings b
JOIN users u ON b.owner_id = u.id
WHERE b.status = 'pending';
```

### 2. Transactional Features Become Natural

MongoDB approach to preventing double-bookings:

```javascript
// Race condition window between check and create
const conflict = await Booking.findOne({
  listingId,
  status: 'confirmed',
  /* complex date overlap query */
});
if (conflict) throw new Error('Conflict');
// Another request could insert here!
await Booking.create({ ... });
```

PostgreSQL approach:

```sql
BEGIN;
SELECT * FROM listings WHERE id = $1 FOR UPDATE;  -- Lock row
INSERT INTO bookings (...)
  SELECT ... WHERE NOT EXISTS (
    SELECT 1 FROM bookings
    WHERE listing_id = $1 AND daterange && $2
  );
COMMIT;
```

Atomic, no race conditions, database-enforced integrity.

### 3. Document Flexibility Preserved

Profiles remain in MongoDB with their natural structure:

```javascript
{
  userId: "clx123...",  // References PostgreSQL
  bio: "Local musician and coffee enthusiast",
  socialLinks: {
    instagram: "@musician",
    spotify: "...",
    customLinks: [
      { label: "Bandcamp", url: "..." }
    ]
  },
  hours: {
    monday: { open: "9:00", close: "17:00" },
    tuesday: { open: "9:00", close: "17:00" },
    // ...
  },
  categories: ["music", "coffee", "events"]
}
```

No awkward JSONB columns or over-normalized tables.

### 4. ActivityPub Compatibility

The [activities.next](https://github.com/llun/activities.next) upstream reference uses PostgreSQL. This architecture aligns with eventual ActivityPub federation without requiring a separate user system.

### 5. Incremental Migration

No big-bang rewrite required:

1. Add PostgreSQL for users/auth (Phase 1)
2. MongoDB documents reference PostgreSQL IDs
3. Build new features in PostgreSQL
4. Existing features continue working

---

## Implementation

### Prisma Schema

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  screenname    String?   @unique
  role          String    @default("user")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]

  // Sidecar relations
  listings         Listing[]
  bookingsAsOwner  Booking[] @relation("owner")
  bookingsAsSitter Booking[] @relation("sitter")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// Sidecar tables
model Listing {
  id           String    @id @default(cuid())
  sitterId     String
  sitter       User      @relation(fields: [sitterId], references: [id])
  title        String
  description  String?
  pricePerDay  Decimal
  available    Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  bookings     Booking[]
}

model Booking {
  id         String   @id @default(cuid())
  listingId  String
  ownerId    String
  sitterId   String
  startDate  DateTime
  endDate    DateTime
  status     String   @default("pending")
  totalPrice Decimal
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  listing    Listing  @relation(fields: [listingId], references: [id])
  owner      User     @relation("owner", fields: [ownerId], references: [id])
  sitter     User     @relation("sitter", fields: [sitterId], references: [id])
}
```

### Database Connections

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// lib/connectdb.ts (existing, unchanged)
// MongoDB connection continues to work as-is
```

### NextAuth Configuration

```typescript
// auth.ts
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // ... existing providers unchanged
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.email = user.email;
      session.user.screenname = user.screenname;
      session.user.role = user.role;

      const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
      session.user.isAdmin = adminEmails.includes(user.email.toLowerCase());

      return session;
    },
  },
  // ... rest of config
});
```

### MongoDB Documents Reference PostgreSQL

```typescript
// lib/model/profile.ts
const ProfileSchema = new Schema({
  userId: {
    type: String, // PostgreSQL user.id (cuid)
    required: true,
    unique: true,
    index: true,
  },
  // ... flexible document fields unchanged
  bio: String,
  socialLinks: Schema.Types.Mixed,
  categories: [String],
  hours: Schema.Types.Mixed,
});
```

### API Route Pattern

```typescript
// app/api/profile/route.ts
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import dbConnect from '@/lib/connectdb';
import Profile from '@/lib/model/profile';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // PostgreSQL: authoritative user data
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  // MongoDB: flexible profile document
  await dbConnect();
  const profile = await Profile.findOne({ userId: session.user.id });

  return Response.json({ user, profile });
}
```

### Profile Ensurance Pattern

```typescript
// lib/server/profile.ts
export async function ensureProfile(userId: string) {
  await dbConnect();

  let profile = await Profile.findOne({ userId });

  if (!profile) {
    profile = await Profile.create({
      userId,
      // default fields
    });
  }

  return profile;
}
```

---

## Migration Management

### Overview

PostgreSQL migrations are managed via Prisma Migrate with automated validation enforced through git hooks.

```
prisma/
├── schema.prisma              # Declarative schema (source of truth)
└── migrations/
    ├── TEMPLATE.sql           # Reference template for manual migrations
    ├── migration_lock.toml    # Prisma lock file
    ├── 20250115093000_init_users_and_auth/
    │   └── migration.sql      # Generated + documented
    └── 20250120140000_add_pet_sitting_tables/
        └── migration.sql
```

### Naming Convention

Migrations follow the pattern: `YYYYMMDDHHMMSS_snake_case_description`

| Component   | Format                     | Example           |
| ----------- | -------------------------- | ----------------- |
| Timestamp   | 14 digits (YYYYMMDDHHMMSS) | `20250115093000`  |
| Separator   | Underscore                 | `_`               |
| Description | snake_case, lowercase      | `add_users_table` |

**Examples:**

- `20250115093000_init_users_and_auth`
- `20250120140000_add_pet_sitting_tables`
- `20250125110000_add_booking_status_index`

### Required Documentation

Every `migration.sql` must include a header with these fields:

```sql
-- Migration: add_pet_sitting_tables
-- Purpose: Enable pet-sitting sidecar with listings and bookings
-- Ticket: PANA-42
-- Reversible: Yes
--
-- Rollback:
--   DROP TABLE IF EXISTS bookings;
--   DROP TABLE IF EXISTS listings;
```

| Field             | Required    | Description                          |
| ----------------- | ----------- | ------------------------------------ |
| `Purpose:`        | Yes         | Business context - WHY this exists   |
| `Ticket:`         | Yes         | PANA-XXX or "N/A" for infrastructure |
| `Reversible:`     | Yes         | Yes / No / Partial                   |
| `Rollback:`       | Recommended | SQL to reverse the migration         |
| `Dependencies:`   | Optional    | Tables that must exist first         |
| `Data Migration:` | Optional    | None / Inline / Separate script      |

### Immutability

**Migrations are immutable once committed.** The pre-commit hook blocks modifications to existing migration files. To fix a mistake:

```bash
# Wrong: editing existing migration
git add prisma/migrations/20250115_init/migration.sql  # ❌ Blocked

# Right: create a new migration
npx prisma migrate dev --name fix_user_email_constraint  # ✅
```

### Git Hooks Enforcement

The `.husky/pre-commit` hook validates:

1. **Naming convention** - Directory must match `YYYYMMDDHHMMSS_snake_case`
2. **Required headers** - `Purpose:`, `Ticket:`, `Reversible:` must be present
3. **Immutability** - Modifications to existing migrations are blocked

Run validation manually:

```bash
./scripts/validate-migrations.sh         # All migrations
./scripts/validate-migrations.sh --staged # Only staged (used by hook)
```

### Tracking Applied Migrations

Prisma tracks applied migrations in the `_prisma_migrations` table:

```sql
-- View migration history
SELECT migration_name, finished_at, applied_steps_count
FROM _prisma_migrations
ORDER BY finished_at;
```

Or via CLI:

```bash
npx prisma migrate status    # Shows applied/pending migrations
npx prisma migrate deploy    # Apply pending migrations (production)
npx prisma migrate dev       # Apply + generate (development)
```

### Workflow

**Development:**

```bash
# 1. Modify prisma/schema.prisma
# 2. Generate and apply migration
npx prisma migrate dev --name add_feature_name

# 3. Add documentation to generated migration.sql
# 4. Commit both schema.prisma and migrations/
git add prisma/
git commit -m "feat(db): add feature tables"
```

**Production Deployment:**

```bash
# CI/CD runs:
npx prisma migrate deploy  # Applies pending migrations
```

### MongoDB ↔ PostgreSQL Coordination

Since MongoDB documents reference PostgreSQL IDs:

1. **Order matters**: PostgreSQL migrations run BEFORE MongoDB schema changes
2. **ID format**: PostgreSQL uses `cuid()` which MongoDB stores as strings
3. **No cross-DB transactions**: Accept eventual consistency for non-critical paths
4. **Rollback planning**: Document which MongoDB collections reference each PG table

---

## MongoDB Schema Change Tracking

Unlike PostgreSQL (with Prisma Migrate), MongoDB/Mongoose schemas change directly in code. To maintain coordination with PostgreSQL and ensure team awareness, all schema changes are tracked via changelogs.

### Directory Structure

```
mongo-migrations/
├── README.md           # Process documentation
├── CHANGELOG.md        # Summary of all changes
└── changes/
    └── YYYY-MM-DD_model_description.md
```

### Workflow

When modifying any file in `lib/model/`:

1. **Create changelog entry**:

   ```bash
   # Create: mongo-migrations/changes/2025-01-15_profile_add_verification.md
   ```

2. **Document PostgreSQL dependencies** (if any):

   ```markdown
   ## PostgreSQL Dependencies

   - **Required Migration**: 20250115_init_users_and_auth
   - **Table**: users
   - **Column**: id
   ```

3. **Stage both files**:
   ```bash
   git add lib/model/profile.ts mongo-migrations/changes/2025-01-15_profile_add_verification.md
   ```

### Git Hooks Enforcement

The `.husky/pre-commit` hook validates:

1. **Changelog required** - Model changes without changelog entries are blocked
2. **No bypass** - Changelog entries are mandatory in all situations

Run validation manually:

```bash
./scripts/validate-mongo-changes.sh --staged
```

### Type-Safe PostgreSQL References

Use types from `lib/types/cross-db-refs.ts` for build-time validation:

```typescript
import { PostgresUserId } from '@/lib/types/cross-db-refs';

interface IProfile {
  userId: PostgresUserId; // Type-checked against Prisma schema
}
```

When Prisma is configured, these types will be derived from `@prisma/client`, ensuring referenced tables exist.

---

## Data Migration Path

### Phase 1: Add PostgreSQL (Parallel Operation) ✅

- [x] Add Prisma dependency and configuration
- [x] Set up PostgreSQL (Vercel Postgres)
- [x] Create schema with users, accounts, sessions tables
- [x] Set up PGLite for in-memory testing
- [x] Rename `USE_MEMORY_SERVER` → `USE_MEMORY_MONGODB`
- [x] Add `USE_MEMORY_POSTGRES` for PGLite in CI
- [x] Both databases running, not yet integrated

### Phase 2: Migrate Auth Data (In Progress)

- [x] Create export script (`scripts/export-auth-data.ts`)
- [x] Create import script with ObjectId → cuid transformation (`scripts/import-auth-data.ts`)
- [x] Switch auth.ts to use Prisma adapter (PostgreSQL-only, no toggle needed)
- [x] Remove `@auth/mongodb-adapter` dependency
- [ ] Run export script on production data (from commit 6fe64f9)
- [ ] Run import script to PostgreSQL
- [ ] Deploy with `POSTGRES_URL` configured
- [ ] Test auth flow thoroughly
- [ ] Remove MongoDB auth collections after validation

### Phase 3: Update References ✅

- [x] Create reference update script (`scripts/update-mongo-references.ts`)
  - Handles: profiles, images, followers, emailMigrations, articles, notifications
  - Uses ID mapping from import script
  - Dry-run mode by default (DRY_RUN=false to apply)
- [x] Run update script after auth migration (validated in dry-run mode)
- [x] Add ensureProfile pattern for lazy creation (`lib/server/profile.ts`)
  - `getProfileByUserId()` - lookup by PostgreSQL user ID
  - `ensureProfile()` - lookup with optional claiming of unclaimed profiles
  - Added `userId` to `ProfileInterface` type
- [x] Update API routes to use both connections
  - Profile routes use `ensureProfile()` with userId from session
  - Admin check uses `session.user.isAdmin` (from ADMIN_EMAILS)
  - OAuth/email-migration routes use Prisma for auth operations
- [x] Convert auth scripts to TypeScript with Prisma
  - `scripts/create-signin-link.ts` - creates magic sign-in links
  - `scripts/get-signin-link.ts` - checks token status
  - `scripts/delete-user.ts` - deletes from both PostgreSQL and MongoDB
- [x] Update documentation (`docs/SIGNIN.md`)
- [x] Remove old `.cjs` auth scripts

### Phase 4: Build Sidecars

- [ ] Create sidecar Next.js app(s)
- [ ] Connect to same PostgreSQL database
- [ ] Implement transactional features with real FKs
- [ ] Share authentication via same session table

---

## MongoDB Decommissioning Path

After the polyglot architecture is stable, MongoDB can be gradually decommissioned to achieve full FLOSS license compliance. This is optional but recommended for long-term alignment with FLOSS principles.

**Why Decommission MongoDB?**

- MongoDB's SSPL license is not considered FLOSS by FSF/OSI
- PostgreSQL with JSONB provides equivalent document flexibility
- Eliminates operational complexity of two databases
- Real foreign keys across all data

See [FLOSS-ALTERNATIVES.md](./FLOSS-ALTERNATIVES.md) for license details.

### Phase 5: Migrate Notifications ✅

- [x] Create `notifications` table in PostgreSQL with real FKs to `users`
  - Added `Notification` model to Prisma schema with enums
  - Migration: `20260114135300_add_notifications`
  - Includes ActivityPub-shaped fields (type, actor, target, context)
  - Denormalized display data to avoid cross-database joins
- [x] Create migration script (`scripts/migrate-notifications.ts`)
  - Maps MongoDB user ObjectIds to PostgreSQL user IDs via email
  - Supports dry-run mode for validation
- [x] Update notification queries to use Prisma (`lib/notifications.ts`)
  - `createNotification()` - creates with denormalized actor info
  - `getNotifications()` - paginated list with filtering
  - `getUnreadCount()`, `markAsRead()`, `markAllAsRead()`
- [x] Update all routes to use PostgreSQL user IDs
  - Notification API routes (`/api/notifications/*`)
  - Mentoring session routes (`/api/mentoring/sessions/*`)
  - Article routes (`/api/articles/[slug]/*`)
  - Admin article routes (`/api/admin/articles/[slug]/*`)
- [x] Remove `lib/model/notification.ts`

**Why notifications first:** Most relational data in MongoDB (actor/target references), benefits most from real FKs.

### Phase 6: Migrate Articles

- [ ] Create `articles` table with JSONB for flexible metadata
- [ ] Migrate article data from MongoDB
- [ ] Update article queries to use Prisma
- [ ] Remove `lib/model/article.ts`

**Schema approach:**

```sql
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  author_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  content TEXT,
  metadata JSONB,  -- Flexible fields
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 7: Migrate Profiles

- [ ] Create `profiles` table with JSONB for flexible nested data
- [ ] Migrate profile data from MongoDB
- [ ] Update profile queries to use Prisma
- [ ] Remove `lib/model/profile.ts`

**Schema approach:**

```sql
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  -- Structured fields as columns
  bio TEXT,
  phone_number TEXT,
  locally_based TEXT,
  -- Flexible fields as JSONB
  social_links JSONB,
  hours JSONB,
  categories JSONB,
  locations JSONB,
  images JSONB,
  mentoring JSONB,
  verification JSONB,
  roles JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 8: MongoDB Decommissioning

- [ ] Migrate remaining collections (if any)
- [ ] Remove `lib/connectdb.ts`
- [ ] Remove `lib/mongodb.ts`
- [ ] Remove `@auth/mongodb-adapter` dependency
- [ ] Remove `mongoose` dependency
- [ ] Remove `mongodb` dependency
- [ ] Remove `mongodb-memory-server` dev dependency
- [ ] Update `USE_MEMORY_MONGODB` references
- [ ] Update CI/CD to remove MongoDB configuration
- [ ] Update documentation

**Post-decommissioning benefits:**

- Full FLOSS license compliance
- Single database to manage
- Real foreign keys everywhere
- Simplified backup/restore
- Reduced operational complexity

---

## Testing Infrastructure

Both MongoDB and PostgreSQL support in-memory testing for CI:

| Database   | Technology            | Env Variable          | Package                 |
| ---------- | --------------------- | --------------------- | ----------------------- |
| MongoDB    | mongodb-memory-server | `USE_MEMORY_MONGODB`  | `mongodb-memory-server` |
| PostgreSQL | PGLite                | `USE_MEMORY_POSTGRES` | `@electric-sql/pglite`  |

### MongoDB Memory Server

Enabled via `USE_MEMORY_MONGODB=true`. Starts automatically in `lib/mongodb.ts`:

```typescript
if (process.env.USE_MEMORY_MONGODB === 'true') {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  // Creates in-memory MongoDB instance
}
```

### PGLite (PostgreSQL)

Enabled via `USE_MEMORY_POSTGRES=true`. The `pglite-prisma-adapter` provides Prisma integration:

```typescript
// lib/prisma.ts
if (process.env.USE_MEMORY_POSTGRES === 'true') {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PrismaPGlite } = await import('pglite-prisma-adapter');
  // Creates in-memory PostgreSQL instance
}
```

**Note:** Prisma Migrate doesn't support PGLite directly. Migrations are applied manually in test setup via `tests/setup/pglite-setup.ts`.

### Running Tests

```bash
# With real databases
MONGODB_URI=... POSTGRES_URL=... npm test

# With in-memory databases (CI mode)
USE_MEMORY_MONGODB=true USE_MEMORY_POSTGRES=true npm test
```

### GitHub Actions Configuration

After implementation, update GitHub repository:

1. Rename variable: `USE_MEMORY_SERVER` → `USE_MEMORY_MONGODB`
2. Add variable: `USE_MEMORY_POSTGRES=true`
3. (Phase 2) Add secret: `POSTGRES_URL`

---

## Trade-offs

### Costs

| Cost                     | Mitigation                                         |
| ------------------------ | -------------------------------------------------- |
| Two database connections | Singleton patterns, connection pooling             |
| No cross-DB transactions | Accept eventual consistency for non-critical paths |
| Migration effort         | Incremental approach, no big-bang                  |
| Cognitive overhead       | Clear decision framework (identity vs content)     |

### Benefits

| Benefit                        | Impact                                        |
| ------------------------------ | --------------------------------------------- |
| Real foreign keys for sidecars | Clean data model, database-enforced integrity |
| ACID transactions              | Reliable bookings, payments, state machines   |
| Document flexibility preserved | Profiles, articles stay natural               |
| ActivityPub alignment          | Future federation enabled                     |
| Scalable architecture          | Add sidecars without rearchitecting           |

---

## Related Documentation

- [ARTICLE-ROADMAP.md](./ARTICLE-ROADMAP.md) - Stage 12 references ActivityPub federation
- [NOTIFICATIONS-ROADMAP.md](./NOTIFICATIONS-ROADMAP.md) - ActivityPub-compatible notification schema

---

## Revision History

| Date       | Change                                                 |
| ---------- | ------------------------------------------------------ |
| 2025-01-09 | Initial roadmap created                                |
| 2025-01-14 | Phase 3 complete: auth scripts converted, docs updated |
| 2025-01-14 | Phase 5 complete: notifications migrated to PostgreSQL |

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
│  │ - role               │         │ articles                     │ │
│  ├──────────────────────┤         │ - authorId → users.id        │ │
│  │ accounts (NextAuth)  │         ├──────────────────────────────┤ │
│  │ sessions (NextAuth)  │         │ notifications                │ │
│  │ verification_tokens  │         │ - targetId → users.id        │ │
│  └──────────────────────┘         └──────────────────────────────┘ │
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
│  • accounts ✓                   • articles ✓                │
│  • sessions ✓                   • notifications ✓           │
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

## Data Migration Path

### Phase 1: Add PostgreSQL (Parallel Operation)

- [ ] Add Prisma dependency and configuration
- [ ] Set up PostgreSQL (Neon, Supabase, or Vercel Postgres)
- [ ] Create schema with users, accounts, sessions tables
- [ ] Both databases running, not yet integrated

### Phase 2: Migrate Auth Data

- [ ] Export `nextauth_users` from MongoDB
- [ ] Export `nextauth_accounts` from MongoDB
- [ ] Export `nextauth_sessions` from MongoDB
- [ ] Transform ObjectId → cuid format
- [ ] Import to PostgreSQL
- [ ] Switch NextAuth adapter to Prisma
- [ ] Test auth flow thoroughly

### Phase 3: Update References

- [ ] Update MongoDB documents to use PostgreSQL user IDs
- [ ] Add ensureProfile pattern for lazy creation
- [ ] Update API routes to use both connections
- [ ] Remove MongoDB nextauth\_\* collections

### Phase 4: Build Sidecars

- [ ] Create sidecar Next.js app(s)
- [ ] Connect to same PostgreSQL database
- [ ] Implement transactional features with real FKs
- [ ] Share authentication via same session table

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

| Date       | Change                  |
| ---------- | ----------------------- |
| 2025-01-09 | Initial roadmap created |

# Lib Directory

Shared utilities, business logic, data models, and server-side helpers.

## Core Files

| File            | Description                                                     |
| --------------- | --------------------------------------------------------------- |
| `prisma.ts`     | Prisma client singleton (PostgreSQL, supports PGLite for tests) |
| `env.config.ts` | Environment variable definitions and validation                 |
| `interfaces.ts` | TypeScript interfaces for all data models                       |
| `utils.ts`      | General utility functions                                       |

## Environment Configuration

The `env.config.ts` file is the single source of truth for all environment variables.
Each variable is documented with:

- Description of purpose
- Location: `SECRET` (GitHub Secrets), `VAR` (GitHub Variables), or `LOCAL` (dev only)
- Whether required or optional

### npm Scripts

```bash
npm run env:check     # Validate required variables are set
npm run env:workflow  # Generate GitHub Actions env snippet
npm run env:list      # List all variables with locations
npm run env:secrets   # List variables for GitHub Secrets
npm run env:vars      # List variables for GitHub Variables
```

See `.env.local.example` for annotated variable list.

## Database

### Prisma Models (PostgreSQL)

Primary data is stored in PostgreSQL via Prisma. See `prisma/schema.prisma` for the full schema.

| Model               | Description                             |
| ------------------- | --------------------------------------- |
| `User`              | User accounts (auth, email, screenname) |
| `Account`           | OAuth provider accounts                 |
| `Session`           | User sessions                           |
| `VerificationToken` | Email verification tokens               |
| `Profile`           | Business/personal profiles              |
| `Article`           | Community articles                      |
| `Notification`      | In-app notifications                    |
| `UserFollow`        | Follow relationships                    |
| `UserList`          | User-created curated lists              |
| `UserListMember`    | Members of user lists                   |
| `ContactSubmission` | Contact form submissions                |
| `NewsletterSignup`  | Newsletter signups                      |
| `EmailMigration`    | Email change tokens (TTL-based)         |
| `OAuthVerification` | OAuth email verification tokens         |
| `BrevoContact`      | Brevo email service sync                |
| `Interaction`       | User interactions/analytics             |
| `MentorSession`     | Mentoring session bookings              |
| `IntakeForm`        | Consolidated intake form submissions    |

## Query Helpers (`query/`)

Reusable database query functions:

| File               | Description                  |
| ------------------ | ---------------------------- |
| `user.ts`          | User lookup queries          |
| `profile.ts`       | Profile search and retrieval |
| `directory.ts`     | Directory listing queries    |
| `notifications.ts` | Notification queries         |
| `userlist.ts`      | List queries                 |
| `admin.ts`         | Admin-specific queries       |

## Server Utilities (`server/`)

Server-side only functions (not for client):

| File             | Description                      |
| ---------------- | -------------------------------- |
| `user.ts`        | User operations (create, update) |
| `profile.ts`     | Profile operations               |
| `directory.ts`   | Directory data fetching          |
| `interaction.ts` | Track user interactions          |
| `admin.ts`       | Admin operations                 |

## Validations (`validations/`)

Zod schemas for input validation:

| File                   | Description                |
| ---------------------- | -------------------------- |
| `mentoring-profile.ts` | Mentor profile validation  |
| `session.ts`           | Session booking validation |

## Blob Storage (`blob/`)

Vercel Blob integration for file uploads:

| File     | Description                                 |
| -------- | ------------------------------------------- |
| `api.ts` | `uploadFile()` and `deleteFile()` functions |

## Feature Utilities

### Articles (`article.ts`)

- `generateSlug(title)` - URL-safe slug from title
- `calculateReadingTime(content)` - Estimate read time in minutes
- `generateExcerpt(content)` - Auto-generate excerpt

### Mastodon (`mastodon.ts`)

- `parseMastodonUrl(url)` - Extract instance and post ID
- `isValidMastodonUrl(url)` - Validate URL format
- `fetchArticleComments(url)` - Get replies as comments

### Notifications (`notifications.ts`)

- `createNotification({...})` - Create notification with optional email

### Screennames (`screenname.ts`)

- `validateScreenname(name)` - Check format rules
- `isScreennameAvailable(name)` - Check database
- `generateScreenname(name)` - Create from display name

### User (`user.ts`)

- `getHostUrl()` - Get site URL (handles env vars)

## External Services

| File               | Service                         |
| ------------------ | ------------------------------- |
| `brevo_api.ts`     | Brevo (Sendinblue) email API    |
| `pusher-server.ts` | Pusher server client (realtime) |
| `pusher-client.ts` | Pusher browser client           |
| `geolocation.ts`   | Geocoding utilities             |
| `auth-api.ts`      | Auth helper functions           |

## Client-Side Utilities

| File              | Description                    |
| ----------------- | ------------------------------ |
| `localstorage.ts` | LocalStorage helpers           |
| `lists.ts`        | List manipulation utilities    |
| `standardized.ts` | Data standardization functions |

## Usage Patterns

```typescript
// Prisma (PostgreSQL) - Primary database
import { getPrisma } from '@/lib/prisma';
const prisma = await getPrisma();
const user = await prisma.user.findUnique({ where: { email } });
const profile = await prisma.profile.findFirst({ where: { email } });

// Interfaces
import type { UserInterface, ArticleInterface } from '@/lib/interfaces';
```

## Notes

- All files are server-side unless noted (localstorage, pusher-client)
- Database uses Prisma with PostgreSQL
- Validations use Zod schemas

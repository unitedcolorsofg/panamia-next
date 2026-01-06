# Lib Directory

Shared utilities, business logic, data models, and server-side helpers.

## Core Files

| File            | Description                                                     |
| --------------- | --------------------------------------------------------------- |
| `connectdb.ts`  | MongoDB connection singleton (caches connection for serverless) |
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

## Database Models (`model/`)

Mongoose schemas defining MongoDB collections:

| Model                  | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `user.ts`              | User accounts (auth, email, screenname, role)                      |
| `users.ts`             | Legacy user model (being migrated)                                 |
| `profile.ts`           | Business/personal profiles                                         |
| `article.ts`           | Community articles                                                 |
| `notification.ts`      | In-app notifications                                               |
| `userlist.ts`          | User-created curated lists                                         |
| `followers.ts`         | Follow relationships                                               |
| `images.ts`            | Profile image metadata                                             |
| `interaction.ts`       | User interactions/analytics                                        |
| `mentorSession.ts`     | Mentoring session bookings                                         |
| `event.ts`             | Event listings                                                     |
| `podcasts.ts`          | Podcast episodes                                                   |
| `links.ts`             | Link tree entries                                                  |
| `newsletter.ts`        | Newsletter subscriptions                                           |
| `contactus.ts`         | Contact form submissions                                           |
| `signup.ts`            | Signup requests                                                    |
| `emailMigration.ts`    | Email change requests                                              |
| `oauthVerification.ts` | OAuth email verification tokens                                    |
| `brevo_contact.ts`     | Brevo email service contacts                                       |
| `*intake.ts`           | Intake form submissions (apparel, art, food, goods, org, services) |

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
| `mongodb.ts`       | MongoDB utilities               |
| `auth-api.ts`      | Auth helper functions           |

## Client-Side Utilities

| File              | Description                    |
| ----------------- | ------------------------------ |
| `localstorage.ts` | LocalStorage helpers           |
| `lists.ts`        | List manipulation utilities    |
| `standardized.ts` | Data standardization functions |

## Usage Patterns

```typescript
// Database connection
import dbConnect from '@/lib/connectdb';
await dbConnect();

// Models
import user from '@/lib/model/user';
const doc = await user.findOne({ email });

// Interfaces
import type { UserInterface, ArticleInterface } from '@/lib/interfaces';
```

## Notes

- All files are server-side unless noted (localstorage, pusher-client)
- Models use Mongoose with TypeScript
- Queries return lean objects for performance
- Validations use Zod schemas

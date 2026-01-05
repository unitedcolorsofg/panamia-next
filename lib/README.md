# Lib Directory

Shared utilities, business logic, and data models.

## Structure

```
lib/
├── model/            # Mongoose database models
├── blob/             # Vercel Blob storage utilities
├── connectdb.ts      # MongoDB connection handler
├── interfaces.ts     # TypeScript interfaces for data models
├── article.ts        # Article utilities (slug, reading time)
├── mastodon.ts       # Mastodon API integration
├── notifications.ts  # Notification creation and email
├── pusher-server.ts  # Pusher server-side client
├── user.ts           # User-related utilities
└── [others]          # Various utility functions
```

## Key Files

### Database (`model/`)

Mongoose schemas defining the MongoDB collections:

- `user.ts` - User accounts and profiles
- `article.ts` - Community articles
- `notification.ts` - In-app notifications
- `profile.ts` - Business/personal profiles
- `list.ts` - User-created lists

### `connectdb.ts`

Singleton MongoDB connection handler. Caches connection to avoid
reconnecting on every request in serverless environment.

### `interfaces.ts`

TypeScript interfaces matching the Mongoose models. Used for
type-safe data handling throughout the app.

### `notifications.ts`

ActivityPub-compatible notification system:

- `createNotification()` - Create and optionally email notifications
- Supports article invites, reviews, follows, etc.

### `mastodon.ts`

Mastodon public API integration for comments:

- `parseMastodonUrl()` - Parse post URLs
- `fetchArticleComments()` - Get replies as comments

### `article.ts`

Article helper functions:

- `generateSlug()` - URL-safe slug from title
- `calculateReadingTime()` - Estimate read time
- `generateExcerpt()` - Auto-generate excerpt

## Conventions

- Server-side only code (uses Node.js APIs)
- Functions should be pure when possible
- Database operations return lean objects for performance

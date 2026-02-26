# DB Directory

Legacy MongoDB query files (for reference only).

> **Note:** The application now uses PostgreSQL via Drizzle ORM. These files are kept for
> historical reference and migration purposes only.

## Files

### `profiles_by_recent.mongodb.js`

MongoDB shell script for querying profiles by recent activity.
Was used with MongoDB Compass or mongosh during the MongoDB era.

## Current Database

The application uses **PostgreSQL** (Supabase) with Drizzle ORM. See:

- `/lib/schema/index.ts` - Database schema (Drizzle)
- `/lib/db.ts` - Drizzle client (uses Hyperdrive in CF Workers, POSTGRES_URL locally)
- `/drizzle/` - Migration files
- `/lib/query/` - Query helper functions
- `/lib/server/` - Server-side database operations

## Migration

For migrating data from MongoDB to PostgreSQL, see:

```bash
npx tsx scripts/migrate-from-mongodb.ts --help
```

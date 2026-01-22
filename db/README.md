# DB Directory

Legacy MongoDB query files (for reference only).

> **Note:** The application now uses PostgreSQL via Prisma. These files are kept for
> historical reference and migration purposes only.

## Files

### `profiles_by_recent.mongodb.js`

MongoDB shell script for querying profiles by recent activity.
Was used with MongoDB Compass or mongosh during the MongoDB era.

## Current Database

The application uses **PostgreSQL** with Prisma ORM. See:

- `/prisma/schema.prisma` - Database schema
- `/lib/prisma.ts` - Prisma client singleton
- `/lib/query/` - Query helper functions
- `/lib/server/` - Server-side database operations

## Migration

For migrating data from MongoDB to PostgreSQL, see:

```bash
npx tsx scripts/migrate-from-mongodb.ts --help
```

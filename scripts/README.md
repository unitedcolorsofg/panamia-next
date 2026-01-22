# Scripts Directory

Utility scripts for development, maintenance, and data operations.

## Available Scripts

### `env-check.ts`

Environment variable management and validation:

```bash
npm run env:check     # Validate required variables are set
npm run env:workflow  # Generate GitHub Actions env snippet
npm run env:list      # List all variables with locations
npm run env:secrets   # List variables for GitHub Secrets
npm run env:vars      # List variables for GitHub Variables
```

Uses `lib/env.config.ts` as the source of truth.

### `create-signin-link.ts`

Generate magic sign-in links for testing:

```bash
npx tsx scripts/create-signin-link.ts user@example.com
```

### `get-signin-link.ts`

Retrieve existing sign-in tokens from the database.

```bash
npx tsx scripts/get-signin-link.ts user@example.com
```

### `delete-user.ts`

Delete a user and their associated data (accounts, sessions, profile):

```bash
npx tsx scripts/delete-user.ts user@example.com
```

### `migrate-from-mongodb.ts`

One-time migration script for copying data from MongoDB to PostgreSQL:

```bash
npx tsx scripts/migrate-from-mongodb.ts \
  --mongodb "mongodb+srv://..." \
  --postgres "postgres://..."

# Preview without writing
npx tsx scripts/migrate-from-mongodb.ts --dry-run ...
```

Migrates: users, accounts, sessions, and profiles.

### `migrate-images-to-vercel-blob.ts`

Migration script for moving profile images from external CDNs (BunnyCDN, etc.) to Vercel Blob:

```bash
npx tsx scripts/migrate-images-to-vercel-blob.ts

# Preview changes without modifying
npx tsx scripts/migrate-images-to-vercel-blob.ts --dry-run
```

Requires `BLOB_READ_WRITE_TOKEN` environment variable.

### `reset-test-db.ts`

Reset the test database by truncating all tables (for CI):

```bash
npm run db:reset
# or
npx tsx scripts/reset-test-db.ts
```

### `validate-migrations.sh`

Validates Prisma migration files for naming conventions and standards:

```bash
./scripts/validate-migrations.sh          # Check all migrations
./scripts/validate-migrations.sh --staged # Check only staged migrations
```

Called automatically by pre-commit hook.

## Running Scripts

TypeScript scripts can be run with `npx tsx`:

```bash
npx tsx scripts/script-name.ts [args]
```

For shell scripts, ensure they're executable:

```bash
chmod +x scripts/script-name.sh
./scripts/script-name.sh
```

## Environment Variables

Scripts typically need access to:

- `POSTGRES_URL` or `DATABASE_URL` - PostgreSQL connection
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob access
- Other service-specific credentials

Load from `.env.local` or set in shell environment.

## Adding New Scripts

1. Create script in this directory
2. Use `.ts` for TypeScript, `.sh` for shell scripts
3. **Update this README** to document the new script
4. Consider adding npm script alias in `package.json`

> **Note:** The pre-commit hook will warn if scripts are modified without updating this README.

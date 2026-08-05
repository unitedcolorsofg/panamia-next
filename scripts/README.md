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

One-time migration from the legacy MongoDB export to PostgreSQL, moving every
BunnyCDN image into Cloudflare R2 on the way. It reads local dump files — there
is no live MongoDB connection.

```bash
# Preview: parses, maps and reports without writing. Reads no credentials.
npx tsx scripts/migrate-from-mongodb.ts --input ./mongodump/test --dry-run

# Full migration (rows + images)
npx tsx scripts/migrate-from-mongodb.ts --input ./mongodump/test

# Rows only, leaving images on BunnyCDN for a later pass
npx tsx scripts/migrate-from-mongodb.ts --input ./mongodump/test --skip-images

# The follow-up image pass (only touches rows still on a legacy CDN)
npx tsx scripts/migrate-from-mongodb.ts --images-only

# Fill empty columns on rows that already exist, instead of skipping them
npx tsx scripts/migrate-from-mongodb.ts --input ./mongodump/test --merge
```

**Input files** — per collection, first match wins: `<name>.json` (extended-JSON
array or JSONL), `<name>.jsonl`, or `<name>.bson` (needs `npm i -D bson`).

**What gets migrated:**

- `users.json` → `users` (the app-level collection, not `nextauth_*`)
- `profiles.json` → `profiles`
- legacy `profiles.slug` → `users.screenname`, so old `/p/<slug>` URLs keep working
- images (BunnyCDN → Cloudflare R2)

Sessions, accounts and newsletter signups are deliberately not migrated; the
script header explains why for each.

**Merging.** `--merge` only ever fills columns the existing row left empty, and
`false` counts as a value so live flags are never flipped on. The one exception
is `createdAt`, where the older timestamp wins — that is the real join date.
Columns where both sides hold different values are left alone and recorded under
`merged[].conflicts` in the report.

**The report matters.** Every run writes `migration-report-<timestamp>.json`
next to the input. A failed image transfer clears the image reference rather
than leaving a pointer at a CDN being switched off, so that report is the only
surviving record of those source URLs. Keep it.

**Requirements:**

- R2 credentials for the image pass, read from `.env.local` or the shell:
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
  `R2_PUBLIC_URL`. `--skip-images` needs none of them.
- A Postgres URL via `--postgres`, `$POSTGRES_DIRECT_URL`, or `$POSTGRES_URL`.
  Prefer the direct (unpooled) URL: postgres.js uses prepared statements, which
  Supabase's transaction-mode pooler rejects.
- The target database must already have the Drizzle migrations applied. Note
  that `0014_lockdown_public_schema_api` expects Supabase's `anon`,
  `authenticated` and `service_role` roles to exist.

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
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` - Cloudflare R2 access
- Other service-specific credentials

Load from `.env.local` or set in shell environment.

## Adding New Scripts

1. Create script in this directory
2. Use `.ts` for TypeScript, `.sh` for shell scripts
3. **Update this README** to document the new script
4. Consider adding npm script alias in `package.json`

> **Note:** The pre-commit hook will warn if scripts are modified without updating this README.

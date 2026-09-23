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

Two measured gotchas if you `curl` the link rather than opening it:

- **The dev server binds `::1` only.** `localhost:3003` and `[::1]:3003`
  answer; `127.0.0.1:3003` is refused with `curl: (7)`. That means the usual
  virtual-host recipe `--resolve host:port:127.0.0.1` silently never reaches
  the server, and an empty response body reads exactly like a broken route.
  Use `--resolve social.localhost:3003:[::1]`. Note Postgres is the opposite —
  `127.0.0.1:5433` is correct there — so the right loopback form differs per
  service.
- **Verify always redirects to the www host**, whichever host served it,
  because `callbackURL` is relative. Signing in on `social.localhost` still
  lands you on `localhost`. The social session is created regardless; check it
  with `/api/auth/get-session` rather than by looking at the page you land on.

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
- a placeholder `users` row per unclaimed profile (see below)
- images (BunnyCDN → Cloudflare R2)

Sessions, accounts and newsletter signups are deliberately not migrated; the
script header explains why for each.

**The legacy review queue.** `profiles.active` gates every public listing
query, and the old directory left 37 submissions unactioned behind it — some
for over two years. That queue was worked in 2026-08, so the import approves
every pending submission except the spam in `REJECTED_ON_REVIEW`, stamping
`status.approved` only where none exists. Legacy `status.declined` timestamps
are carried across for the record but no longer decide visibility; two of them
were a misclick and a reversal. Approvals are listed under `autoApproved`.

**Screennames** are truncated on a word boundary to fit the 24-character limit,
and collisions take a `-2`, `-3` suffix, rather than being dropped — a clipped
URL beats an unreachable profile, and renaming later is a supported flow. Only
reserved words and slugs that clean up to nothing are refused, under
`screennameRejects`; every clip is listed under `screennameTruncations`.

**Placeholder users.** `screenname` lives on `users`, and `/p/[user]` resolves
by walking `users.screenname → profiles.userId`, so a profile with no account
behind it has no public URL at all — the overwhelming majority of legacy
listings. The final row phase mints one inert user per unclaimed profile:
`emailVerified` false and no `accounts` row, so there is no credential and no
way to sign in as one. When the real owner arrives, better-auth's magic-link
flow looks a user up by email before creating one, so they are signed into that
row and land already owning their listing.

Two things follow from this. `auth.ts` `claimProfileForUser()` finds nothing
left to claim for these users, so its HighLevel lookup leans on a
first-ever-session check instead. And `profiles.userId` is `ON DELETE CASCADE`,
so undoing a run means clearing `profiles.user_id` **first** — deleting the
users directly takes the listings with them. The report's `placeholders[]`
records every profile/user id pair.

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

**There is no separate test database on a developer machine.** The script's own
docstring says to use it "only with a dedicated test database", and locally
that instruction cannot be followed: every worktree's `.env.local` points at
the same `127.0.0.1:5433/panamia`. Its safety check only rejects URLs
containing `prod`, `main` or `live`, so `panamia` passes it. Running this
locally truncates every table for **every** worktree and every running dev
server, not just yours. It does require `POSTGRES_URL` to be set in the
environment — it is not read from `.env.local` — which is the only thing
standing between a bare `yarn db:reset` and everyone else's data.

### `seed-dev-data.ts`

Seeds the committed base data fixture: users, profiles, `profile_owners` and
the business actor. Run it with the social seed via `db:seed`, which chains
both in the required order:

```bash
npm run db:seed
# or, base layer only
npx tsx scripts/seed-dev-data.ts
```

Run this **before** `seed-test-account.ts`, which resolves profiles by
screenname and silently skips the ones it cannot find.

The fixture is deliberately shaped so that local results mean something:

- Both branches of directory eligibility are present — an unclaimed intake
  listing (`profiles.userId` null) and a `small_business` sole trader — so the
  `featured` and `suggest` read paths can be told apart from dead code.
- Two rows must stay invisible: an unapproved submission (`active: false`) and
  an unclaimed personal profile. A read path that returns them is widened, not
  working.
- `seed_p_legacy` and `seed_biz_pending` differ only in `status.source`, so the
  OAuth auto-claim guard is observable attaching in one case and declining in
  the other. Ad-hoc local data left this column null, which
  `notBusinessListing()` passes, making the guard untestable in both directions.
- At least one business name carries a Spanish accent, because unaccented
  fixtures hide accent-sensitive matching. This is how the `suggest` typeahead
  bug was found.

Every row mirrors a production writer and names it in a comment, and the script
uses Drizzle rather than raw SQL so a schema change breaks it at `tsc` time.
It re-queries with the production predicates when it finishes and exits
non-zero if the shapes disagree — asserting ids rather than counts, since a
count cannot distinguish a guard that discriminates from one that rejects
everything.

Idempotent: re-running updates the `seed_`-prefixed rows in place.

**The local database is shared by every worktree.** All `.env.local` files
point at the same `127.0.0.1:5433/panamia`, so this seeds _the_ dev database,
not _a_ dev database. Two consequences worth knowing before you trust a local
measurement:

- Seeding while someone else is probing changes their results mid-run. Two
  sessions on this repo each recorded a measurement, disbelieved it when it
  later disagreed with itself, and assumed operator error — the database had
  changed underneath them.
- Rows you did not create are normal. Seeing unfamiliar data is not evidence
  of a bug or of a stale query.

This is why the verification block asserts specific `seed_`-prefixed ids
rather than row counts. A count is not stable in a database someone else is
writing to; an id is.

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

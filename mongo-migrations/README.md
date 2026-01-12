# MongoDB Schema Changelog

This directory tracks schema changes to MongoDB/Mongoose models. Unlike PostgreSQL (which uses Prisma Migrate), MongoDB schema changes happen directly in code. This changelog ensures changes are documented and PostgreSQL dependencies are validated.

## Why Track MongoDB Changes?

1. **Polyglot Coordination**: MongoDB documents reference PostgreSQL IDs - changes must be coordinated
2. **Team Awareness**: Schema changes affect queries, indexes, and data integrity
3. **Rollback Planning**: Document how to reverse changes if needed
4. **Audit Trail**: Know when and why schemas evolved

## Directory Structure

```
mongo-migrations/
├── README.md           # This file
├── CHANGELOG.md        # Summary of all changes (newest first)
└── changes/
    ├── 2025-01-15_profile_add_verification.md
    ├── 2025-01-10_notification_add_email_tracking.md
    └── ...
```

## When to Add a Changelog Entry

Add an entry in `changes/` when you modify any file in `lib/model/`:

- Adding/removing fields
- Changing field types
- Adding/modifying indexes
- Changing validation rules
- Adding/removing virtuals or methods

**The pre-commit hook will block commits** that modify `lib/model/*.ts` without a corresponding changelog entry.

## Changelog Entry Template

Create a file: `changes/YYYY-MM-DD_model_description.md`

```markdown
# [Model Name]: [Brief Description]

## Date

YYYY-MM-DD

## Ticket

PANA-XXX (or N/A)

## Model File

lib/model/example.ts

## PostgreSQL Dependencies

<!-- List any PostgreSQL tables/columns this change references -->

- **Required Migration**: 20250115_init_users_and_auth
- **Table**: users
- **Column**: id

<!-- Or if none: -->

None

## Changes

### Added Fields

- `fieldName`: Type - Description

### Modified Fields

- `fieldName`: OldType → NewType - Why

### Removed Fields

- `fieldName` - Why removed

### Index Changes

- Added index on `fieldName` for query performance

## Data Migration

<!-- How to handle existing documents -->

- [ ] Backfill script needed: scripts/backfill_xyz.ts
- [ ] Default value handles existing docs
- [ ] No migration needed (new field is optional)

## Rollback

<!-- How to reverse this change -->

1. Remove field from schema
2. (Optional) Run cleanup script to remove field from existing docs

## Testing

- [ ] Unit tests updated
- [ ] Verified with existing data
- [ ] Tested index performance
```

## See Also

- [DATABASE-ROADMAP.md](../docs/DATABASE-ROADMAP.md) - Overall database architecture
- [lib/types/cross-db-refs.ts](../lib/types/cross-db-refs.ts) - Type-safe PostgreSQL references

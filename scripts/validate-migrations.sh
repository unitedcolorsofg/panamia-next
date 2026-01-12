#!/bin/bash
# scripts/validate-migrations.sh
# Validates Prisma migration naming and documentation standards
#
# Usage:
#   ./scripts/validate-migrations.sh           # Validate all migrations
#   ./scripts/validate-migrations.sh --staged  # Validate only staged migrations (for pre-commit)
#
# Exit codes:
#   0 - All validations passed
#   1 - Validation errors found

set -e

MIGRATIONS_DIR="prisma/migrations"
ERRORS=0
STAGED_ONLY=false

# Parse arguments
if [ "$1" = "--staged" ]; then
  STAGED_ONLY=true
fi

# Pattern: 14-digit timestamp + underscore + snake_case (lowercase letters, numbers, underscores)
VALID_DIR_PATTERN='^[0-9]{14}_[a-z][a-z0-9_]*$'

# Required header fields in migration.sql
REQUIRED_HEADERS=("Purpose:" "Ticket:" "Reversible:")

echo "🗄️  Validating Prisma migrations..."

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ℹ️  No migrations directory found at $MIGRATIONS_DIR"
  echo "   This is expected if PostgreSQL migration hasn't started yet."
  exit 0
fi

# Get list of migrations to validate
if [ "$STAGED_ONLY" = true ]; then
  # Only check staged migration files
  MIGRATIONS_TO_CHECK=$(git diff --cached --name-only --diff-filter=A | grep -E "^$MIGRATIONS_DIR/[^/]+/migration\.sql$" | xargs -I{} dirname {} | xargs -I{} basename {} 2>/dev/null || true)

  if [ -z "$MIGRATIONS_TO_CHECK" ]; then
    echo "ℹ️  No new migrations staged"
    exit 0
  fi
else
  # Check all migrations
  MIGRATIONS_TO_CHECK=$(ls -1 "$MIGRATIONS_DIR" 2>/dev/null | grep -v "migration_lock.toml" || true)

  if [ -z "$MIGRATIONS_TO_CHECK" ]; then
    echo "ℹ️  No migrations found"
    exit 0
  fi
fi

# Validate each migration
for dirname in $MIGRATIONS_TO_CHECK; do
  dir="$MIGRATIONS_DIR/$dirname"

  # Skip if not a directory
  [ -d "$dir" ] || continue

  echo "  Checking: $dirname"

  # 1. Validate directory naming convention
  if ! [[ "$dirname" =~ $VALID_DIR_PATTERN ]]; then
    echo "    ❌ Invalid migration name: $dirname"
    echo "       Expected format: YYYYMMDDHHMMSS_snake_case_description"
    echo "       Example: 20250115093000_add_users_table"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # 2. Validate migration.sql exists
  sql_file="$dir/migration.sql"
  if [ ! -f "$sql_file" ]; then
    echo "    ❌ Missing migration.sql in $dirname"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # 3. Validate required documentation headers
  for header in "${REQUIRED_HEADERS[@]}"; do
    if ! head -30 "$sql_file" | grep -q "^-- $header"; then
      echo "    ❌ Missing '-- $header' header in migration.sql"
      ERRORS=$((ERRORS + 1))
    fi
  done
done

echo ""

if [ $ERRORS -gt 0 ]; then
  echo "❌ Found $ERRORS validation error(s)"
  echo ""
  echo "📋 Required migration.sql header format:"
  echo ""
  echo "   -- Migration: name_matching_folder"
  echo "   -- Purpose: Brief description of why this migration exists"
  echo "   -- Ticket: PANA-XXX or N/A for infrastructure"
  echo "   -- Reversible: Yes | No | Partial"
  echo "   --"
  echo "   -- Rollback: (optional but recommended)"
  echo "   --   DROP TABLE IF EXISTS table_name;"
  echo ""
  echo "See prisma/migrations/TEMPLATE.sql for a complete example."
  exit 1
fi

echo "✅ All migrations valid"

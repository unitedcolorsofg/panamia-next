#!/bin/bash
# scripts/validate-migrations.sh
# Validates Drizzle migration naming and documentation standards
#
# Usage:
#   ./scripts/validate-migrations.sh           # Validate all migrations
#   ./scripts/validate-migrations.sh --staged  # Validate only staged migrations (for pre-commit)
#
# Exit codes:
#   0 - All validations passed
#   1 - Validation errors found

set -e

MIGRATIONS_DIR="drizzle"
ERRORS=0
STAGED_ONLY=false

# Parse arguments
if [ "$1" = "--staged" ]; then
  STAGED_ONLY=true
fi

# Pattern: 4-digit sequence + underscore + snake_case (lowercase letters, numbers, underscores)
# Matches Drizzle Kit output: 0000_name.sql, 0001_add_users.sql, etc.
VALID_FILE_PATTERN='^[0-9]{4}_[a-z][a-z0-9_]*\.sql$'

# Required header fields in each migration file
REQUIRED_HEADERS=("Purpose:" "Ticket:" "Reversible:")

echo "Validating Drizzle migrations..."

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "No migrations directory found at $MIGRATIONS_DIR"
  echo "  Run 'npx drizzle-kit generate' to create the first migration."
  exit 0
fi

# Get list of migration files to validate
if [ "$STAGED_ONLY" = true ]; then
  # Only check staged migration files (flat .sql files, not meta/ snapshots)
  MIGRATIONS_TO_CHECK=$(git diff --cached --name-only --diff-filter=A \
    | grep -E "^$MIGRATIONS_DIR/[0-9]{4}_[a-z][a-z0-9_]*\.sql$" \
    | xargs -I{} basename {} 2>/dev/null || true)

  if [ -z "$MIGRATIONS_TO_CHECK" ]; then
    echo "No new migrations staged"
    exit 0
  fi
else
  # Check all migration files (exclude meta/ directory and TEMPLATE.sql)
  MIGRATIONS_TO_CHECK=$(ls -1 "$MIGRATIONS_DIR" 2>/dev/null \
    | grep -E "^[0-9]{4}_[a-z][a-z0-9_]*\.sql$" || true)

  if [ -z "$MIGRATIONS_TO_CHECK" ]; then
    echo "No migrations found"
    exit 0
  fi
fi

# Validate each migration file
for filename in $MIGRATIONS_TO_CHECK; do
  filepath="$MIGRATIONS_DIR/$filename"

  # Skip if not a file
  [ -f "$filepath" ] || continue

  echo "  Checking: $filename"

  # 1. Validate file naming convention
  if ! [[ "$filename" =~ $VALID_FILE_PATTERN ]]; then
    echo "    ERROR: Invalid migration name: $filename"
    echo "           Expected format: NNNN_snake_case_description.sql"
    echo "           Example: 0001_add_users_table.sql"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # 2. Validate required documentation headers (checked in first 30 lines)
  for header in "${REQUIRED_HEADERS[@]}"; do
    if ! head -30 "$filepath" | grep -q "^-- $header"; then
      echo "    ERROR: Missing '-- $header' header in $filename"
      ERRORS=$((ERRORS + 1))
    fi
  done
done

echo ""

if [ $ERRORS -gt 0 ]; then
  echo "ERROR: Found $ERRORS validation error(s)"
  echo ""
  echo "Required migration header format:"
  echo ""
  echo "   -- Migration: name_matching_file"
  echo "   -- Purpose: Brief description of why this migration exists"
  echo "   -- Ticket: PANA-XXX or N/A for infrastructure"
  echo "   -- Reversible: Yes | No | Partial"
  echo "   --"
  echo "   -- Rollback: (optional but recommended)"
  echo "   --   DROP TABLE IF EXISTS table_name;"
  echo ""
  echo "See drizzle/TEMPLATE.sql for a complete example."
  exit 1
fi

echo "All migrations valid"

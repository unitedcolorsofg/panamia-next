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

# =============================================================================
# Journal timestamp ordering check
# =============================================================================
# Each entry's `when` must be strictly greater than the previous entry's `when`.
# Drizzle's migrate() skips any entry whose `when` <= the last applied
# migration's `created_at` (which it stores as the folderMillis value),
# so an out-of-order timestamp silently skips the migration in CI/CD.
# See: drizzle-orm/pg-core/dialect.js migrate()

echo ""
echo "Checking _journal.json timestamp ordering..."

JOURNAL_FILE="drizzle/meta/_journal.json"

if [ "$STAGED_ONLY" = true ]; then
  JOURNAL_CONTENT=$(git show ":$JOURNAL_FILE" 2>/dev/null) || JOURNAL_CONTENT=""
  if [ -z "$JOURNAL_CONTENT" ]; then
    echo "  _journal.json not staged — skipping timestamp check"
  fi
else
  JOURNAL_CONTENT=$(cat "$JOURNAL_FILE" 2>/dev/null) || JOURNAL_CONTENT=""
fi

if [ -n "$JOURNAL_CONTENT" ]; then
  # Write JSON to a temp file (pipe + heredoc can't share stdin with python3 -).
  _TMPJSON=$(mktemp /tmp/journal_XXXXXX.json)
  _TMPPY=$(mktemp /tmp/check_journal_XXXXXX.py)
  echo "$JOURNAL_CONTENT" > "$_TMPJSON"
  cat > "$_TMPPY" <<'PYEOF'
import json, sys

with open(sys.argv[1]) as f:
    try:
        data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"  ERROR: Could not parse _journal.json: {e}")
        sys.exit(1)

entries = sorted(data.get("entries", []), key=lambda e: e.get("idx", 0))
errors = 0
prev_when = None
prev_tag = None

for entry in entries:
    idx  = entry.get("idx")
    when = entry.get("when")
    tag  = entry.get("tag", f"idx {idx}")

    if prev_when is not None and when <= prev_when:
        print(f"  ERROR: '{tag}' has when={when} which is not after")
        print(f"         '{prev_tag}' when={prev_when}.")
        print(f"         Drizzle will silently skip '{tag}' in CI/CD.")
        print(f"         Fix: set when > {prev_when} in drizzle/meta/_journal.json")
        errors += 1

    prev_when = when
    prev_tag  = tag

sys.exit(errors)
PYEOF
  python3 "$_TMPPY" "$_TMPJSON"
  JOURNAL_EXIT=$?
  rm -f "$_TMPJSON" "$_TMPPY"
  if [ $JOURNAL_EXIT -ne 0 ]; then
    ERRORS=$((ERRORS + JOURNAL_EXIT))
  else
    echo "  Timestamps are in order"
  fi
fi

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

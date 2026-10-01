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
STRICT=false

# Parse arguments (order-independent)
for arg in "$@"; do
  case "$arg" in
    --staged) STAGED_ONLY=true ;;
    --strict) STRICT=true ;;
  esac
done

# Pattern: 4-digit sequence + underscore + snake_case (lowercase letters, numbers, underscores)
# Matches Drizzle Kit output: 0000_name.sql, 0001_add_users.sql, etc.
VALID_FILE_PATTERN='^[0-9]{4}_[a-z][a-z0-9_]*\.sql$'

# Required header fields in each migration file
REQUIRED_HEADERS=("Purpose:" "Ticket:" "Reversible:")

echo "Validating Drizzle migrations..."

# =============================================================================
# Tool preflight -- fail closed
# =============================================================================
# Every file list below is built by piping through grep/xargs. When those are
# missing -- a Windows checkout without Git's usr/bin on PATH, for instance --
# the pipelines come back empty, the script prints "No new migrations staged"
# and exits 0 having validated nothing. Silence then reads as approval.
#
# That is not hypothetical: it is how 0048_recommendation_lists was committed
# with no _journal.json entry, passed this hook, passed CI, merged clean, and
# shipped to production without its tables. A guardrail that cannot run must
# say so rather than pass.
MISSING_TOOLS=""
for tool in grep xargs ls head basename; do
  command -v "$tool" >/dev/null 2>&1 || MISSING_TOOLS="$MISSING_TOOLS $tool"
done

if [ -n "$MISSING_TOOLS" ]; then
  echo ""
  echo "ERROR: required tool(s) not on PATH:$MISSING_TOOLS"
  echo "       This script builds its migration lists with these, so without"
  echo "       them every check below would silently report success."
  echo ""
  echo "       On Windows, add Git's Unix tools to PATH:"
  echo '         C:\Program Files\Git\usr\bin'
  exit 1
fi

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

  # 2. Validate required documentation headers (checked in the leading comment
  #    block). The window is generous on purpose: a migration that explains
  #    itself well has a long "Purpose:" block, and 0043_social_stories pushed
  #    "Reversible:" to line 31 under the old 30-line window -- failing a file
  #    that was in fact documented correctly. Punishing good prose is the
  #    opposite of what this check is for.
  for header in "${REQUIRED_HEADERS[@]}"; do
    if ! head -60 "$filepath" | grep -q "^-- $header"; then
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

# Windows/minimal environments may have no Python, or only the Microsoft Store
# stub that exits nonzero without running anything. Probe by executing a no-op
# rather than trusting command -v, the same way .husky/pre-commit does.
PYTHON=""
for candidate in python3 python py; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "" >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done

# Both journal checks below are Python-driven, and the completeness one is the
# only thing standing between an unjournaled migration and production. Skipping
# it is tolerable on a developer machine that has no interpreter; it is not
# tolerable in CI, which is the backstop of last resort. --strict says so.
if [ -z "$PYTHON" ] && [ "$STRICT" = true ]; then
  echo ""
  echo "ERROR: no working Python interpreter found (tried python3, python, py)."
  echo "       --strict requires one: the journal ordering and completeness"
  echo "       checks are Python-driven, and skipping them here would leave"
  echo "       nothing checking that migrations are reachable by drizzle-kit."
  exit 1
fi

JOURNAL_FILE="drizzle/meta/_journal.json"

if [ "$STAGED_ONLY" = true ]; then
  JOURNAL_CONTENT=$(git show ":$JOURNAL_FILE" 2>/dev/null) || JOURNAL_CONTENT=""
  if [ -z "$JOURNAL_CONTENT" ]; then
    echo "  _journal.json not staged — skipping timestamp check"
  fi
else
  JOURNAL_CONTENT=$(cat "$JOURNAL_FILE" 2>/dev/null) || JOURNAL_CONTENT=""
fi

if [ -z "$PYTHON" ]; then
  echo "  Skipping timestamp check (no working Python interpreter found)"
elif [ -n "$JOURNAL_CONTENT" ]; then
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
  "$PYTHON" "$_TMPPY" "$_TMPJSON"
  JOURNAL_EXIT=$?
  rm -f "$_TMPJSON" "$_TMPPY"
  if [ $JOURNAL_EXIT -ne 0 ]; then
    ERRORS=$((ERRORS + JOURNAL_EXIT))
  else
    echo "  Timestamps are in order"
  fi
fi

# =============================================================================
# Journal completeness check: every .sql file must have a journal entry
# =============================================================================
# drizzle-kit migrate reads _journal.json to determine which migrations exist.
# A .sql file without a journal entry is silently ignored by drizzle-kit.

echo "Checking _journal.json completeness..."

if [ -z "$PYTHON" ]; then
  # Without Python the tag list comes back empty, which would report every
  # migration as missing. Skip rather than emit false errors.
  echo "  Skipping completeness check (no working Python interpreter found)"
elif [ "$STAGED_ONLY" = true ]; then
  # In staged mode: check that every staged .sql migration also has a
  # corresponding entry in the staged (or working-tree) _journal.json.
  JOURNAL_TAGS=$(git show ":$JOURNAL_FILE" 2>/dev/null \
    | "$PYTHON" -c "import json,sys; d=json.load(sys.stdin); [print(e['tag']) for e in d.get('entries',[])]" 2>/dev/null || true)

  for filename in $MIGRATIONS_TO_CHECK; do
    tag="${filename%.sql}"
    if ! echo "$JOURNAL_TAGS" | grep -qx "$tag"; then
      echo "  ERROR: '$filename' has no entry in _journal.json (tag '$tag' missing)"
      echo "         drizzle-kit migrate will silently skip this migration."
      echo "         Add an entry to drizzle/meta/_journal.json."
      ERRORS=$((ERRORS + 1))
    fi
  done
else
  # In full mode: every .sql file in drizzle/ must appear in the journal.
  ALL_SQL=$(ls -1 "$MIGRATIONS_DIR" 2>/dev/null \
    | grep -E "^[0-9]{4}_[a-z][a-z0-9_]*\.sql$" || true)
  JOURNAL_TAGS=$("$PYTHON" -c "
import json, sys
with open('$JOURNAL_FILE') as f:
    d = json.load(f)
for e in d.get('entries', []):
    print(e['tag'])
" 2>/dev/null || true)

  for filename in $ALL_SQL; do
    tag="${filename%.sql}"
    if ! echo "$JOURNAL_TAGS" | grep -qx "$tag"; then
      echo "  ERROR: '$filename' has no entry in _journal.json (tag '$tag' missing)"
      echo "         drizzle-kit migrate will silently skip this migration."
      echo "         Add an entry to drizzle/meta/_journal.json."
      ERRORS=$((ERRORS + 1))
    fi
  done
fi

echo "  Journal completeness check done"

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

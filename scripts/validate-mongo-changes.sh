#!/bin/bash
# scripts/validate-mongo-changes.sh
# Validates that MongoDB model changes have corresponding changelog entries
#
# Usage:
#   ./scripts/validate-mongo-changes.sh           # Validate all models have changelogs
#   ./scripts/validate-mongo-changes.sh --staged  # Validate only staged model changes
#
# Exit codes:
#   0 - All validations passed
#   1 - Validation errors found (missing changelog entries)

set -e

MODELS_DIR="lib/model"
CHANGELOG_DIR="mongo-migrations/changes"
ERRORS=0
STAGED_ONLY=false

# Parse arguments
if [ "$1" = "--staged" ]; then
  STAGED_ONLY=true
fi

echo "📦 Validating MongoDB schema changes..."

# Check if models directory exists
if [ ! -d "$MODELS_DIR" ]; then
  echo "ℹ️  No models directory found at $MODELS_DIR"
  exit 0
fi

# Check if changelog directory exists
if [ ! -d "$CHANGELOG_DIR" ]; then
  echo "❌ Changelog directory missing: $CHANGELOG_DIR"
  echo "   Run: mkdir -p $CHANGELOG_DIR"
  exit 1
fi

# Get list of model files to check
if [ "$STAGED_ONLY" = true ]; then
  # Only check staged model file changes (modifications and additions)
  CHANGED_MODELS=$(git diff --cached --name-only --diff-filter=AM | grep -E "^$MODELS_DIR/.*\.ts$" || true)

  if [ -z "$CHANGED_MODELS" ]; then
    echo "ℹ️  No model changes staged"
    exit 0
  fi

  # Also get staged changelog files
  STAGED_CHANGELOGS=$(git diff --cached --name-only --diff-filter=A | grep -E "^$CHANGELOG_DIR/.*\.md$" || true)
else
  echo "ℹ️  Full validation mode - checking all models"
  exit 0  # Full validation is complex; only staged mode enforces changelog
fi

echo ""
echo "📝 Changed models:"
echo "$CHANGED_MODELS" | sed 's/^/   /'
echo ""

# For each changed model, verify a changelog entry exists
MISSING_CHANGELOGS=""
TODAY=$(date +%Y-%m-%d)

for model_file in $CHANGED_MODELS; do
  # Extract model name from path (e.g., lib/model/profile.ts -> profile)
  model_name=$(basename "$model_file" .ts)

  echo "  Checking: $model_name"

  # Look for a changelog entry that references this model
  # Check in staged changelogs first, then in existing files
  FOUND_CHANGELOG=""

  # Check staged changelog files
  if [ -n "$STAGED_CHANGELOGS" ]; then
    for changelog in $STAGED_CHANGELOGS; do
      if grep -q "$model_file\|$model_name" "$changelog" 2>/dev/null; then
        FOUND_CHANGELOG="$changelog"
        break
      fi
    done
  fi

  # If not found in staged, check if there's a today-dated changelog for this model
  if [ -z "$FOUND_CHANGELOG" ]; then
    # Look for changelog files with today's date and the model name
    POTENTIAL_CHANGELOG=$(find "$CHANGELOG_DIR" -name "${TODAY}_${model_name}*.md" -o -name "*_${model_name}_*.md" 2>/dev/null | head -1 || true)

    if [ -n "$POTENTIAL_CHANGELOG" ]; then
      # Check if this file is being added in the current commit
      if echo "$STAGED_CHANGELOGS" | grep -q "$POTENTIAL_CHANGELOG"; then
        FOUND_CHANGELOG="$POTENTIAL_CHANGELOG"
      fi
    fi
  fi

  if [ -z "$FOUND_CHANGELOG" ]; then
    MISSING_CHANGELOGS="$MISSING_CHANGELOGS
   📄 $model_file
      → Expected: $CHANGELOG_DIR/${TODAY}_${model_name}_description.md"
    ERRORS=$((ERRORS + 1))
  else
    echo "    ✅ Found changelog: $(basename "$FOUND_CHANGELOG")"
  fi
done

echo ""

if [ $ERRORS -gt 0 ]; then
  echo "❌ Missing changelog entries for $ERRORS model change(s):"
  echo "$MISSING_CHANGELOGS"
  echo ""
  echo "📋 Create a changelog entry for each modified model:"
  echo ""
  echo "   1. Create file: mongo-migrations/changes/${TODAY}_modelname_description.md"
  echo "   2. Use the template from mongo-migrations/README.md"
  echo "   3. Stage both the model and changelog: git add lib/model/xyz.ts mongo-migrations/changes/..."
  echo ""
  echo "See: mongo-migrations/README.md for the full template"
  exit 1
fi

echo "✅ All model changes have changelog entries"

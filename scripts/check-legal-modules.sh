#!/bin/sh
# =============================================================================
# Legal Module Coverage Check
# =============================================================================
# Validates that:
# 1. Every module ID (from "modules" + "cross_cutting") has a page file
# 2. Every module ID has an entry in module-content.tsx
# 3. No orphan module pages exist without a mapping
# 4. Every module ID has a versioned entry in terms/policy.json "modules"
# 5. Every "module" referenced by privacy/policy.json is a real module ID
# 6. (--staged) New app/ dirs are classified in namespaces.json
#
# Usage:
#   ./scripts/check-legal-modules.sh           # full check
#   ./scripts/check-legal-modules.sh --staged   # also check staged new dirs

LEGAL_DIR="app/legal/terms"
NAMESPACES="$LEGAL_DIR/namespaces.json"
MODULE_CONTENT="$LEGAL_DIR/module-content.tsx"
MODULES_DIR="$LEGAL_DIR/modules"
TERMS_POLICY="$LEGAL_DIR/policy.json"
PRIVACY_POLICY="app/legal/privacy/policy.json"

if [ ! -f "$NAMESPACES" ]; then
  echo "ERROR: $NAMESPACES not found"
  exit 1
fi

ERROR=""

# ---------------------------------------------------------------------------
# Extract all known module IDs from namespaces.json
# ---------------------------------------------------------------------------

# Module IDs from "modules" values (route → module mappings)
# Extract the value after the colon, strip quotes and trailing commas
ROUTE_MODULE_IDS=$(sed -n '/"modules":/,/\}/p' "$NAMESPACES" \
  | grep -E '"app/' \
  | sed 's/.*: *"//;s/".*//;s/,$//' \
  | sort -u)

# Cross-cutting module IDs (no dedicated route, but need pages)
# Extract just the cross_cutting line, then parse quoted values
CROSS_CUTTING_IDS=$(grep '"cross_cutting"' "$NAMESPACES" \
  | sed 's/.*\[//;s/\].*//' \
  | grep -oE '"[a-z]+"' \
  | sed 's/"//g' \
  | sort -u)

# All module IDs that need pages and content entries
ALL_MODULE_IDS=$(printf '%s\n%s' "$ROUTE_MODULE_IDS" "$CROSS_CUTTING_IDS" | sort -u)

# ---------------------------------------------------------------------------
# 1. Every module ID must have a page in modules/{id}/page.tsx
# ---------------------------------------------------------------------------

MISSING_PAGES=""
for id in $ALL_MODULE_IDS; do
  if [ ! -f "$MODULES_DIR/$id/page.tsx" ]; then
    MISSING_PAGES="$MISSING_PAGES
  $id -> $MODULES_DIR/$id/page.tsx"
  fi
done

if [ -n "$MISSING_PAGES" ]; then
  ERROR="1"
  echo ""
  echo "ERROR: Legal terms module pages missing:"
  echo "$MISSING_PAGES"
fi

# ---------------------------------------------------------------------------
# 2. Every module ID must have an entry in module-content.tsx
# ---------------------------------------------------------------------------

CONTENT_IDS=$(grep -oE "id: '[a-z]+'" "$MODULE_CONTENT" | sed "s/id: '//;s/'//")

MISSING_CONTENT=""
for id in $ALL_MODULE_IDS; do
  if ! echo "$CONTENT_IDS" | grep -qx "$id"; then
    MISSING_CONTENT="$MISSING_CONTENT
  $id"
  fi
done

if [ -n "$MISSING_CONTENT" ]; then
  ERROR="1"
  echo ""
  echo "ERROR: Module IDs missing from module-content.tsx:"
  echo "$MISSING_CONTENT"
fi

# ---------------------------------------------------------------------------
# 3. Reverse check: module pages without any mapping
# ---------------------------------------------------------------------------

ORPHAN_PAGES=""
for dir in "$MODULES_DIR"/*/; do
  [ -d "$dir" ] || continue
  id=$(basename "$dir")
  if ! echo "$ALL_MODULE_IDS" | grep -qx "$id"; then
    ORPHAN_PAGES="$ORPHAN_PAGES
  $id"
  fi
done

if [ -n "$ORPHAN_PAGES" ]; then
  ERROR="1"
  echo ""
  echo "ERROR: Module pages exist without a mapping in namespaces.json:"
  echo "$ORPHAN_PAGES"
  echo "  Add to \"modules\" (with a route) or \"cross_cutting\" (no dedicated route)"
fi

# ---------------------------------------------------------------------------
# 4. Every module ID must have a versioned entry in terms/policy.json
# ---------------------------------------------------------------------------
# policy.json carries the per-module version consumed by /api/consent/record.
# A module missing here silently records consent against no version.

if [ -f "$TERMS_POLICY" ]; then
  POLICY_IDS=$(sed -n '/"modules": \[/,/^  \]/p' "$TERMS_POLICY" \
    | grep '"name":' \
    | sed 's/.*"name": *"//;s/".*//' \
    | sort -u)

  MISSING_POLICY=""
  for id in $ALL_MODULE_IDS; do
    if ! echo "$POLICY_IDS" | grep -qx "$id"; then
      MISSING_POLICY="$MISSING_POLICY
  $id"
    fi
  done

  if [ -n "$MISSING_POLICY" ]; then
    ERROR="1"
    echo ""
    echo "ERROR: Module IDs missing from $TERMS_POLICY \"modules\":"
    echo "$MISSING_POLICY"
    echo "  Add an entry with a url, version, and status."
  fi

  ORPHAN_POLICY=""
  for id in $POLICY_IDS; do
    if ! echo "$ALL_MODULE_IDS" | grep -qx "$id"; then
      ORPHAN_POLICY="$ORPHAN_POLICY
  $id"
    fi
  done

  if [ -n "$ORPHAN_POLICY" ]; then
    ERROR="1"
    echo ""
    echo "ERROR: $TERMS_POLICY lists modules with no mapping in $NAMESPACES:"
    echo "$ORPHAN_POLICY"
  fi
fi

# ---------------------------------------------------------------------------
# 5. privacy/policy.json "module" refs must point at real module IDs
# ---------------------------------------------------------------------------
# Privacy categories tag themselves with the legal terms module they belong to.
# A typo would silently orphan the category rather than fail loudly.

if [ -f "$PRIVACY_POLICY" ]; then
  PRIVACY_REFS=$(grep -oE '"module": "[a-z_]+"' "$PRIVACY_POLICY" \
    | sed 's/.*: "//;s/"//' \
    | sort -u)

  BAD_REFS=""
  for id in $PRIVACY_REFS; do
    if ! echo "$ALL_MODULE_IDS" | grep -qx "$id"; then
      BAD_REFS="$BAD_REFS
  $id"
    fi
  done

  if [ -n "$BAD_REFS" ]; then
    ERROR="1"
    echo ""
    echo "ERROR: $PRIVACY_POLICY references unknown legal module IDs:"
    echo "$BAD_REFS"
    echo "  Each \"module\" must match a module ID in $NAMESPACES"
  fi
fi

# ---------------------------------------------------------------------------
# 6. (--staged) Check if staged files introduce unclassified app/ directories
# ---------------------------------------------------------------------------

if [ "$1" = "--staged" ]; then
  STAGED_DIRS=$(git diff --cached --name-only --diff-filter=A 2>/dev/null \
    | grep '^app/' \
    | sed -E 's|^(app/api/[^/]+)/.*|\1|; s|^(app/[^/]+)/.*|\1|' \
    | sort -u || true)

  # Load exempt list
  EXEMPT=$(sed -n '/"exempt":/,/\]/p' "$NAMESPACES" \
    | grep '"' | grep -v 'exempt' \
    | sed 's/.*"//;s/".*//')

  # Load mapped routes
  MAPPED=$(sed -n '/"modules":/,/\}/p' "$NAMESPACES" \
    | grep -E '"app/' \
    | sed 's/.*"//;s/".*//' \
    | sed 's/": *".*//')

  # Extract route keys (left side of the mapping)
  MAPPED_KEYS=$(sed -n '/"modules":/,/\}/p' "$NAMESPACES" \
    | grep -E '"app/' \
    | sed 's/^ *"//;s/".*//')

  UNCLASSIFIED=""
  for dir in $STAGED_DIRS; do
    [ -d "$dir" ] || continue

    IS_KNOWN=""
    for known in $MAPPED_KEYS $EXEMPT; do
      if [ "$dir" = "$known" ]; then
        IS_KNOWN="1"
        break
      fi
    done

    if [ -z "$IS_KNOWN" ]; then
      UNCLASSIFIED="$UNCLASSIFIED
  $dir"
    fi
  done

  if [ -n "$UNCLASSIFIED" ]; then
    echo ""
    echo "WARNING: New app/ directories not classified in $NAMESPACES:"
    echo "$UNCLASSIFIED"
    echo ""
    echo "Add each directory to namespaces.json as either:"
    echo "  - \"modules\": map to a legal terms module ID"
    echo "  - \"cross_cutting\": module with no dedicated route"
    echo "  - \"exempt\": no legal terms module needed"
  fi
fi

if [ -n "$ERROR" ]; then
  echo ""
  exit 1
fi

#!/usr/bin/env npx tsx
/**
 * Data Inventory Check
 *
 * Runs validateInventory() from lib/legal/data-inventory.ts, which binds the
 * privacy framework (app/legal/privacy/policy.json) to the Drizzle schema.
 *
 * Fails on any inconsistency:
 *   - unknown_category   a table references a category that is not in policy.json
 *   - uncovered_category a category is neither table-backed nor storage-free
 *
 * (Adding a table with no inventory entry is already a TypeScript compile
 * error, and there is no "classify later" state, so this script only has to
 * catch category-name and coverage mismatches, which the type system can't.)
 *
 * Usage: npx tsx scripts/check-data-inventory.ts
 */

import { validateInventory } from '../lib/legal/data-inventory';

const issues = validateInventory();

if (issues.length > 0) {
  console.error(
    `\nERROR: data inventory is inconsistent with policy.json (${issues.length}):`
  );
  for (const i of issues) console.error(`  [${i.kind}] ${i.detail}`);
  console.error(
    '\n  Fix lib/legal/data-inventory.ts or app/legal/privacy/policy.json so they agree.'
  );
  process.exit(1);
}

console.log('Data inventory is consistent with policy.json.');

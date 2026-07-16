#!/usr/bin/env npx tsx
/**
 * Data Inventory Check
 *
 * Runs validateInventory() from lib/legal/data-inventory.ts, which binds the
 * privacy framework (app/legal/privacy/policy.json) to the Drizzle schema.
 *
 * Fails the build on genuine inconsistencies:
 *   - unknown_category   a table references a category that is not in policy.json
 *   - uncovered_category a category is neither table-backed nor storage-free
 *
 * Reports, but does NOT fail on, the known backlog:
 *   - needs_classification  a table holds personal data with no category yet
 *
 * (Adding a table with no inventory entry is already a compile error, so this
 * script does not need to check for that.)
 *
 * Usage: npx tsx scripts/check-data-inventory.ts
 */

import { validateInventory } from '../lib/legal/data-inventory';

const issues = validateInventory();

const fatal = issues.filter(
  (i) => i.kind === 'unknown_category' || i.kind === 'uncovered_category'
);
const backlog = issues.filter((i) => i.kind === 'needs_classification');

if (backlog.length > 0) {
  console.log(
    `\nData inventory: ${backlog.length} table(s) hold personal data with no privacy category (backlog):`
  );
  for (const i of backlog) console.log(`  - ${i.detail}`);
  console.log(
    '  Resolve by adding a category to policy.json, or move to NOT_PERSONAL_DATA if truly not personal.'
  );
}

if (fatal.length > 0) {
  console.error(
    `\nERROR: data inventory is inconsistent with policy.json (${fatal.length}):`
  );
  for (const i of fatal) console.error(`  [${i.kind}] ${i.detail}`);
  console.error(
    '\n  Fix lib/legal/data-inventory.ts or app/legal/privacy/policy.json so they agree.'
  );
  process.exit(1);
}

console.log('\nData inventory is consistent with policy.json.');

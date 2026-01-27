#!/usr/bin/env npx tsx
/**
 * Validate Federation Dependencies
 *
 * Ensures all dependencies listed in lib/federation/DEPENDENCIES.json
 * are present in the root package.json with compatible versions.
 *
 * Usage:
 *   npx tsx scripts/validate-federation-deps.ts
 *
 * Exit codes:
 *   0 - All dependencies valid
 *   1 - Missing or incompatible dependencies found
 */

import * as fs from 'fs';
import * as path from 'path';

interface DepInfo {
  version: string | null;
  reason: string;
  imports: string[];
}

interface FederationDeps {
  dependencies: Record<string, DepInfo>;
  newDepsNeeded: string[];
}

const federationDepsPath = path.join(
  process.cwd(),
  'lib/federation/DEPENDENCIES.json'
);
const rootPkgPath = path.join(process.cwd(), 'package.json');

// Check if DEPENDENCIES.json exists
if (!fs.existsSync(federationDepsPath)) {
  console.log(
    'ℹ️  lib/federation/DEPENDENCIES.json not found - skipping validation'
  );
  console.log('   Run trace-federation-deps.ts to generate it');
  process.exit(0);
}

const federationDeps: FederationDeps = JSON.parse(
  fs.readFileSync(federationDepsPath, 'utf-8')
);
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
const rootDeps = {
  ...rootPkg.dependencies,
  ...rootPkg.devDependencies,
};

let hasErrors = false;
const missing: string[] = [];
const versionMismatch: Array<{
  dep: string;
  expected: string;
  actual: string;
}> = [];

console.log('🔍 Validating federation dependencies...\n');

for (const [dep, info] of Object.entries(federationDeps.dependencies)) {
  const rootVersion = rootDeps[dep];

  if (!rootVersion) {
    missing.push(dep);
    hasErrors = true;
    console.log(`❌ Missing: ${dep}`);
    console.log(`   Required by: ${info.imports[0]}`);
    if (info.version) {
      console.log(`   Suggested:   yarn add ${dep}@${info.version}`);
    }
    console.log('');
  } else if (info.version) {
    // Check version compatibility (simple major version comparison)
    const getMajor = (v: string): number => {
      const clean = v.replace(/^\^|~/, '');
      const match = clean.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const expectedMajor = getMajor(info.version);
    const actualMajor = getMajor(rootVersion);

    if (expectedMajor !== actualMajor) {
      versionMismatch.push({
        dep,
        expected: info.version,
        actual: rootVersion,
      });
      // Version mismatch is a warning, not an error
      console.log(`⚠️  Version mismatch: ${dep}`);
      console.log(`   Expected: ${info.version} (from activities.next)`);
      console.log(`   Actual:   ${rootVersion} (in package.json)`);
      console.log('');
    }
  }
}

// Summary
console.log('─'.repeat(50));

if (!hasErrors) {
  console.log('✅ All federation dependencies are valid\n');
  process.exit(0);
}

console.log('\n📋 Summary:');

if (missing.length > 0) {
  console.log(`\n   Missing dependencies (${missing.length}):`);
  for (const dep of missing) {
    const info = federationDeps.dependencies[dep];
    console.log(`   - ${dep}${info.version ? ` @ ${info.version}` : ''}`);
  }

  console.log('\n   To fix, run:');
  const addCmd = missing
    .map((dep) => {
      const info = federationDeps.dependencies[dep];
      return info.version ? `${dep}@${info.version}` : dep;
    })
    .join(' ');
  console.log(`   yarn add ${addCmd}`);
}

if (versionMismatch.length > 0) {
  console.log(`\n   Version mismatches (${versionMismatch.length}):`);
  for (const { dep, expected, actual } of versionMismatch) {
    console.log(`   - ${dep}: expected ${expected}, got ${actual}`);
  }
}

console.log('');
process.exit(1);

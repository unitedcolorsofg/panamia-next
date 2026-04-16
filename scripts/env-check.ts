#!/usr/bin/env npx tsx
/**
 * Environment Variable Validation Script
 *
 * Validates that required environment variables are set.
 * Automatically loads .env.local if it exists (for local development).
 * Run with: npm run env:check
 *
 * Exit codes:
 *   0 - All required variables are set
 *   1 - Missing required variables
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { config, parse as dotenvParse } from 'dotenv';

// Load .env.local if it exists (local dev), otherwise use raw env (CI)
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
}

import {
  envConfig,
  getSecrets,
  getVars,
  getCfRuntimeVars,
  generateWorkflowSnippet,
} from '../lib/env.config';

const wranglerPath = resolve(process.cwd(), 'wrangler.jsonc');

/**
 * Strip JSONC comments (// line and / * block * /) so JSON.parse can consume the file.
 * Naive but sufficient for our wrangler.jsonc — does not attempt to preserve comments
 * inside string literals (we control the file and have none).
 */
function parseJsonc<T = unknown>(source: string): T {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  return JSON.parse(stripped) as T;
}

function readWranglerVarKeys(): string[] | null {
  if (!existsSync(wranglerPath)) return null;
  const content = readFileSync(wranglerPath, 'utf-8');
  const parsed = parseJsonc<{ vars?: Record<string, unknown> }>(content);
  return Object.keys(parsed.vars ?? {});
}

const args = process.argv.slice(2);
const command = args[0];

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function printHelp() {
  console.log(`
${BOLD}Environment Variable Management${RESET}

Usage: npm run env:<command>

Commands:
  check     Validate required environment variables are set
  wrangler  Validate wrangler.jsonc \`vars\` block matches envConfig
  workflow  Generate GitHub Actions env snippet
  list      List all environment variables with their locations
  secrets   List variables that should be GitHub Secrets
  vars      List variables that should be GitHub Variables
`);
}

function checkEnv() {
  console.log(`\n${BOLD}Checking environment variables...${RESET}\n`);

  const missing: string[] = [];
  const present: string[] = [];
  const optional: string[] = [];
  const stale: string[] = [];
  const wranglerStale: string[] = [];
  const wranglerMissing: string[] = [];
  const wranglerMissingOptional: string[] = [];

  for (const [name, config] of Object.entries(envConfig)) {
    const value = process.env[name];

    if (config.required) {
      if (value) {
        present.push(name);
      } else {
        missing.push(name);
      }
    } else if (!value && config.location !== 'LOCAL') {
      optional.push(name);
    }
  }

  // Detect stale variables in .env.local that are no longer in envConfig
  if (existsSync(envLocalPath)) {
    const fileContent = readFileSync(envLocalPath, 'utf-8');
    const parsed = dotenvParse(fileContent);
    const knownKeys = new Set(Object.keys(envConfig));
    for (const key of Object.keys(parsed)) {
      if (!knownKeys.has(key)) {
        stale.push(key);
      }
    }
  }

  // Detect drift between wrangler.jsonc `vars` block and envConfig.
  //   - wranglerStale: keys in wrangler.jsonc that no longer exist in envConfig
  //   - wranglerMissing: runtime-target VARs in envConfig that aren't declared
  //     in wrangler.jsonc (and would be wiped on the next CF Workers Builds deploy)
  const wranglerKeys = readWranglerVarKeys();
  if (wranglerKeys !== null) {
    const knownKeys = new Set(Object.keys(envConfig));
    for (const key of wranglerKeys) {
      if (!knownKeys.has(key)) {
        wranglerStale.push(key);
      }
    }

    const declared = new Set(wranglerKeys);
    for (const name of getCfRuntimeVars()) {
      if (declared.has(name)) continue;
      if (envConfig[name].required) {
        wranglerMissing.push(name);
      } else {
        wranglerMissingOptional.push(name);
      }
    }
  }

  // Print results
  if (present.length > 0) {
    console.log(
      `${GREEN}OK Required variables present: ${present.length}${RESET}`
    );
  }

  if (missing.length > 0) {
    console.log(`\n${RED}MISSING required variables:${RESET}`);
    for (const name of missing) {
      const config = envConfig[name];
      console.log(`  ${RED}-${RESET} ${name} [${config.location}]`);
      console.log(`    ${config.description}`);
    }
  }

  if (stale.length > 0) {
    console.log(
      `\n${YELLOW}STALE variables in .env.local (not in envConfig):${RESET}`
    );
    for (const name of stale) {
      console.log(`  ${YELLOW}-${RESET} ${name}`);
    }
    console.log(
      `  ${YELLOW}Update or remove these from .env.local and lib/env.config.ts.${RESET}`
    );
  }

  if (wranglerStale.length > 0) {
    console.log(
      `\n${RED}STALE variables in wrangler.jsonc \`vars\` (not in envConfig):${RESET}`
    );
    for (const name of wranglerStale) {
      console.log(`  ${RED}-${RESET} ${name}`);
    }
    console.log(
      `  ${YELLOW}Remove from wrangler.jsonc or add to lib/env.config.ts.${RESET}`
    );
  }

  if (wranglerMissing.length > 0) {
    console.log(
      `\n${RED}MISSING required runtime VARs from wrangler.jsonc \`vars\`:${RESET}`
    );
    for (const name of wranglerMissing) {
      const config = envConfig[name];
      console.log(`  ${RED}-${RESET} ${name}`);
      console.log(`    ${config.description}`);
    }
    console.log(
      `  ${YELLOW}These runtime VARs would be wiped on the next CF Workers Builds deploy.${RESET}`
    );
    console.log(
      `  ${YELLOW}Declare them in wrangler.jsonc \`vars\`, or set cfTarget: 'build' in envConfig${RESET}`
    );
    console.log(`  ${YELLOW}if they are baked at build time instead.${RESET}`);
  }

  if (wranglerMissingOptional.length > 0 && args.includes('--verbose')) {
    console.log(
      `\n${YELLOW}Optional runtime VARs not declared in wrangler.jsonc \`vars\`:${RESET}`
    );
    for (const name of wranglerMissingOptional) {
      console.log(`  ${YELLOW}-${RESET} ${name}`);
    }
    console.log(
      `  ${YELLOW}If you start using one in production, declare it here so CF Workers Builds doesn't wipe it.${RESET}`
    );
  }

  if (optional.length > 0 && args.includes('--verbose')) {
    console.log(
      `\n${YELLOW}Optional variables not set: ${optional.length}${RESET}`
    );
    for (const name of optional) {
      console.log(`  ${YELLOW}-${RESET} ${name}`);
    }
  }

  console.log('');

  if (
    missing.length > 0 ||
    stale.length > 0 ||
    wranglerStale.length > 0 ||
    wranglerMissing.length > 0
  ) {
    console.log(`${RED}${BOLD}Environment validation failed!${RESET}`);
    if (missing.length > 0) {
      console.log(
        `Set the missing variables in .env.local or GitHub Secrets/Variables.`
      );
    }
    if (stale.length > 0) {
      console.log(
        `Remove stale variables from .env.local (they are no longer used).`
      );
    }
    if (wranglerStale.length > 0) {
      console.log(
        `Remove stale entries from wrangler.jsonc \`vars\` or add them to lib/env.config.ts.`
      );
    }
    if (wranglerMissing.length > 0) {
      console.log(
        `Declare missing runtime VARs in wrangler.jsonc \`vars\` so CF Workers Builds preserves them.`
      );
    }
    console.log('');
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}Environment validation passed!${RESET}\n`);
    process.exit(0);
  }
}

/**
 * Structural check: wrangler.jsonc `vars` block ↔ envConfig.
 * Does not touch process.env, so it's safe to run from a pre-commit hook
 * even when .env.local is absent.
 *
 * Errors:
 *   - keys in wrangler.jsonc not declared in envConfig (stale)
 *   - required runtime VARs in envConfig missing from wrangler.jsonc (gap)
 */
function checkWranglerSync() {
  console.log(`\n${BOLD}Checking wrangler.jsonc vars sync...${RESET}\n`);

  const wranglerKeys = readWranglerVarKeys();
  if (wranglerKeys === null) {
    console.log(`${YELLOW}wrangler.jsonc not found — skipping.${RESET}\n`);
    process.exit(0);
  }

  const stale: string[] = [];
  const missing: string[] = [];
  const knownKeys = new Set(Object.keys(envConfig));
  for (const key of wranglerKeys) {
    if (!knownKeys.has(key)) stale.push(key);
  }
  const declared = new Set(wranglerKeys);
  for (const name of getCfRuntimeVars()) {
    if (!declared.has(name) && envConfig[name].required) {
      missing.push(name);
    }
  }

  if (stale.length > 0) {
    console.log(`${RED}STALE keys in wrangler.jsonc \`vars\`:${RESET}`);
    for (const name of stale) console.log(`  ${RED}-${RESET} ${name}`);
    console.log(
      `  ${YELLOW}Remove from wrangler.jsonc or add to lib/env.config.ts.${RESET}\n`
    );
  }

  if (missing.length > 0) {
    console.log(
      `${RED}MISSING required runtime VARs from wrangler.jsonc \`vars\`:${RESET}`
    );
    for (const name of missing) {
      console.log(`  ${RED}-${RESET} ${name}`);
      console.log(`    ${envConfig[name].description}`);
    }
    console.log(
      `  ${YELLOW}Without these declarations, CF Workers Builds wipes them on deploy.${RESET}\n`
    );
  }

  if (stale.length > 0 || missing.length > 0) {
    console.log(`${RED}${BOLD}wrangler.jsonc sync failed!${RESET}\n`);
    process.exit(1);
  }

  console.log(`${GREEN}${BOLD}wrangler.jsonc vars are in sync!${RESET}\n`);
  process.exit(0);
}

function listAll() {
  console.log(`\n${BOLD}All Environment Variables${RESET}\n`);

  const byLocation: Record<string, string[]> = {
    SECRET: [],
    VAR: [],
    LOCAL: [],
  };

  for (const [name, config] of Object.entries(envConfig)) {
    byLocation[config.location].push(name);
  }

  for (const [location, names] of Object.entries(byLocation)) {
    const color =
      location === 'SECRET' ? RED : location === 'VAR' ? BLUE : YELLOW;
    console.log(
      `${color}${BOLD}[${location}]${RESET} (${names.length} variables)`
    );
    for (const name of names.sort()) {
      const config = envConfig[name];
      const required = config.required ? `${RED}*${RESET}` : ' ';
      console.log(`  ${required} ${name}`);
    }
    console.log('');
  }

  console.log(`${RED}*${RESET} = required\n`);
}

function listSecrets() {
  console.log(`\n${BOLD}GitHub Secrets${RESET}\n`);
  console.log(
    'These variables contain sensitive data and should be stored as GitHub Secrets:\n'
  );

  for (const name of getSecrets().sort()) {
    const config = envConfig[name];
    const required = config.required
      ? `${RED}(required)${RESET}`
      : '(optional)';
    console.log(`  ${name} ${required}`);
  }
  console.log('');
}

function listVars() {
  console.log(`\n${BOLD}GitHub Variables${RESET}\n`);
  console.log(
    'These variables are non-sensitive and can be stored as GitHub Variables:\n'
  );

  for (const name of getVars().sort()) {
    const config = envConfig[name];
    const required = config.required
      ? `${RED}(required)${RESET}`
      : '(optional)';
    console.log(`  ${name} ${required}`);
  }
  console.log('');
}

function printWorkflow() {
  console.log(`\n${BOLD}GitHub Actions Workflow Snippet${RESET}\n`);
  console.log(
    'Copy this into your workflow file under the build/test steps:\n'
  );
  console.log('---');
  console.log(generateWorkflowSnippet());
  console.log('---\n');
}

// Main
switch (command) {
  case 'check':
    checkEnv();
    break;
  case 'workflow':
    printWorkflow();
    break;
  case 'list':
    listAll();
    break;
  case 'secrets':
    listSecrets();
    break;
  case 'vars':
    listVars();
    break;
  case 'wrangler':
    checkWranglerSync();
    break;
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;
  default:
    // Default to check
    checkEnv();
}

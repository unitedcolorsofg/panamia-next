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

import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// Load .env.local if it exists (local dev), otherwise use raw env (CI)
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
}

import {
  envConfig,
  getSecrets,
  getVars,
  generateWorkflowSnippet,
} from '../lib/env.config';

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

  // Print results
  if (present.length > 0) {
    console.log(
      `${GREEN}✓ Required variables present: ${present.length}${RESET}`
    );
  }

  if (missing.length > 0) {
    console.log(`\n${RED}✗ Missing required variables:${RESET}`);
    for (const name of missing) {
      const config = envConfig[name];
      console.log(`  ${RED}•${RESET} ${name} [${config.location}]`);
      console.log(`    ${config.description}`);
    }
  }

  if (optional.length > 0 && args.includes('--verbose')) {
    console.log(
      `\n${YELLOW}○ Optional variables not set: ${optional.length}${RESET}`
    );
    for (const name of optional) {
      console.log(`  ${YELLOW}•${RESET} ${name}`);
    }
  }

  console.log('');

  if (missing.length > 0) {
    console.log(`${RED}${BOLD}Environment validation failed!${RESET}`);
    console.log(
      `Set the missing variables in .env.local or GitHub Secrets/Variables.\n`
    );
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}Environment validation passed!${RESET}\n`);
    process.exit(0);
  }
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
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;
  default:
    // Default to check
    checkEnv();
}

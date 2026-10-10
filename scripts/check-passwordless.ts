#!/usr/bin/env npx tsx
/**
 * Passwordless Check
 *
 * Section 7 of the published privacy policy tells members "We never create or
 * store a password for your account." That bullet renders from
 * securityPosture.passwordless in app/legal/privacy/policy.json, and this
 * script keeps the flag honest by refusing a commit that enables password
 * auth while it is still true.
 *
 * The schema can't enforce this on its own. accounts.password exists because
 * better-auth's account model requires the column, so it can't be dropped as
 * proof that nothing writes it. What actually decides whether we hold a
 * password is one key in auth.ts: configuring emailAndPassword makes
 * better-auth start hashing and storing into that column immediately, with no
 * migration and nothing else to notice.
 *
 * Fails on:
 *   - auth.ts configures emailAndPassword while passwordless is true
 *   - auth.ts is missing or unreadable (the claim can no longer be verified)
 *
 * If password auth is ever a deliberate product decision, this script is not
 * the thing to delete: set passwordless to false in policy.json, which drops
 * the claim from the rendered policy, and this check stands down on its own.
 *
 * Usage: npx tsx scripts/check-passwordless.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { passwordless } from '../lib/legal/privacy-policy';

const AUTH_PATH = resolve(process.cwd(), 'auth.ts');

if (!passwordless) {
  console.log(
    'policy.json does not claim passwordless auth; skipping auth.ts check.'
  );
  process.exit(0);
}

let source: string;
try {
  source = readFileSync(AUTH_PATH, 'utf8');
} catch {
  console.error(
    `\nERROR: cannot read ${AUTH_PATH}, so the passwordless claim in the privacy policy cannot be verified.`
  );
  console.error(
    '\n  If auth.ts moved, update AUTH_PATH in scripts/check-passwordless.ts.'
  );
  process.exit(1);
}

// Comments are stripped first so that prose about emailAndPassword (including
// this script's own reasoning, were it ever quoted there) can't trip the
// check. The line-comment pattern deliberately ignores "//" preceded by a
// colon, because auth.ts contains http:// origins in trustedOrigins.
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

if (/\bemailAndPassword\b/.test(code)) {
  console.error(
    '\nERROR: auth.ts configures emailAndPassword, but the privacy policy claims we hold no passwords.'
  );
  console.error(
    '\n  Section 7 of /legal/privacy currently tells members: "We never create or store'
  );
  console.error(
    '  a password for your account." Enabling emailAndPassword makes better-auth write'
  );
  console.error(
    '  hashed passwords to accounts.password, which makes that published statement false.'
  );
  console.error('\n  Either remove the emailAndPassword configuration, or, if');
  console.error(
    '  password auth is intended, set securityPosture.passwordless to false in'
  );
  console.error(
    '  app/legal/privacy/policy.json and review section 7 before shipping.'
  );
  process.exit(1);
}

console.log('auth.ts holds no password configuration, as the policy claims.');

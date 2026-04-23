/**
 * Generates .dev.vars from .env.local for wrangler dev / vinext dev.
 *
 * Wrangler reads .dev.vars and injects ALL its entries as env bindings
 * (env.KEY) into the Worker at runtime. This is the standard way to
 * provide local secrets to a Cloudflare Worker dev server.
 *
 * Run once after cloning or updating .env.local:
 *   yarn dev:setup
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { parse } from 'dotenv';

const KEYS = [
  'POSTGRES_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'ADMIN_EMAILS',
  'RECAPTCHA_SECRET_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RECAPTCHA_SECRET_KEY',
];

if (!existsSync('.env.local')) {
  console.error('No .env.local found. Create it first.');
  process.exit(1);
}

const env = parse(readFileSync('.env.local'));
const lines = KEYS.filter((k) => env[k]).map((k) => `${k}=${env[k]}`);
writeFileSync('.dev.vars', lines.join('\n') + '\n');
console.log(`Created .dev.vars with ${lines.length} variables.`);

/**
 * Generates .dev.vars from .env.local for wrangler dev / vinext dev.
 *
 * Wrangler reads .dev.vars and injects ALL its entries as env bindings
 * (env.KEY) into the Worker at runtime. This is the standard way to
 * provide local secrets to a Cloudflare Worker dev server.
 *
 * Run once after cloning or updating .env.local:
 *   yarn dev:setup
 *
 * IMPORTANT: once .dev.vars exists it REPLACES .env.local as the env source
 * (the dev server logs "Using secrets defined in .dev.vars"). Any key that is
 * in .env.local but missing from KEYS below is therefore silently dropped, and
 * the value from wrangler.jsonc `vars` applies instead. If you add a var to
 * .env.local that must take effect locally, add it to KEYS too.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { parse } from 'dotenv';

const KEYS = [
  'POSTGRES_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'ADMIN_EMAILS',
  'TURNSTILE_SECRET_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  // Must be carried through even when empty: wrangler.jsonc sets this to
  // ".pana.social" for production, and browsers reject that cookie domain on
  // a localhost host. An empty value here restores host-only cookies so local
  // sign-in works. Without it, sign-in redirects correctly but lands signed out.
  'PANAVERSE_COOKIE_DOMAIN',
  // Not a live break today: wrangler.jsonc pins this to the same "pana.social"
  // that .env.local.example ships, so dropping it changed nothing. Carried
  // through so an *explicit* local override survives `dev:setup` — and because
  // an unset value is not inert: lib/federation/domain.ts falls back to the UI
  // host, so a plain `dev` run with no value mints actor URIs under localhost.
  'FEDERATION_DOMAIN',
  // Actor signing keys are encrypted with this (lib/federation/crypto/
  // key-encryption.ts) and creation fails closed without it, so dropping it
  // would make `db:seed` fail at createActorForProfile. Generated below when
  // absent so a fresh local checkout works without hunting for a value; the
  // dev key is disposable because dev actors are.
  'FEDERATION_KEY_SECRET',
];

if (!existsSync('.env.local')) {
  console.error('No .env.local found. Create it first.');
  process.exit(1);
}

const env = parse(readFileSync('.env.local'));

// Actor key encryption fails closed, so an absent or blank secret would make
// `db:seed` fail rather than degrade. Mint a disposable one for local use.
// Only ever fills a gap -- an explicit value is left untouched, so this can
// never overwrite a real secret someone pasted in.
if (!env.FEDERATION_KEY_SECRET) {
  env.FEDERATION_KEY_SECRET = randomBytes(32).toString('base64');
  console.log(
    'FEDERATION_KEY_SECRET was empty; generated a random one for local dev.\n' +
      '  Dev-only. Production must set its own, and must not reuse this.'
  );
}

// Deliberately `!== undefined` rather than truthy: an empty value is meaningful
// (see PANAVERSE_COOKIE_DOMAIN above) and must be written, not dropped.
const lines = KEYS.filter((k) => env[k] !== undefined).map(
  (k) => `${k}=${env[k]}`
);
writeFileSync('.dev.vars', lines.join('\n') + '\n');
console.log(`Created .dev.vars with ${lines.length} variables.`);

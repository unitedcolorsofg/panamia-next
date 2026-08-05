#!/usr/bin/env npx tsx
/**
 * One-Time Migration: legacy MongoDB export -> PostgreSQL + R2
 *
 * Reads collection dumps from a local directory (no live MongoDB connection)
 * and maps the legacy `users` + `profiles` documents onto the current
 * Drizzle schema, re-hosting every BunnyCDN image in Cloudflare R2 along the way.
 *
 * Usage:
 *   npx tsx scripts/migrate-from-mongodb.ts --input ./mongo-export [--postgres "postgres://..."]
 *
 * Options:
 *   --input <dir>    Directory holding the exported collection files (required)
 *   --postgres <url> PostgreSQL connection string (falls back to $POSTGRES_DIRECT_URL)
 *   --dry-run        Parse and report without writing (reads no credentials)
 *   --skip-images    Import rows only; leave image URLs pointing at BunnyCDN
 *   --images-only    Re-run just the image pass over already-migrated profiles.
 *                    Safe to repeat — it only touches rows still on a legacy CDN,
 *                    which is the follow-up path after a --skip-images import.
 *   --merge          On an email collision, fill the existing row's EMPTY columns
 *                    from the legacy record rather than skipping it. Purely
 *                    additive: a column that already holds a value is never
 *                    touched, and `false` counts as a value (so a live flag such
 *                    as profiles.active is never flipped on by a merge).
 *   --report <path>  JSON report output (default <input>/migration-report-<ts>.json)
 *
 * Accepted file formats, per collection, first match wins:
 *   <collection>.json   extended-JSON array, or JSONL (one doc per line)
 *   <collection>.jsonl  JSONL
 *   <collection>.bson   mongodump output (requires `npm i bson`)
 *
 * Collections consumed:
 *   users    -> users      (the app-level collection: email, status.role,
 *                          affiliate, following — not the nextauth_* auth store)
 *   profiles -> profiles
 *
 * The legacy `profiles.slug` becomes `users.screenname`, which is what drives
 * the public /p/[user] route today, so old profile URLs keep resolving. Slugs
 * that fail validateScreenname() or collide are reported and left unset;
 * unclaimed profiles have no user row, so those slugs are dropped and the
 * screenname gets picked after auto-claim.
 *
 * Images move from BunnyCDN to R2 in the same run. Two traps, both verified
 * against live data: the pull zone hotlinks on Referer (see LEGACY_CDN_REFERER),
 * and it serves WebP bytes under `.jpg` keys labelled `image/jpeg`, so the
 * stored type comes from magic-byte sniffing rather than the name. A transfer
 * that fails after retries clears the image reference instead of leaving a
 * pointer at a CDN being switched off — the owner re-uploads.
 *
 * Deliberately NOT migrated:
 *   - nextauth_users: the auth-side mirror of `users`. The only field it adds is
 *     emailVerified, which we intentionally reset (see the users phase), so it
 *     would contribute nothing.
 *   - nextauth_sessions: every legacy session is expired and better-auth issues
 *     its own tokens, so importing them would only add dead rows.
 *   - nextauth_accounts: Google sign-in was never implemented, and the OAuth
 *     callback origin has changed with the new domain, so legacy provider links
 *     would be dead on arrival.
 *   - newsletter signups: newsletter handling now lives entirely in HighLevel.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { config as loadDotenv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import * as schema from '../lib/schema';
import { validateScreenname } from '../lib/screenname';
import type {
  ProfileDescriptions,
  PronounsInterface,
  ProfileSocialsInterface,
  ProfileImagesInterface,
  AddressInterface,
} from '../lib/interfaces';

type DB = PostgresJsDatabase<typeof schema>;
type Json = Record<string, unknown>;

const { users, profiles } = schema;

/** Hosts we are migrating away from. BunnyCDN is deprecated in the new design. */
const LEGACY_CDN_PATTERNS = ['b-cdn.net', 'bunnycdn'];
/**
 * The pull zone has hotlink protection on, and its allowed-referrer list holds
 * the legacy origin only — verified 2026-08-04: this exact value returns 200,
 * while the apex, pana.social, the workers.dev host, and no referrer all 403.
 * If that entry is ever removed, every transfer fails and the assets become
 * unreachable, so this migration wants to run while it still holds.
 */
const LEGACY_CDN_REFERER = 'https://www.panamia.club/';
const IMAGE_CONCURRENCY = 4;
const IMAGE_ATTEMPTS = 3;

/**
 * lib/blob/api.ts builds its R2 endpoint from the environment at module
 * evaluation time, and ESM evaluates every static import before the first
 * statement of this file runs — so importing it up top would freeze the
 * endpoint as `https://undefined.r2.cloudflarestorage.com` (Cloudflare rejects
 * that SNI with a TLS alert 40, which reads as an inscrutable handshake
 * failure). Loading it lazily, after parseArgs() has read .env.local, is what
 * makes uploads work; it also keeps --dry-run from touching credentials at all.
 */
type UploadFile = (fileName: string, file: Buffer) => Promise<string | null>;
let cachedUploadFile: UploadFile | null = null;

async function getUploadFile(): Promise<UploadFile> {
  if (!cachedUploadFile) {
    ({ uploadFile: cachedUploadFile } = await import('../lib/blob/api'));
  }
  return cachedUploadFile;
}

// =============================================================================
// Args
// =============================================================================

interface MigrationArgs {
  input: string;
  postgresUrl: string;
  dryRun: boolean;
  skipImages: boolean;
  imagesOnly: boolean;
  merge: boolean;
  reportPath: string;
}

const USAGE = `
Usage: npx tsx scripts/migrate-from-mongodb.ts --input <dir> [options]

Options:
  --input <dir>     Directory holding exported collection files (required)
  --postgres <url>  PostgreSQL connection string (falls back to $POSTGRES_DIRECT_URL,
                    then $POSTGRES_URL)
  --dry-run         Parse and report without writing (reads no credentials)
  --skip-images     Import rows only; leave image URLs on BunnyCDN
  --images-only     Re-run only the image pass over already-migrated profiles
  --merge           When a row already exists for an email, fill its EMPTY
                    columns from the legacy record instead of skipping it.
                    Never overwrites a value that is already set.
  --report <path>   JSON report output (default <input>/migration-report-<ts>.json)
`;

function parseArgs(): MigrationArgs {
  const argv = process.argv.slice(2);
  let input = '';
  let postgresUrl = '';
  let dryRun = false;
  let skipImages = false;
  let imagesOnly = false;
  let merge = false;
  let reportPath = '';

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--input' && value) {
      input = value;
      i++;
    } else if (flag === '--postgres' && value) {
      postgresUrl = value;
      i++;
    } else if (flag === '--report' && value) {
      reportPath = value;
      i++;
    } else if (flag === '--dry-run') {
      dryRun = true;
    } else if (flag === '--skip-images') {
      skipImages = true;
    } else if (flag === '--images-only') {
      imagesOnly = true;
    } else if (flag === '--merge') {
      merge = true;
    } else {
      console.error(`Unknown or incomplete argument: ${flag}`);
      console.error(USAGE);
      process.exit(1);
    }
  }

  if (skipImages && imagesOnly) {
    console.error('Error: --skip-images and --images-only are contradictory.');
    process.exit(1);
  }
  if (!input && !imagesOnly) {
    console.error('Error: --input is required.');
    console.error(USAGE);
    process.exit(1);
  }
  if (input && (!fs.existsSync(input) || !fs.statSync(input).isDirectory())) {
    console.error(`Error: --input is not a directory: ${input}`);
    process.exit(1);
  }

  // A dry run neither connects nor reads credentials, so the environment is
  // only consulted when we are actually going to write.
  if (!dryRun) {
    loadDotenv({ path: '.env.local', quiet: true });
    if (!postgresUrl) {
      // Prefer the direct (unpooled) URL, same precedence as drizzle.config.ts.
      // postgres.js uses prepared statements by default, which Supabase's
      // transaction-mode pooler rejects — and this is a one-shot bulk load with
      // no reason to go through a pooler anyway.
      postgresUrl =
        process.env.POSTGRES_DIRECT_URL ?? process.env.POSTGRES_URL ?? '';
    }
    if (!postgresUrl) {
      console.error(
        'Error: --postgres (or $POSTGRES_DIRECT_URL / $POSTGRES_URL) is required unless --dry-run.'
      );
      process.exit(1);
    }
  }

  if (!reportPath) {
    // Timestamped: the report is the only record of images that failed to
    // transfer and had their references cleared, so a later run (say
    // --images-only) must not overwrite an earlier one.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    reportPath = path.join(input || '.', `migration-report-${stamp}.json`);
  }

  return {
    input,
    postgresUrl,
    dryRun,
    skipImages,
    imagesOnly,
    merge,
    reportPath,
  };
}

/**
 * uploadFile() takes the S3-compatible path outside CF Workers, so a plain
 * `tsx` run needs the full credential set rather than just the bucket binding.
 */
function assertR2Configured(): void {
  const missing = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL',
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `Error: image migration needs these env vars (from .env.local or the shell): ${missing.join(', ')}\n` +
        `  Pass --skip-images to import rows without moving images.`
    );
    process.exit(1);
  }
}

// =============================================================================
// Extended JSON / BSON loading
// =============================================================================

/**
 * Collapse MongoDB extended-JSON wrappers into plain JS values:
 *   {$oid}                        -> string
 *   {$date:{$numberLong}} | $date -> Date
 *   {$numberInt|Long|Double|Decimal} -> number
 * Everything else is walked recursively and returned structurally unchanged.
 */
function normalizeEjson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeEjson);
  if (value === null || typeof value !== 'object') return value;

  const obj = value as Json;
  const keys = Object.keys(obj);

  if (keys.length === 1) {
    const [key] = keys;
    const inner = obj[key];

    if (key === '$oid') return String(inner);
    if (key === '$date') {
      const raw = normalizeEjson(inner);
      if (raw instanceof Date) return raw;
      if (typeof raw === 'number' || typeof raw === 'string') {
        return new Date(raw);
      }
      return null;
    }
    if (
      key === '$numberInt' ||
      key === '$numberLong' ||
      key === '$numberDouble' ||
      key === '$numberDecimal'
    ) {
      return Number(inner);
    }
    if (key === '$binary' || key === '$undefined') return null;
  }

  const out: Json = {};
  for (const [key, inner] of Object.entries(obj)) {
    out[key] = normalizeEjson(inner);
  }
  return out;
}

function parseJsonDocuments(text: string, source: string): Json[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Extended-JSON array (mongoexport --jsonArray, or a hand-saved array).
  if (trimmed.startsWith('[')) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error(`${source}: expected an array of documents`);
    }
    return parsed.map((doc) => normalizeEjson(doc) as Json);
  }

  // JSONL — mongoexport's default, and what a single pasted doc looks like.
  const docs: Json[] = [];
  const lines = trimmed.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      docs.push(normalizeEjson(JSON.parse(line)) as Json);
    } catch (err) {
      throw new Error(
        `${source}: line ${i + 1} is not valid JSON — ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }
  return docs;
}

/**
 * mongodump .bson files are length-prefixed BSON documents back to back.
 * The `bson` package is an optional dependency here: JSON exports are the
 * expected path, so we only require it when a .bson file is actually present.
 */
async function parseBsonDocuments(
  buffer: Buffer,
  source: string
): Promise<Json[]> {
  let deserialize: (buf: Uint8Array) => Json;
  try {
    // Not a declared dependency — resolved at runtime only when a .bson is fed
    // in, so the module specifier is hidden from the compiler on purpose.
    const bson = (await import(/* @vite-ignore */ 'bson' as string)) as {
      deserialize: (buf: Uint8Array) => Json;
    };
    deserialize = bson.deserialize;
  } catch {
    throw new Error(
      `${source}: reading .bson requires the "bson" package.\n` +
        `  Install it (npm i -D bson) or convert the dump first:\n` +
        `    bsondump --outFile=${source.replace(/\.bson$/, '.json')} ${source}`
    );
  }

  const docs: Json[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const size = buffer.readInt32LE(offset);
    if (size <= 0 || offset + size > buffer.length) {
      throw new Error(`${source}: corrupt BSON document at byte ${offset}`);
    }
    docs.push(
      normalizeEjson(
        deserialize(buffer.subarray(offset, offset + size))
      ) as Json
    );
    offset += size;
  }
  return docs;
}

/** Load a collection from <dir>, trying each supported extension in turn. */
async function loadCollection(
  dir: string,
  names: string[]
): Promise<{ docs: Json[]; source: string } | null> {
  for (const name of names) {
    for (const ext of ['.json', '.jsonl', '.bson']) {
      const file = path.join(dir, `${name}${ext}`);
      if (!fs.existsSync(file)) continue;
      const docs =
        ext === '.bson'
          ? await parseBsonDocuments(fs.readFileSync(file), file)
          : parseJsonDocuments(fs.readFileSync(file, 'utf8'), file);
      return { docs, source: file };
    }
  }
  return null;
}

// =============================================================================
// Field mapping helpers
// =============================================================================

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function date(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function jsonOrNull(value: unknown): Json | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const obj = value as Json;
  return Object.keys(obj).length > 0 ? obj : null;
}

function arrayOrNull(value: unknown): unknown[] | null {
  return Array.isArray(value) && value.length > 0 ? value : null;
}

function email(value: unknown): string | null {
  const raw = str(value);
  return raw ? raw.toLowerCase() : null;
}

/**
 * profiles.pronouns is a plain text column; legacy Mongo stored a boolean map.
 * Mirrors the collapse in app/api/createExpressProfile/route.ts so migrated and
 * newly created profiles render identically.
 */
function pronounsToText(value: unknown): string | null {
  const p = jsonOrNull(value) as PronounsInterface | null;
  if (!p) return null;
  if (p.sheher) return 'she/her';
  if (p.hehim) return 'he/him';
  if (p.theythem) return 'they/them';
  if (p.none) return 'prefer not to say';
  if (p.other) return str(p.other_desc) ?? 'other';
  return null;
}

/**
 * Like str(), but also accepts numbers. Mongo stored several nominally-textual
 * address fields as BSON numbers, which normalizeEjson turns into JS numbers —
 * str() alone would silently drop them.
 */
function strOrNum(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  return str(value);
}

/**
 * Legacy `primary_address` -> the flat international address columns.
 *
 * Two shapes here disagree with AddressInterface, confirmed against the
 * 2026-08-03 dump: `zipcode` arrives as a BSON int in 57 of 60 addresses, and
 * the coordinates are keyed `latitude`/`longitude` rather than `lat`/`lng`.
 * Both are read defensively so neither silently drops out.
 */
function mapAddress(value: unknown) {
  const a = (jsonOrNull(value) ?? {}) as Partial<AddressInterface> & {
    latitude?: unknown;
    longitude?: unknown;
  };

  // A numeric zip loses any leading zero (New England, Puerto Rico). Legacy
  // data is South Florida (33xxx) so this is belt-and-braces, but restoring it
  // is cheaper than discovering a truncated zip later.
  const zip = strOrNum(a.zipcode);

  return {
    addressName: str(a.name),
    addressLine1: str(a.street1),
    addressLine2: str(a.street2),
    addressLocality: str(a.city),
    addressRegion: str(a.state),
    addressPostalCode:
      zip && /^\d{1,4}$/.test(zip) ? zip.padStart(5, '0') : zip,
    // Legacy data is South Florida only; nothing recorded a country.
    addressCountry: 'US',
    addressLat: strOrNum(a.latitude ?? a.lat),
    addressLng: strOrNum(a.longitude ?? a.lng),
    addressGooglePlaceId: str(a.google_place_id),
    addressHours: str(a.hours),
  };
}

// =============================================================================
// Merging into pre-existing rows
// =============================================================================

/**
 * "Empty" for merge purposes: a column with nothing worth keeping.
 *
 * `false` is deliberately NOT empty. Columns like active / whatsapp_community /
 * social_eligible default to false, and treating that as a gap would let legacy
 * data silently flip live flags on — publishing a profile, say.
 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Date) return false;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/** A column where both sides hold a value and the values disagree. */
interface MergeConflict {
  field: string;
  existing: string;
  legacy: string;
}

function preview(value: unknown): string {
  const text =
    value instanceof Date ? value.toISOString() : (JSON.stringify(value) ?? '');
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

/**
 * Build a fill-only patch: legacy values for columns the existing row has left
 * empty. Never overwrites data that is already there, so a merge can add
 * information but never destroy it.
 *
 * Columns where both sides hold a *different* value are reported as conflicts
 * rather than resolved. The existing value always wins — but silently dropping
 * the legacy one would hide things that matter (a second affiliate referral
 * code, say), so the report names them for a human to adjudicate.
 *
 * createdAt is the one deliberate exception, handled by the caller: the older
 * timestamp wins, because it is the date the person actually joined.
 */
function buildFillPatch(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  skip: Set<string>
): { patch: Record<string, unknown>; conflicts: MergeConflict[] } {
  const patch: Record<string, unknown> = {};
  const conflicts: MergeConflict[] = [];

  for (const [key, value] of Object.entries(incoming)) {
    if (skip.has(key)) continue;
    if (isEmptyValue(value)) continue;
    if (isEmptyValue(existing[key])) {
      patch[key] = value;
      continue;
    }
    const a = preview(existing[key]);
    const b = preview(value);
    if (a !== b) conflicts.push({ field: key, existing: a, legacy: b });
  }

  return { patch, conflicts };
}

/**
 * The legacy record's createdAt when it predates the existing row's — the
 * person's real join date, which a re-registration on the new site would
 * otherwise overwrite with today.
 */
function earlierCreatedAt(
  existing: unknown,
  legacy: unknown
): Date | undefined {
  if (!(existing instanceof Date) || !(legacy instanceof Date))
    return undefined;
  return legacy.getTime() < existing.getTime() ? legacy : undefined;
}

/** Columns that identify the row or are managed by the database, never merged. */
const NEVER_MERGE = new Set(['id', 'email', 'createdAt', 'updatedAt']);

/**
 * Values this script synthesizes rather than reading from the dump. They are
 * the right defaults for a row being inserted, but they are not evidence about
 * a row that already exists: merging them would write our guess over a real
 * record, and reporting them as conflicts would be pure noise.
 *
 * - emailVerified is always false here by design — the first magic-link sign-in
 *   both authenticates and verifies. A target row that already says true isn't
 *   in conflict with the dump, it just knows more, so leave it be.
 * - addressCountry is hardcoded 'US' because the legacy data recorded no
 *   country; that assumption shouldn't overwrite a country the target has.
 */
const SYNTHESIZED_FIELDS = new Set(['emailVerified', 'addressCountry']);

/** Keep only the gallery slots; the primary image gets dedicated columns. */
function mapGallery(images: ProfileImagesInterface): Json | null {
  const gallery: Json = {};
  for (const slot of ['gallery1', 'gallery2', 'gallery3'] as const) {
    const key = str(images[slot]);
    const cdn = str(images[`${slot}CDN`]);
    if (key) gallery[slot] = key;
    if (cdn) gallery[`${slot}CDN`] = cdn;
  }
  return Object.keys(gallery).length > 0 ? gallery : null;
}

// =============================================================================
// Report
// =============================================================================

interface ImageResult {
  profileId: string;
  field: string;
  sourceUrl: string;
  key: string | null;
  newUrl: string | null;
  error: string | null;
}

interface FollowEdge {
  followerEmail: string;
  followerLegacyId: string;
  targetLegacyId: string;
}

interface Skipped {
  collection: string;
  legacyId: string | null;
  identifier: string | null;
  reason: string;
}

interface Report {
  generatedAt: string;
  dryRun: boolean;
  input: string;
  sources: Record<string, string>;
  counts: Record<
    string,
    { read: number; written: number; skipped: number; merged?: number }
  >;
  /** Legacy Mongo _id -> new cuid, so follow edges can be resolved later. */
  idMap: { users: Record<string, string>; profiles: Record<string, string> };
  /** Rows that already existed and had empty columns filled from legacy data. */
  merged: {
    collection: string;
    email: string;
    existingId: string;
    filled: string[];
    /** Columns where both sides had a value; the existing one was kept. */
    conflicts: MergeConflict[];
  }[];
  /** Legacy slugs that could not become a screenname, with the reason. */
  screennameRejects: { email: string; slug: string; reason: string }[];
  /** Every attempted BunnyCDN -> R2 transfer. Failures list the source URL. */
  images: ImageResult[];
  /** users.following, unmappable until ActivityPub actors exist. */
  follows: FollowEdge[];
  /** Legacy roles other than plain "user"; admin access is env-driven now. */
  privilegedUsers: { email: string; role: string }[];
  skipped: Skipped[];
}

function emptyReport(args: MigrationArgs): Report {
  return {
    generatedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    input: args.input ? path.resolve(args.input) : '',
    sources: {},
    counts: {},
    idMap: { users: {}, profiles: {} },
    merged: [],
    screennameRejects: [],
    images: [],
    follows: [],
    privilegedUsers: [],
    skipped: [],
  };
}

// =============================================================================
// Users
// =============================================================================

interface UserMaps {
  /** Lowercased email -> new cuid, so profiles can be linked. */
  byEmail: Map<string, string>;
}

async function migrateUsers(
  db: DB | null,
  docs: Json[],
  /** Legacy profile slug per email — the source of each user's screenname. */
  slugByEmail: Map<string, string>,
  merge: boolean,
  report: Report
): Promise<UserMaps> {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE: users');
  console.log('='.repeat(60));

  const byEmail = new Map<string, string>();
  const takenScreennames = new Set<string>();
  let written = 0;
  let skipped = 0;
  let merged = 0;
  let named = 0;

  for (const doc of docs) {
    const legacyId = str(doc._id);
    const addr = email(doc.email);

    if (!addr) {
      skipped++;
      report.skipped.push({
        collection: 'users',
        legacyId,
        identifier: null,
        reason: 'no email address',
      });
      continue;
    }
    if (byEmail.has(addr)) {
      skipped++;
      report.skipped.push({
        collection: 'users',
        legacyId,
        identifier: addr,
        reason: 'duplicate email within export',
      });
      continue;
    }

    // The legacy profile slug is the same identifier the public /p/[user] route
    // now resolves through users.screenname, so carrying it over keeps old
    // profile URLs alive. Anything that fails validation is left unset rather
    // than mangled — the user can pick a screenname on first sign-in.
    let screenname: string | null = null;
    const slug = slugByEmail.get(addr);
    if (slug) {
      const candidate = slug.toLowerCase();
      const validation = validateScreenname(candidate);
      if (!validation.valid) {
        report.screennameRejects.push({
          email: addr,
          slug,
          reason: validation.error ?? 'invalid',
        });
      } else if (takenScreennames.has(candidate)) {
        report.screennameRejects.push({
          email: addr,
          slug,
          reason: 'collides with another migrated screenname',
        });
      } else if (
        db &&
        (await db.query.users.findFirst({
          where: (u, { eq: equals }) => equals(u.screenname, candidate),
          columns: { id: true },
        }))
      ) {
        report.screennameRejects.push({
          email: addr,
          slug,
          reason: 'already taken in target database',
        });
      } else {
        screenname = candidate;
      }
    }

    const id = createId();
    const now = new Date();
    const status = jsonOrNull(doc.status) ?? {};
    const role = str(status.role);
    const locked = status.locked;

    // Observations about the legacy record, recorded regardless of whether the
    // row is inserted, merged, or skipped — they describe the source data.
    if (role && role !== 'user') {
      report.privilegedUsers.push({ email: addr, role });
    }
    for (const target of arrayOrNull(doc.following) ?? []) {
      const targetId = str(target);
      if (targetId && legacyId) {
        report.follows.push({
          followerEmail: addr,
          followerLegacyId: legacyId,
          targetLegacyId: targetId,
        });
      }
    }

    const row = {
      id,
      email: addr,
      // Left false on purpose: there are no passwords to carry, so the first
      // magic-link sign-in both authenticates the user and verifies the
      // address. Nothing in the app gates on users.emailVerified today.
      emailVerified: false,
      name: str(doc.name),
      screenname,
      alternateEmails: (arrayOrNull(doc.alternate_emails) ?? [])
        .map((e) => email(e))
        .filter((e): e is string => e !== null),
      lockedAt: locked ? date(locked, now) : null,
      affiliate: jsonOrNull(doc.affiliate),
      createdAt: date(doc.createdAt, now),
      updatedAt: date(doc.updatedAt, now),
    };

    if (db) {
      const inserted = await db
        .insert(users)
        .values(row)
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id });
      if (inserted.length === 0) {
        // The target already has this account. Without --merge we leave it
        // strictly alone; with it, we fill only the columns it left empty.
        const existing = await db.query.users.findFirst({
          where: (u, { eq: equals }) => equals(u.email, addr),
        });
        if (!existing) {
          skipped++;
          report.skipped.push({
            collection: 'users',
            legacyId,
            identifier: addr,
            reason: 'insert conflicted but row not found (concurrent write?)',
          });
          continue;
        }

        // Link profiles to the row that actually exists, merged or not.
        byEmail.set(addr, existing.id);
        if (legacyId) report.idMap.users[legacyId] = existing.id;
        if (existing.screenname) takenScreennames.add(existing.screenname);

        if (!merge) {
          skipped++;
          report.skipped.push({
            collection: 'users',
            legacyId,
            identifier: addr,
            reason: 'email already present in target database',
          });
          continue;
        }

        const { patch, conflicts } = buildFillPatch(
          existing as unknown as Record<string, unknown>,
          row as unknown as Record<string, unknown>,
          new Set([...NEVER_MERGE, ...SYNTHESIZED_FIELDS])
        );
        const olderUser = earlierCreatedAt(existing.createdAt, row.createdAt);
        if (olderUser) patch.createdAt = olderUser;
        // A screenname taken from the legacy slug may collide with some other
        // account; drop it rather than fail the update.
        if (
          typeof patch.screenname === 'string' &&
          takenScreennames.has(patch.screenname)
        ) {
          delete patch.screenname;
        }
        if (Object.keys(patch).length === 0) {
          skipped++;
          report.skipped.push({
            collection: 'users',
            legacyId,
            identifier: addr,
            reason: 'already present; nothing empty to merge',
          });
          continue;
        }

        await db.update(users).set(patch).where(eq(users.id, existing.id));
        if (typeof patch.screenname === 'string') {
          takenScreennames.add(patch.screenname);
          named++;
        }
        merged++;
        report.merged.push({
          collection: 'users',
          email: addr,
          existingId: existing.id,
          filled: Object.keys(patch).sort(),
          conflicts,
        });
        continue;
      }
    }

    byEmail.set(addr, id);
    if (legacyId) report.idMap.users[legacyId] = id;
    if (screenname) {
      takenScreennames.add(screenname);
      named++;
    }
    written++;
  }

  report.counts.users = { read: docs.length, written, skipped, merged };
  console.log(
    `  read ${docs.length}, mapped ${written}, merged ${merged}, skipped ${skipped}`
  );
  console.log(
    `  screennames carried over from legacy slugs: ${named}` +
      (report.screennameRejects.length > 0
        ? `, ${report.screennameRejects.length} rejected (see report)`
        : '')
  );
  if (report.privilegedUsers.length > 0) {
    console.log(
      `  note: ${report.privilegedUsers.length} user(s) had a non-default legacy role;` +
        ` admin access is now driven by the admin email list, see report.privilegedUsers`
    );
  }
  if (report.follows.length > 0) {
    console.log(
      `  note: ${report.follows.length} follow edge(s) recorded in the report;` +
        ` social_follows needs ActivityPub actors, so they are not replayed here`
    );
  }

  return { byEmail };
}

// =============================================================================
// Profiles
// =============================================================================

/** The image-bearing subset of a profile row, as the image phase needs it. */
interface ImageBearingRow {
  id: string;
  primaryImageId: string | null;
  primaryImageCdn: string | null;
  galleryImages: unknown;
}

async function migrateProfiles(
  db: DB | null,
  docs: Json[],
  usersByEmail: Map<string, string>,
  merge: boolean,
  report: Report
): Promise<ImageBearingRow[]> {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE: profiles');
  console.log('='.repeat(60));

  const seenEmails = new Set<string>();
  const claimedUserIds = new Set<string>();
  const imageRows: ImageBearingRow[] = [];
  let written = 0;
  let skipped = 0;
  let merged = 0;
  let linked = 0;

  for (const doc of docs) {
    const legacyId = str(doc._id);
    const addr = email(doc.email);

    if (!addr) {
      skipped++;
      report.skipped.push({
        collection: 'profiles',
        legacyId,
        identifier: str(doc.slug),
        reason: 'no email address (profiles.email is NOT NULL and unique)',
      });
      continue;
    }
    if (seenEmails.has(addr)) {
      skipped++;
      report.skipped.push({
        collection: 'profiles',
        legacyId,
        identifier: addr,
        reason: 'duplicate email within export',
      });
      continue;
    }

    // Users were a subset of profiles in the legacy design: the two collections
    // share an email, and that is the only join key available. Users imported
    // moments ago are already in hand; the database lookup is the fallback for
    // accounts that predate this run (and keeps --dry-run link counts honest).
    let userId: string | null = usersByEmail.get(addr) ?? null;
    if (!userId && db) {
      const user = await db.query.users.findFirst({
        where: (u, { eq: equals }) => equals(u.email, addr),
        columns: { id: true },
      });
      userId = user?.id ?? null;
    }
    // profiles.user_id is unique — a second profile on the same account has to
    // land unclaimed rather than fail the insert.
    if (userId && claimedUserIds.has(userId)) userId = null;

    const images = (jsonOrNull(doc.images) ?? {}) as ProfileImagesInterface;
    const now = new Date();

    const descriptions: ProfileDescriptions = {
      details: str(doc.details) ?? undefined,
      background: str(doc.background) ?? undefined,
      fiveWords: str(doc.five_words) ?? undefined,
      tags: str(doc.tags) ?? undefined,
      hearaboutus: str(doc.hearaboutus) ?? undefined,
    };
    const hasDescriptions = Object.values(descriptions).some(
      (v) => v !== undefined
    );

    // Legacy `status` carried both the submission timestamp and the one-time
    // access token used by the old edit-my-profile links. The token is dead
    // weight under better-auth, so only the timestamps come across.
    const legacyStatus = jsonOrNull(doc.status);
    const status = legacyStatus
      ? {
          submitted: legacyStatus.submitted
            ? date(legacyStatus.submitted, now).toISOString()
            : undefined,
          approved: legacyStatus.approved
            ? date(legacyStatus.approved, now).toISOString()
            : undefined,
          published: legacyStatus.published
            ? date(legacyStatus.published, now).toISOString()
            : undefined,
          notes: str(legacyStatus.notes) ?? undefined,
        }
      : null;

    const row = {
      id: createId(),
      userId,
      email: addr,
      name: str(doc.name) ?? 'Unknown',
      phoneNumber: str(doc.phone_number),
      pronouns: pronounsToText(doc.pronouns),
      primaryImageId: str(images.primary),
      primaryImageCdn: str(images.primaryCDN),
      ...mapAddress(doc.primary_address),
      active: doc.active === true,
      locallyBased: str(doc.locally_based),
      descriptions: hasDescriptions ? (descriptions as unknown as Json) : null,
      socials: jsonOrNull(doc.socials as ProfileSocialsInterface),
      galleryImages: mapGallery(images),
      categories: jsonOrNull(doc.categories),
      counties: jsonOrNull(doc.counties),
      locations: arrayOrNull(doc.locations) as Json | null,
      geo: jsonOrNull(doc.geo),
      mentoring: jsonOrNull(doc.mentoring),
      verification: jsonOrNull(doc.verification),
      roles: jsonOrNull(doc.roles),
      gentedepana: jsonOrNull(doc.gentedepana),
      status: status as Json | null,
      linkedProfiles: arrayOrNull(doc.linked_profiles) as Json | null,
      whatsappCommunity: doc.whatsapp_community === true,
      affiliate: str(doc.affiliate),
      createdAt: date(doc.createdAt, now),
      updatedAt: date(doc.updatedAt, now),
    };

    if (db) {
      const inserted = await db
        .insert(profiles)
        .values(row)
        .onConflictDoNothing({ target: profiles.email })
        .returning({ id: profiles.id });
      if (inserted.length === 0) {
        const existing = await db.query.profiles.findFirst({
          where: (p, { eq: equals }) => equals(p.email, addr),
        });
        if (!existing || !merge) {
          skipped++;
          report.skipped.push({
            collection: 'profiles',
            legacyId,
            identifier: addr,
            reason: existing
              ? 'email already present in target database'
              : 'insert conflicted but row not found (concurrent write?)',
          });
          continue;
        }

        const { patch, conflicts } = buildFillPatch(
          existing as unknown as Record<string, unknown>,
          row as unknown as Record<string, unknown>,
          // userId is unique across profiles; claiming it here could collide
          // with whatever the target already linked, so leave it as found.
          new Set([...NEVER_MERGE, ...SYNTHESIZED_FIELDS, 'userId'])
        );
        const olderProfile = earlierCreatedAt(
          existing.createdAt,
          row.createdAt
        );
        if (olderProfile) patch.createdAt = olderProfile;
        if (Object.keys(patch).length === 0) {
          skipped++;
          report.skipped.push({
            collection: 'profiles',
            legacyId,
            identifier: addr,
            reason: 'already present; nothing empty to merge',
          });
          continue;
        }

        await db
          .update(profiles)
          .set(patch)
          .where(eq(profiles.id, existing.id));
        merged++;
        report.merged.push({
          collection: 'profiles',
          email: addr,
          existingId: existing.id,
          filled: Object.keys(patch).sort(),
          conflicts,
        });

        seenEmails.add(addr);
        if (legacyId) report.idMap.profiles[legacyId] = existing.id;
        // Any image the merge just filled in still needs moving off BunnyCDN.
        imageRows.push({
          id: existing.id,
          primaryImageId:
            (patch.primaryImageId as string | null) ?? existing.primaryImageId,
          primaryImageCdn:
            (patch.primaryImageCdn as string | null) ??
            existing.primaryImageCdn,
          galleryImages: patch.galleryImages ?? existing.galleryImages,
        });
        continue;
      }
    }

    seenEmails.add(addr);
    if (userId) {
      claimedUserIds.add(userId);
      linked++;
    }
    if (legacyId) report.idMap.profiles[legacyId] = row.id;
    imageRows.push({
      id: row.id,
      primaryImageId: row.primaryImageId,
      primaryImageCdn: row.primaryImageCdn,
      galleryImages: row.galleryImages,
    });
    written++;
  }

  report.counts.profiles = { read: docs.length, written, skipped, merged };
  console.log(
    `  read ${docs.length}, mapped ${written} (${linked} linked to a user), merged ${merged}, skipped ${skipped}`
  );

  return imageRows;
}

// =============================================================================
// Images: BunnyCDN -> R2
// =============================================================================

export interface ImageJob {
  profileId: string;
  /** 'primary' | 'gallery1' | 'gallery2' | 'gallery3' */
  field: string;
  sourceUrl: string;
  /** Legacy object key, reused verbatim so R2 mirrors the old layout. */
  key: string;
}

function isLegacyCdnUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (!lower.startsWith('http')) return false;
  const publicBase = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');
  if (publicBase && url.startsWith(publicBase)) return false;
  return LEGACY_CDN_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Prefer the legacy object key so R2 mirrors the old bucket layout. Fall back to
 * the URL path, then to a synthesized key. The extension here is provisional —
 * sniffContentType() corrects it once the bytes are in hand.
 */
function objectKeyFor(
  legacyKey: string | null,
  sourceUrl: string,
  profileId: string,
  field: string
): string {
  if (legacyKey && !legacyKey.startsWith('http')) return legacyKey;
  try {
    const fromUrl = new URL(sourceUrl).pathname.replace(/^\/+/, '');
    if (fromUrl) return fromUrl;
  } catch {
    // fall through
  }
  const ext = sourceUrl.split('.').pop()?.toLowerCase().slice(0, 4) ?? 'jpg';
  return `profile/${profileId}/${field}.${ext}`;
}

/**
 * Identify an image by magic bytes. Neither the legacy extension nor the origin
 * Content-Type can be trusted: BunnyCDN serves `.jpg` keys holding WebP data and
 * labels them `image/jpeg`. uploadFile() derives the R2 content type from the
 * key's extension, so an uncorrected key would store that mislabelling forever.
 */
export function sniffExtension(buffer: Buffer): string | null {
  if (buffer.length >= 12) {
    const riff = buffer.toString('ascii', 0, 4);
    const webp = buffer.toString('ascii', 8, 12);
    if (riff === 'RIFF' && webp === 'WEBP') return 'webp';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return 'jpg';
  }
  if (
    buffer.length >= 8 &&
    buffer.toString('hex', 0, 8) === '89504e470d0a1a0a'
  ) {
    return 'png';
  }
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'GIF8') {
    return 'gif';
  }
  return null;
}

/** Swap the key's extension for the one the bytes actually call for. */
export function keyWithExtension(key: string, ext: string): string {
  const current = key.includes('.')
    ? key.split('.').pop()!.toLowerCase()
    : null;
  if (current === ext || (current === 'jpeg' && ext === 'jpg')) return key;
  return current
    ? `${key.slice(0, -(current.length + 1))}.${ext}`
    : `${key}.${ext}`;
}

export async function transferImage(job: ImageJob): Promise<ImageResult> {
  const base: ImageResult = {
    profileId: job.profileId,
    field: job.field,
    sourceUrl: job.sourceUrl,
    key: job.key,
    newUrl: null,
    error: null,
  };

  for (let attempt = 1; attempt <= IMAGE_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(job.sourceUrl, {
        redirect: 'follow',
        // The pull zone enforces hotlink protection; only the legacy origin is
        // on its allowed-referrer list. See LEGACY_CDN_REFERER.
        headers: { Referer: LEGACY_CDN_REFERER },
      });
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? `download failed: 403 (hotlink protection — is ${LEGACY_CDN_REFERER} still an allowed referrer?)`
            : `download failed: ${res.status} ${res.statusText}`
        );
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) throw new Error('download returned 0 bytes');

      const ext = sniffExtension(buffer);
      if (!ext) {
        // A 200 carrying an HTML error page lands here rather than being stored
        // as a corrupt image.
        throw new Error(
          `not a recognized image (first bytes: ${buffer.toString('hex', 0, 8)})`
        );
      }
      const key = keyWithExtension(job.key, ext);

      const upload = await getUploadFile();
      const newUrl = await upload(key, buffer);
      if (!newUrl) throw new Error('R2 upload failed (see logged R2 error)');

      return { ...base, key, newUrl };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt === IMAGE_ATTEMPTS) {
        return { ...base, error: message };
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  return base;
}

/** Build the transfer list for one profile row. */
function jobsForProfile(row: ImageBearingRow): ImageJob[] {
  const jobs: ImageJob[] = [];

  if (isLegacyCdnUrl(row.primaryImageCdn)) {
    jobs.push({
      profileId: row.id,
      field: 'primary',
      sourceUrl: row.primaryImageCdn,
      key: objectKeyFor(
        row.primaryImageId,
        row.primaryImageCdn,
        row.id,
        'primary'
      ),
    });
  }

  const gallery = (jsonOrNull(row.galleryImages) ??
    {}) as ProfileImagesInterface;
  for (const slot of ['gallery1', 'gallery2', 'gallery3'] as const) {
    const url = gallery[`${slot}CDN`];
    if (!isLegacyCdnUrl(url)) continue;
    jobs.push({
      profileId: row.id,
      field: slot,
      sourceUrl: url,
      key: objectKeyFor(str(gallery[slot]), url, row.id, slot),
    });
  }

  return jobs;
}

/** Run jobs through a small pool so we neither serialize nor flood the CDN. */
async function runPool(
  jobs: ImageJob[],
  onDone: (result: ImageResult) => void
): Promise<void> {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(IMAGE_CONCURRENCY, jobs.length) },
    async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++];
        onDone(await transferImage(job));
      }
    }
  );
  await Promise.all(workers);
}

async function migrateImages(
  db: DB | null,
  /** Rows just mapped from the export, or null to rescan the whole table. */
  mappedRows: ImageBearingRow[] | null,
  report: Report,
  dryRun: boolean
): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE: images (BunnyCDN -> R2)');
  console.log('='.repeat(60));

  // --images-only rescans the table so it can retry earlier failures; a fresh
  // migration works from the rows in hand, which keeps --dry-run accurate.
  const rows =
    mappedRows ??
    (db
      ? await db
          .select({
            id: profiles.id,
            primaryImageId: profiles.primaryImageId,
            primaryImageCdn: profiles.primaryImageCdn,
            galleryImages: profiles.galleryImages,
          })
          .from(profiles)
      : []);

  const jobs = rows.flatMap(jobsForProfile);
  console.log(
    `  ${jobs.length} image(s) on a legacy CDN across ${rows.length} profile(s)`
  );

  if (dryRun) {
    report.counts.images = { read: jobs.length, written: 0, skipped: 0 };
    console.log('  dry run — nothing downloaded or uploaded');
    return;
  }
  if (jobs.length === 0) return;

  const results: ImageResult[] = [];
  await runPool(jobs, (result) => {
    results.push(result);
    const done = results.length;
    if (result.error) {
      console.error(
        `  [${done}/${jobs.length}] FAILED ${result.sourceUrl} — ${result.error}`
      );
    } else if (done % 25 === 0 || done === jobs.length) {
      console.log(`  [${done}/${jobs.length}] transferred`);
    }
  });
  report.images.push(...results);

  // One UPDATE per profile, folding in every slot this run touched — successes
  // repointed at R2, failures cleared. No row keeps a BunnyCDN URL either way.
  const byProfile = new Map<string, ImageResult[]>();
  for (const result of results) {
    const list = byProfile.get(result.profileId) ?? [];
    list.push(result);
    byProfile.set(result.profileId, list);
  }

  let updated = 0;
  for (const [profileId, touched] of byProfile) {
    const row = rows.find((r) => r.id === profileId);
    if (!row || !db) continue;

    const updates: {
      primaryImageId?: string | null;
      primaryImageCdn?: string | null;
      galleryImages?: Json | null;
    } = {};
    const gallery = { ...((jsonOrNull(row.galleryImages) ?? {}) as Json) };
    let galleryChanged = false;

    for (const result of touched) {
      // A failed transfer drops the reference entirely rather than leaving a
      // pointer at a CDN we are shutting off. The profile renders imageless and
      // the owner re-uploads; report.images keeps the source URL for the record.
      if (result.field === 'primary') {
        updates.primaryImageCdn = result.newUrl;
        updates.primaryImageId = result.newUrl ? result.key : null;
      } else {
        gallery[`${result.field}CDN`] = result.newUrl;
        gallery[result.field] = result.newUrl ? result.key : null;
        galleryChanged = true;
      }
    }
    if (galleryChanged) {
      // Drop emptied slots so the column ends up null rather than a husk.
      for (const key of Object.keys(gallery)) {
        if (gallery[key] === null) delete gallery[key];
      }
      updates.galleryImages = Object.keys(gallery).length > 0 ? gallery : null;
    }

    await db.update(profiles).set(updates).where(eq(profiles.id, profileId));
    updated++;
  }

  const failed = results.filter((r) => r.error).length;
  report.counts.images = {
    read: jobs.length,
    written: results.length - failed,
    skipped: failed,
  };
  console.log(
    `  transferred ${results.length - failed}/${jobs.length}, ${updated} profile row(s) updated`
  );
  if (failed > 0) {
    console.log(
      `  ${failed} transfer(s) failed; those image references were cleared and ` +
        `the owners will need to re-upload. Source URLs are in report.images.`
    );
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = parseArgs();
  const report = emptyReport(args);

  if (args.dryRun) {
    console.log(
      'DRY RUN — parsing and mapping only, nothing will be written\n'
    );
  }
  if (!args.dryRun && !args.skipImages) {
    assertR2Configured();
  }

  let usersFile: Awaited<ReturnType<typeof loadCollection>> = null;
  let profilesFile: Awaited<ReturnType<typeof loadCollection>> = null;

  if (!args.imagesOnly) {
    console.log(`Reading collections from ${path.resolve(args.input)}`);
    usersFile = await loadCollection(args.input, ['users']);
    profilesFile = await loadCollection(args.input, ['profiles']);

    if (!usersFile && !profilesFile) {
      console.error(
        `Error: found no users or profiles export in ${args.input}.\n` +
          `  Expected users.json and/or profiles.json (also .jsonl, .bson)`
      );
      process.exit(1);
    }

    for (const [name, file] of [
      ['users', usersFile],
      ['profiles', profilesFile],
    ] as const) {
      if (file) {
        report.sources[name] = file.source;
        console.log(
          `  ${name}: ${file.docs.length} document(s) — ${file.source}`
        );
      } else {
        console.log(`  ${name}: not present, skipping`);
      }
    }
  }

  let client: ReturnType<typeof postgres> | null = null;
  let db: DB | null = null;
  if (!args.dryRun) {
    console.log('\nConnecting to PostgreSQL...');
    client = postgres(args.postgresUrl);
    db = drizzle(client, { schema });
    console.log('Connected.');
  }

  try {
    let mappedRows: ImageBearingRow[] | null = null;

    if (!args.imagesOnly) {
      // Screennames come from the profile slug but live on the user row, so the
      // profile export has to be indexed before users are written.
      const slugByEmail = new Map<string, string>();
      for (const doc of profilesFile?.docs ?? []) {
        const addr = email(doc.email);
        const slug = str(doc.slug);
        if (addr && slug && !slugByEmail.has(addr)) slugByEmail.set(addr, slug);
      }

      const userMaps = usersFile
        ? await migrateUsers(
            db,
            usersFile.docs,
            slugByEmail,
            args.merge,
            report
          )
        : { byEmail: new Map<string, string>() };

      if (profilesFile) {
        mappedRows = await migrateProfiles(
          db,
          profilesFile.docs,
          userMaps.byEmail,
          args.merge,
          report
        );
      }
    }

    if (!args.skipImages) {
      await migrateImages(db, mappedRows, report, args.dryRun);
    }

    fs.writeFileSync(args.reportPath, JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log(args.dryRun ? 'Dry run complete' : 'Migration complete');
    console.log('='.repeat(60));
    for (const [name, c] of Object.entries(report.counts)) {
      console.log(
        `  ${name.padEnd(10)} read ${c.read}, written ${c.written}, skipped ${c.skipped}`
      );
    }
    console.log(`\nReport written to ${args.reportPath}`);
    if (args.dryRun) {
      console.log('Remove --dry-run to write to PostgreSQL.');
    }
  } catch (error) {
    console.error('\nError:', error);
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.end();
      console.log('PostgreSQL connection closed.');
    }
  }
}

// Only run when invoked directly, so the helpers above stay importable by probes.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}

/**
 * Replaces seeded placeholder art with real photography.
 *
 * The problem
 * -----------
 * Seeded listings carry procedurally generated gradient PNGs stored as `data:`
 * URIs directly in `primary_image_cdn` and in the gallery JSONB. Nothing looks
 * broken — a gradient is a valid image — so the directory quietly presented
 * every business as a coloured rectangle.
 *
 * The cost was not only cosmetic. Twenty listings x two images meant 528KB of
 * base64 inlined into the directory HTML on every request. A `data:` URI also
 * exceeds the image optimiser's 3072-character URL cap (see lib/image-src.ts),
 * so each one was served unoptimised, uncached and full size.
 *
 * What this does
 * --------------
 * For every profile still holding placeholder art:
 *
 *   - picks a theme from the listing's name, then its categories
 *   - writes three photos from that theme into the gallery
 *   - clears `primary_image_cdn`
 *
 * Why the primary image is cleared rather than replaced: that field is the
 * logo, and these are stock photographs. A photo in a 52px circle beside the
 * same photo as the card cover reads as a bug. The card already renders the
 * logo conditionally, so clearing it degrades cleanly to a cover-only card and
 * removes the remaining base64 from the page.
 *
 * Idempotent: profiles whose images are already real paths are skipped, so
 * re-running changes nothing and never overwrites a photo a real business
 * uploaded.
 *
 * Usage
 * -----
 *   npx tsx scripts/seed-business-photos.ts            # dry run, prints a plan
 *   npx tsx scripts/seed-business-photos.ts --apply    # writes
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from '../lib/schema';
import { profileCategoryList } from '../lib/lists';

// drizzle.config.ts and the seed scripts already read .env.local. Without the
// same call here the script aborts with "POSTGRES_URL is required" on a machine
// that is otherwise fully configured, which reads as a broken database rather
// than a missing export.
config({ path: '.env.local', quiet: true });

const { profiles } = schema;

// A script whose static imports fail to resolve exits 0 under `tsx` with no
// output at all, which is indistinguishable from a clean run reporting
// nothing. Assert on these markers, never on the exit code.
console.log('PHOTOS:start');

interface Credit {
  file: string;
  theme: string;
  alt: string;
  photographer: string;
}

/**
 * Listing-name keywords that beat the category.
 *
 * A dozen of the seeded listings are Food, and matching on category alone
 * would staple the same plate of plantains onto a bakery, three cafes and a
 * market. Checking the name first keeps a results page varied, which is the
 * difference between "these are real businesses" and "this is seed data".
 *
 * Order matters: "El Fogon Food Truck" must reach food-truck before the
 * generic food fallback, and "Lechon Cocina" must reach supper-club.
 */
const NAME_THEMES: [RegExp, string][] = [
  [/\bfood\s*truck\b|\btruck\b|\bventanita\b/i, 'food-truck'],
  [/\bbakery\b|\bpanader[ií]a\b|\bpasteler[ií]a\b|\bdulc/i, 'bakery'],
  [/\bcaf[eé]\b|\bcoffee\b|\bcafeter[ií]a\b|\btostada\b/i, 'cafe'],
  [/\bmarket\b|\bmercad/i, 'market'],
  [/\bbodega\b|\bgrocer/i, 'market'],
  [/\bsupper\s*club\b|\bcocina\b|\bkitchen\b|\bcomedor\b/i, 'supper-club'],
  // Non-food hints. These matter because the seeded categories are unreliable
  // — "Raiz Bodywork" and "Clave Sound" are both tagged Food — and a name is
  // the more honest signal when the two disagree.
  [/\bbodywork\b|\bmassage\b|\byoga\b|\bbreathwork\b|\bhealing\b/i, 'wellness'],
  [/\bsound\b|\brecords\b|\bband\b|\bson\b|\britmo\b/i, 'music'],
  [/\bgallery\b|\bstudio\s*art\b|\bmural\b/i, 'art'],
];

/**
 * Category preference when a listing claims several.
 *
 * Stored order is not meaningful, and the seeded rows lean on Food as a
 * catch-all — "Raiz Bodywork" is tagged Food,Wellness and "Cosecha Market" is
 * Food,Products. Taking the first key would hand a breathwork studio a plate
 * of plantains. Specific categories are therefore consulted before the broad
 * ones, so the narrower claim wins.
 */
const CATEGORY_PRIORITY = [
  'non_profit',
  'music',
  'wellness',
  'art',
  'artisanal',
  'apparel',
  'tech',
  'venue',
  'food',
  'products',
  'services',
];

/**
 * Category value or raw JSONB key to theme.
 *
 * Two vocabularies reach this map. lib/lists.ts is the canonical set the UI
 * shows, but the stored JSONB predates it and uses its own keys — `clothing`
 * and `accessories` where the list says `apparel`, `homemade` where it says
 * `artisanal`, `events` where it says `Venue`. Both are accepted so a listing
 * is themed correctly whichever vintage of data it carries.
 */
const CATEGORY_THEMES: Record<string, string> = {
  food: 'food',
  products: 'products',
  services: 'services',
  venue: 'venue',
  events: 'venue',
  music: 'music',
  apparel: 'apparel',
  clothing: 'apparel',
  accessories: 'apparel',
  art: 'art',
  digital_art: 'art',
  tech: 'tech',
  wellness: 'wellness',
  health_beauty: 'wellness',
  non_profit: 'non-profit',
  artisanal: 'artisanal',
  homemade: 'artisanal',
};

/** Used when a listing has no name hint and no category we recognise. */
const DEFAULT_THEME = 'services';

/** Placeholder art is any inline data URI. Real uploads are URLs or paths. */
function isPlaceholder(value: unknown): boolean {
  return typeof value === 'string' && value.trim().startsWith('data:');
}

/**
 * Truthy category keys, tolerating both shapes the column has held.
 *
 * Mirrors jsonKeys() in lib/server/directory.ts: older rows store an array of
 * labels, newer ones an object of booleans.
 */
function categoryKeys(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is string => typeof entry === 'string');
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, on]) => on === true)
      .map(([key]) => key);
  }
  return [];
}

function themeFor(name: string, categories: unknown): string {
  for (const [pattern, theme] of NAME_THEMES) {
    if (pattern.test(name)) return theme;
  }

  // Normalise every claimed category once, then consult them in priority
  // order rather than stored order.
  const claimed = new Set<string>();
  for (const key of categoryKeys(categories)) {
    const raw = key.trim().toLowerCase();
    const needle = raw.replace(/[\s-]+/g, '_');

    if (CATEGORY_THEMES[needle]) {
      claimed.add(needle);
      continue;
    }

    // The stored value may be a label ("Non-Profit") rather than a key, so
    // fall back to the canonical vocabulary the UI renders from.
    const entry = profileCategoryList.find(
      (c) => c.desc.toLowerCase() === raw || c.value.toLowerCase() === raw
    );
    if (entry && CATEGORY_THEMES[entry.value.toLowerCase()]) {
      claimed.add(entry.value.toLowerCase());
    }
  }

  for (const preferred of CATEGORY_PRIORITY) {
    for (const key of claimed) {
      if (CATEGORY_THEMES[key] === CATEGORY_THEMES[preferred]) {
        return CATEGORY_THEMES[key];
      }
    }
  }

  // A recognised category outside the priority list still beats the default.
  for (const key of claimed) return CATEGORY_THEMES[key];

  return DEFAULT_THEME;
}

/**
 * Stable offset so two listings sharing a theme do not lead with the same photo.
 *
 * Keyed on the profile id rather than array position so the assignment survives
 * re-runs, re-ordering and new listings appearing between existing ones.
 */
function offsetFor(id: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return size === 0 ? 0 : hash % size;
}

function loadPool(): Map<string, Credit[]> {
  const path = join('public', 'img', 'directory', 'credits.json');

  let credits: Credit[];
  try {
    credits = JSON.parse(readFileSync(path, 'utf8')) as Credit[];
  } catch {
    console.error(
      `Could not read ${path}. Run scripts/fetch-directory-photos.ts first.`
    );
    process.exit(1);
  }

  const pool = new Map<string, Credit[]>();
  for (const credit of credits) {
    const list = pool.get(credit.theme) ?? [];
    list.push(credit);
    pool.set(credit.theme, list);
  }

  // Themes are keyed by slug here; the fetch script stores the raw category
  // value, so `Venue` arrives capitalised.
  for (const [theme, list] of [...pool]) {
    const slug = theme.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (slug !== theme) {
      pool.set(slug, list);
      pool.delete(theme);
    }
  }

  return pool;
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const explain = argv.includes('--explain');

  const pool = loadPool();
  console.log(
    `  pool: ${pool.size} themes, ${[...pool.values()].flat().length} photos`
  );

  // --explain answers "what would this listing get?" without a database, which
  // is the only way to sanity-check the matcher before pointing it at
  // production. Accepts "Name" or "Name#category,category".
  if (explain) {
    const specs = argv.filter((a) => !a.startsWith('--'));
    if (specs.length === 0) {
      console.error('  --explain needs one or more "Name" or "Name#cat,cat"');
      process.exit(1);
    }

    console.log('');
    for (const spec of specs) {
      const [name, cats = ''] = spec.split('#');
      const categories = cats ? cats.split(',').map((c) => c.trim()) : [];
      const theme = themeFor(name, categories);
      const photos = pool.get(theme) ?? [];
      const lead = photos.length
        ? photos[offsetFor(name, photos.length)].file
        : '(no photos)';

      console.log(
        `  ${name.padEnd(28).slice(0, 28)} ${theme.padEnd(12)} ${lead}`
      );
    }

    console.log('PHOTOS:done');
    return;
  }

  if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL environment variable is required');
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client, { schema });

  try {
    const rows = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        categories: profiles.categories,
        primaryImageCdn: profiles.primaryImageCdn,
        galleryImages: profiles.galleryImages,
      })
      .from(profiles);

    console.log(`  profiles: ${rows.length} total`);

    const targets = rows.filter((row) => {
      const gallery = (row.galleryImages ?? {}) as Record<string, unknown>;
      return (
        isPlaceholder(row.primaryImageCdn) ||
        isPlaceholder(gallery.gallery1CDN) ||
        isPlaceholder(gallery.gallery2CDN) ||
        isPlaceholder(gallery.gallery3CDN)
      );
    });

    if (targets.length === 0) {
      console.log('  nothing to do: no profiles hold placeholder art');
      console.log('PHOTOS:done');
      return;
    }

    console.log(`  placeholders: ${targets.length}`);
    console.log('');

    let updated = 0;
    const missing = new Set<string>();

    for (const row of targets) {
      const name = row.name ?? '';
      const theme = themeFor(name, row.categories);
      const photos = pool.get(theme);

      if (!photos || photos.length === 0) {
        missing.add(theme);
        continue;
      }

      const offset = offsetFor(row.id, photos.length);
      const picked = photos.map(
        (_, i) => photos[(offset + i) % photos.length].file
      );

      // Preserve any unrelated keys already in the JSONB rather than replacing
      // the object wholesale, so a partially populated gallery is not lost.
      const gallery = {
        ...((row.galleryImages ?? {}) as Record<string, unknown>),
        gallery1CDN: picked[0],
        gallery2CDN: picked[1] ?? picked[0],
        gallery3CDN: picked[2] ?? picked[0],
      };

      console.log(
        `  ${name.padEnd(28).slice(0, 28)} ${theme.padEnd(12)} ${picked[0]}`
      );

      if (apply) {
        await db
          .update(profiles)
          .set({ galleryImages: gallery, primaryImageCdn: null })
          .where(eq(profiles.id, row.id));
      }
      updated += 1;
    }

    console.log('');
    for (const theme of missing) {
      console.warn(`  no photos for theme "${theme}" — those listings skipped`);
    }

    if (apply) {
      console.log(`  updated ${updated} profiles`);
    } else {
      console.log(`  dry run: ${updated} profiles would change`);
      console.log('  re-run with --apply to write');
    }

    console.log('PHOTOS:done');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

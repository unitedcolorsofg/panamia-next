/**
 * Downloads the directory's stock cover photography from Pexels.
 *
 * Why this exists
 * ---------------
 * Seeded listings shipped with procedurally generated gradient PNGs stored as
 * `data:` URIs directly in `primary_image_cdn`. They rendered, so nothing
 * looked broken, but they were placeholder art rather than photographs and
 * they cost 528KB of base64 inlined into every directory HTML response. A
 * `data:` URI also defeats the image optimiser outright — see lib/image-src.ts
 * — so none of that weight was cacheable, resizable, or lazy-loadable.
 *
 * This script fetches a small pool of real photographs once and writes them to
 * public/img/directory/. Root-relative paths are the only kind vinext's
 * optimiser will resize, so the replacements get the full next/image treatment
 * that the data URIs could never get.
 *
 * Why the photos are committed rather than hotlinked
 * --------------------------------------------------
 * Pexels' CDN is not in our control and the optimiser rejects remote URLs, so
 * hotlinking would reintroduce the unoptimisable problem we are fixing. The
 * pool is small and changes rarely, so the files live in the repo.
 *
 * Attribution
 * -----------
 * The Pexels *content* licence asks for nothing, but the *API* guidelines do:
 * a prominent link back to Pexels, and photographer credit where possible.
 * Because these files arrive through the API, both apply. Every photographer
 * is recorded in the generated credits.json and surfaced by the directory UI.
 *
 * Usage
 * -----
 *   PEXELS_API_KEY=... npx tsx scripts/fetch-directory-photos.ts
 *
 * The key is only needed here. Re-running overwrites the pool in place, which
 * is how you refresh tired photography without touching the database.
 */

import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

config({ path: '.env.local', quiet: true });

/** Where the pool lands, relative to the repo root. */
const OUT_DIR = join('public', 'img', 'directory');

/** How many distinct photos to keep per theme. */
const PER_THEME = 3;

/**
 * Search terms per theme.
 *
 * These are deliberately hand-written rather than derived from the category
 * label. Searching Pexels for the bare word "Services" returns stock-photo
 * handshakes; "small business owner at work" returns something that looks like
 * a Pana MIA listing. The leading Latin/Caribbean skew is intentional — this
 * is a South Florida directory, not a generic one.
 *
 * The first block mirrors the canonical category values in lib/lists.ts and is
 * the fallback for any listing. The second block covers *sub-themes* that the
 * category alone cannot express.
 *
 * Sub-themes exist because the directory is heavily food-weighted — a dozen of
 * the current listings are Food — and category-only matching would staple the
 * same plate of plantains onto a bakery, three cafes and a market. A results
 * page that repeats one photo down the column reads as fake at a glance, which
 * defeats the point of replacing the placeholders. Matching a name keyword
 * such as "Bakery" or "Cafe" first keeps the page varied.
 */
const QUERIES: Record<string, string> = {
  // Canonical categories (lib/lists.ts)
  food: 'latin caribbean food restaurant plate',
  products: 'handmade artisan goods small shop',
  services: 'small business owner at work',
  Venue: 'event venue interior lights',
  music: 'live music band performing stage',
  apparel: 'clothing boutique rack storefront',
  art: 'artist studio painting canvas',
  tech: 'startup team working laptop',
  wellness: 'yoga wellness studio calm',
  non_profit: 'community volunteers helping neighbours',
  artisanal: 'artisan craft workshop hands',

  // Sub-themes, matched ahead of the category by listing name
  'food-truck': 'food truck street food window',
  bakery: 'bakery pastries display case',
  cafe: 'cafe coffee shop counter barista',
  market: 'farmers market produce stall',
  'supper-club': 'restaurant dining table shared meal',
};

interface PexelsPhoto {
  id: number;
  alt: string | null;
  photographer: string;
  photographer_url: string;
  url: string;
  src: { large: string; landscape: string };
}

interface CreditEntry {
  file: string;
  theme: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  pexelsUrl: string;
}

/** Lowercase slug for a theme, since `Venue` is capitalised upstream. */
function slug(theme: string): string {
  return theme.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function searchPexels(
  key: string,
  query: string,
  count: number
): Promise<PexelsPhoto[]> {
  const url =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
    `&per_page=${count}&orientation=landscape&size=medium`;

  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) {
    throw new Error(`Pexels search failed (${res.status}) for "${query}"`);
  }

  const body = (await res.json()) as { photos?: PexelsPhoto[] };
  return body.photos ?? [];
}

async function download(url: string, dest: string): Promise<number> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);

  const bytes = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, bytes);
  return bytes.length;
}

/**
 * Re-encodes a JPEG in place at a consistent quality.
 *
 * Pexels' `landscape` crop is already the right dimensions, but its encoder
 * quality varies wildly with subject matter — a detailed market stall came
 * back at 1.1MB while a dark stage shot was 53KB. Normalising avoids one
 * pathological photo dominating the committed pool.
 *
 * sharp is deliberately optional. It is present here only as a transitive
 * dependency of @cloudflare/vite-plugin, so hard-requiring it would mean a
 * miniflare bump could silently break this script. If it cannot be loaded we
 * keep the original download, which is correct — just larger.
 */
/**
 * The slice of sharp's API this script uses.
 *
 * Declared locally rather than imported because sharp is not a dependency of
 * this project — see compress() below. Pulling it into package.json purely to
 * satisfy the compiler would add a heavy native module to every install for
 * the sake of one optional re-encode.
 */
type SharpLike = (input: Buffer) => {
  jpeg(options: { quality: number; progressive: boolean; mozjpeg: boolean }): {
    toBuffer(): Promise<Buffer>;
  };
};

async function compress(path: string): Promise<number | null> {
  let sharp: SharpLike;
  try {
    const mod = (await import('sharp')) as unknown as { default: SharpLike };
    sharp = mod.default;
  } catch {
    return null;
  }

  const { readFile } = await import('node:fs/promises');
  const input = await readFile(path);
  const output = await sharp(input)
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toBuffer();

  // Only keep the re-encode when it actually wins; a few small files are
  // already better compressed than mozjpeg manages at this quality.
  if (output.length >= input.length) return input.length;

  await writeFile(path, output);
  return output.length;
}

async function main(): Promise<void> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    console.error('PEXELS_API_KEY is not set. See the header of this file.');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const credits: CreditEntry[] = [];
  let totalBytes = 0;
  let sharpMissing = false;

  for (const [theme, query] of Object.entries(QUERIES)) {
    const photos = await searchPexels(key, query, PER_THEME);

    if (photos.length < PER_THEME) {
      console.warn(`  ${theme}: only ${photos.length}/${PER_THEME} results`);
    }

    for (const [i, photo] of photos.entries()) {
      const file = `${slug(theme)}-${String(i + 1).padStart(2, '0')}.jpg`;
      const path = join(OUT_DIR, file);

      // `landscape` is a 1200x627 crop, which matches the card media aspect
      // far better than `large` and keeps each file near 100KB.
      const raw = await download(photo.src.landscape, path);
      const final = await compress(path);
      if (final === null) sharpMissing = true;

      const bytes = final ?? raw;
      totalBytes += bytes;

      credits.push({
        file: `/img/directory/${file}`,
        theme,
        alt: photo.alt?.trim() || `${theme} photograph`,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        pexelsUrl: photo.url,
      });

      const saved =
        final !== null && final < raw
          ? ` (was ${(raw / 1024).toFixed(0)}KB)`
          : '';
      console.log(
        `  ${file.padEnd(20)} ${(bytes / 1024).toFixed(0)}KB${saved}`
      );
    }
  }

  await writeFile(
    join(OUT_DIR, 'credits.json'),
    JSON.stringify(credits, null, 2) + '\n',
    'utf8'
  );

  console.log('');
  console.log(
    `  ${credits.length} photos, ${(totalBytes / 1024 / 1024).toFixed(2)}MB total`
  );
  console.log(`  credits.json written to ${OUT_DIR}`);

  if (sharpMissing) {
    console.warn('');
    console.warn(
      '  sharp was unavailable, so photos were kept at their original size.'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

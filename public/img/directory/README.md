# Directory listing photography

Stock photographs used as cover art for **seeded** directory listings.

## Why these exist

Seeded listings originally shipped with procedurally generated gradient PNGs
stored as `data:` URIs in `primary_image_cdn` and the gallery JSONB. They
rendered, so nothing looked broken, but every business in the directory was a
coloured rectangle — and 528KB of base64 was inlined into the directory HTML on
every request, unoptimisable and uncacheable because a `data:` URI blows past
the image optimiser's 3072-character URL cap (see `lib/image-src.ts`).

These files live in `public/` specifically so that constraint is satisfied:
root-relative paths are the only kind the optimiser will resize.

## Source and licence

All photographs come from [Pexels](https://www.pexels.com) via its API.

The Pexels **content licence** permits free commercial use without attribution.
The Pexels **API guidelines**, which is how these arrived, additionally ask for:

- a prominent link back to Pexels — rendered under the directory results as
  `.dirsearch-photocredit`
- photographer credit where possible — recorded per-file in `credits.json`

`credits.json` is generated, not hand-maintained. It records the photographer,
their profile URL, the original Pexels page and the alt text for every file.

## Regenerating

```bash
PEXELS_API_KEY=... npx tsx scripts/fetch-directory-photos.ts
```

Overwrites the pool in place and rewrites `credits.json`. The key is only used
here; nothing at runtime talks to Pexels. Photos are re-encoded at quality 80 if
`sharp` can be loaded, which is what keeps the pool near 4MB rather than 6MB.

## Assigning them to listings

```bash
npx tsx scripts/seed-business-photos.ts             # dry run
npx tsx scripts/seed-business-photos.ts --apply     # writes
npx tsx scripts/seed-business-photos.ts --explain "Arepa Bakery#food"
```

Only profiles still holding `data:` placeholder art are touched, so a real
business's uploaded photo is never overwritten and re-runs are no-ops.

## These are temporary

Every one of these is a stand-in for a photo a real business has not uploaded
yet. As listings are claimed this pool should shrink, and the credit line under
the directory results should eventually be removed with it.

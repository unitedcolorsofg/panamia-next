/**
 * vinext's built-in image optimizer only accepts same-origin, root-relative
 * paths. `vinext/dist/server/image-optimization.js` rejects any `url` that
 * does not start with a single "/" and caps it at 3072 characters, and there
 * is no `images.remotePatterns` equivalent to widen that — the check is
 * unconditional.
 *
 * So every image we do not serve ourselves 400s and renders broken:
 *   - `data:` URIs (seeded placeholder art, and far past the 3072 cap)
 *   - remote URLs (R2 uploads via R2_PUBLIC_URL, remote avatars)
 *
 * `unoptimized` makes next/image emit the src verbatim instead of routing it
 * through /_next/image, which is the only way to render those. Local paths
 * still go through the optimizer, so our own assets keep being resized.
 */
export function isUnoptimizableImageSrc(src: unknown): boolean {
  // Static imports are bundled to a local asset path and always optimizable.
  if (typeof src !== 'string') return false;
  return !src.startsWith('/') || src.startsWith('//');
}

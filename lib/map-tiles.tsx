/**
 * Basemap tiles for every map on the site.
 *
 * pigeon-maps defaults to tile.openstreetmap.org, which is a problem twice
 * over. It looks like 2010 — beige land, canary roads, every label at every
 * zoom — and OpenStreetMap's tile usage policy asks that it not be used as the
 * basemap for other people's applications, because those servers are funded by
 * donations for OSM's own site.
 *
 * Stadia's Alidade Smooth is the same OpenStreetMap data rendered pale and
 * quiet, so the pins drawn on top are the only saturated thing on screen.
 *
 * CARTO's basemaps look similar and were tried first, but anonymous requests
 * now come back watermarked: a real PNG, HTTP 200, "API KEY REQUIRED" printed
 * across it. Do not go back without an account.
 */

/**
 * Optional. The production path is domain-based authentication: register
 * pana.social in the Stadia dashboard and browser requests authenticate on
 * their Origin and Referer headers, with no key in the bundle at all. That
 * needs proxy.ts to keep sending a Referer — it sets
 * Referrer-Policy: strict-origin-when-cross-origin, which is exactly what
 * Stadia asks for. A no-referrer policy would silently break it.
 *
 * So leaving this unset is correct in every environment we ship: Stadia
 * serves localhost keyless for development, and domain auth covers
 * production. Set it only for requests that carry no Origin/Referer — server
 * side or native — where domain auth has nothing to match on.
 *
 * Public by design if you do set it: it travels in every tile URL, so there
 * is nothing to leak. Stadia scopes it by domain allowlist instead.
 */
const API_KEY = process.env.NEXT_PUBLIC_STADIA_API_KEY;

type TileProvider = (x: number, y: number, z: number, dpr?: number) => string;

const stadia =
  (style: string): TileProvider =>
  (x, y, z, dpr) => {
    // The CDN serves a doubled-resolution tile under an @2x suffix. Without it
    // the map is visibly soft on phones and retina laptops.
    const retina = dpr && dpr > 1 ? '@2x' : '';
    const key = API_KEY ? `?api_key=${API_KEY}` : '';
    return `https://tiles.stadiamaps.com/tiles/${style}/${z}/${x}/${y}${retina}.png${key}`;
  };

/** Pale grey-green, soft labels. The quiet default. */
export const mapTiles = stadia('alidade_smooth');

/** Stark white and charcoal, no colour at all. An alternative, not in use. */
export const mapTilesToner = stadia('stamen_toner_lite');

/** Required credit for the tiles above. Pass to a pigeon-maps `attribution`. */
export function MapAttribution() {
  return (
    <span>
      ©{' '}
      <a href="https://stadiamaps.com/" target="_blank" rel="noreferrer">
        Stadia Maps
      </a>{' '}
      ©{' '}
      <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">
        OpenMapTiles
      </a>{' '}
      ©{' '}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        OpenStreetMap
      </a>{' '}
      contributors
    </span>
  );
}

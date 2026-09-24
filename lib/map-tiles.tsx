/**
 * Basemap tiles for every map on the site.
 *
 * pigeon-maps defaults to tile.openstreetmap.org, which is a problem twice
 * over. It looks like 2010 — beige land, canary roads, every label at every
 * zoom — and OpenStreetMap's tile usage policy asks that it not be used as the
 * basemap for other people's applications, because those servers are funded by
 * donations for OSM's own site.
 *
 * Two replacements have been tried. Keep both notes: each failed in a way that
 * looks like success if you only check the status code.
 *
 * CARTO's basemaps look right, but anonymous requests come back watermarked —
 * a real PNG, HTTP 200, "API KEY REQUIRED" printed across the middle. Byte
 * length and naturalWidth both pass. Only looking at the image catches it.
 *
 * Stadia's Alidade Smooth is the style we actually want: the same OpenStreetMap
 * data rendered pale and quiet, so the pins on top are the only saturated thing
 * on screen. It is parked, not abandoned — every request for this account 401s,
 * by domain auth and by API key alike, on tiles and on unrelated endpoints
 * (tz/lookup answers "No valid authentication provided"), so the property
 * itself is not authorised yet. Anonymous requests from *unregistered* domains
 * still get real tiles, which makes the failure look domain-shaped when it is
 * not.
 *
 * So the live basemap is Esri's World Light Gray Base: the same quiet canvas,
 * keyless, unwatermarked. See the bottom of this file to swap back.
 */

/**
 * Optional, and inert while Esri is the active basemap below.
 *
 * When Stadia is switched back on, the intended production path is
 * domain-based authentication: register the host under Manage Properties and
 * browser requests authenticate on their Origin and Referer headers, with no
 * key in the bundle at all. That depends on proxy.ts continuing to send a
 * Referer — it sets Referrer-Policy: strict-origin-when-cross-origin, which is
 * exactly what Stadia asks for. A no-referrer policy would silently break it.
 *
 * Neither path works today: the key 401s on every endpoint, so it is the
 * account that needs fixing, not this file. Verify with a bare curl before
 * trusting either one again, and look at the returned PNG rather than the
 * status code.
 *
 * Public by design if you do set it: it travels in every tile URL, so there is
 * nothing to leak. Stadia scopes it by domain allowlist instead. Next inlines
 * it at build time, so it has to be a CF *Build* variable, not a Runtime one.
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

/** Pale grey-green, soft labels. Parked until the Stadia property authorises. */
export const mapTilesStadia = stadia('alidade_smooth');

/** Stark white and charcoal, no colour at all. An alternative, not in use. */
export const mapTilesToner = stadia('stamen_toner_lite');

/** Required credit for the Stadia tiles. */
export function StadiaAttribution() {
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

/* ---------------------------------------------------------------- Esri ---- */

/**
 * Esri's World Light Gray Base, served without a key or an account.
 *
 * Two traps here. The path is z/y/x, not the z/x/y every other provider uses,
 * so transposing it returns tiles from the wrong part of the world rather than
 * an error. And there is no file extension and no @2x variant, so retina
 * screens get the 256px tile: pigeon-maps passes dpr, and we ignore it.
 */
const esriLightGray: TileProvider = (x, y, z) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`;

/** Required credit for the Esri tiles. */
function EsriAttribution() {
  return (
    <span>
      Tiles ©{' '}
      <a href="https://www.esri.com/" target="_blank" rel="noreferrer">
        Esri
      </a>{' '}
      — Esri, HERE, Garmin, ©{' '}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        OpenStreetMap
      </a>{' '}
      contributors, and the GIS user community
    </span>
  );
}

/* -------------------------------------------------------------- Active ---- */

/**
 * The basemap actually in use. Swap this pair to `mapTilesStadia` and
 * `StadiaAttribution` once the Stadia property is authorised — nothing else in
 * the app changes, because both maps import only these two names.
 */
export const mapTiles = esriLightGray;
export const MapAttribution = EsriAttribution;

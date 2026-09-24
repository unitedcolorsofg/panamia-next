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
 * So the live basemap is Esri's World Street Map: keyless, unwatermarked, and
 * labelled. Esri's Light Gray was the first pick and is still exported below,
 * but the Canvas family splits base tiles from label tiles, and pigeon-maps
 * draws a single layer, so it put no place names on the map at all.
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
 * Esri's ArcGIS basemaps, served without a key or an account.
 *
 * Two traps here. The path is z/y/x, not the z/x/y every other provider uses,
 * so transposing it returns tiles from the wrong part of the world rather than
 * an error. And there is no file extension and no @2x variant, so retina
 * screens get the 256px tile: pigeon-maps passes dpr, and we ignore it.
 */
const esri =
  (service: string): TileProvider =>
  (x, y, z) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/${z}/${y}/${x}`;

/** Cream land, coral highways, full place labels. The live basemap. */
const esriStreet = esri('World_Street_Map');

/**
 * Pale grey, no labels whatsoever — the Canvas family keeps place names in a
 * separate reference layer that pigeon-maps has nowhere to draw.
 */
export const mapTilesEsriLightGray = esri('Canvas/World_Light_Gray_Base');

/**
 * Required credit for the Esri tiles.
 *
 * Esri's full `copyrightText` for this service names thirteen data partners
 * and wrapped to two lines across the bottom of the map pane, which is a lot
 * of furniture for a 678px column. The visible credit is trimmed to the two
 * parties who require it — Esri for the tiles, OpenStreetMap for the ODbL
 * data inside them — and the full list is one hover away in the title.
 *
 * Re-read it from `.../World_Street_Map/MapServer?f=json` before editing; the
 * source list changes as their data partners do.
 */
const ESRI_SOURCES =
  'Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, ' +
  'Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), ' +
  'NGCC, (c) OpenStreetMap contributors, and the GIS User Community';

function EsriAttribution() {
  return (
    <span title={ESRI_SOURCES}>
      Tiles ©{' '}
      <a href="https://www.esri.com/" target="_blank" rel="noreferrer">
        Esri
      </a>
      , ©{' '}
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

/* -------------------------------------------------------------- Active ---- */

/**
 * The basemap actually in use. Swap this pair to `mapTilesStadia` and
 * `StadiaAttribution` once the Stadia property is authorised, or to
 * `mapTilesEsriLightGray` for the unlabelled grey canvas — nothing else in the
 * app changes, because both maps import only these two names.
 */
export const mapTiles = esriStreet;
export const MapAttribution = EsriAttribution;

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Map, Marker, Overlay, ZoomControl } from 'pigeon-maps';
import { ArrowRight, Globe, MapPin } from 'lucide-react';
import type { SearchResultsInterface } from '@/lib/query/directory';
import { isUnoptimizableImageSrc } from '@/lib/image-src';
import { mapTiles, MapAttribution } from '@/lib/map-tiles';
import { distanceInMiles, type Coords } from '@/app/p/[user]/_lib/profile-view';
import { formatDistance, resultCoords, resultHref } from '../_lib/format';

const FALLBACK_LOGO = '/img/bg_coconut_blue.jpg';

/** Centre of the three counties the directory covers, for an empty map. */
const DEFAULT_CENTER: [number, number] = [26.1, -80.2];

interface MapPanelProps {
  results: SearchResultsInterface[];
  viewerCoords: Coords | null;
  /**
   * The result the cursor is over in the results column, if any. Highlights
   * the matching pin without moving the map.
   */
  highlightId?: string | null;
  /** Called when a pin is chosen, so the list can scroll to the same result. */
  onPinSelect?: (id: string) => void;
}

interface Pin {
  result: SearchResultsInterface;
  coords: Coords;
  distance: number | null;
}

/**
 * Pick a centre and zoom that hold every pin.
 *
 * pigeon-maps has no fit-to-bounds, so the span is turned into a zoom level
 * directly: each zoom step halves the visible degrees, and the constants are
 * chosen so a single pin lands at neighbourhood zoom rather than street level,
 * where a lone marker on an empty tile tells you nothing about where it is.
 */
function frameFor(pins: Pin[]): { center: [number, number]; zoom: number } {
  if (pins.length === 0) return { center: DEFAULT_CENTER, zoom: 9 };

  const lats = pins.map((pin) => pin.coords.lat);
  const lngs = pins.map((pin) => pin.coords.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const center: [number, number] = [
    (minLat + maxLat) / 2,
    (minLng + maxLng) / 2,
  ];

  const span = Math.max(maxLat - minLat, (maxLng - minLng) * 0.85);
  if (span < 0.005) return { center, zoom: 13 };

  const zoom = Math.log2(360 / span) - 1.2;
  return { center, zoom: Math.max(8, Math.min(15, zoom)) };
}

/**
 * Results on a map.
 *
 * The map is a peer of the list, not a decoration: it is how you answer "what
 * is near me" when you do not yet know what you are looking for. It used to
 * carry its own compact list of the pinned results, because it was one half of
 * a List/Map toggle and needed to be legible alone. It is no longer alone —
 * the results column beside it is the list, permanently — so the copy is gone
 * and the map gets the whole pane. Hovering a card lights its pin; clicking a
 * pin scrolls the column to its card.
 *
 * Pins carry the business logo instead of a generic dot. On a map of thirty
 * results, identity is the whole point; thirty identical pins force a click to
 * learn anything.
 */
export function MapPanel({
  results,
  viewerCoords,
  highlightId = null,
  onPinSelect,
}: MapPanelProps) {
  const pins = useMemo<Pin[]>(
    () =>
      results.flatMap((result) => {
        if (result.online_only) return [];
        const coords = resultCoords(result);
        if (!coords) return [];
        return [
          {
            result,
            coords,
            distance: viewerCoords
              ? distanceInMiles(viewerCoords, coords)
              : null,
          },
        ];
      }),
    [results, viewerCoords]
  );

  const offMapCount = results.length - pins.length;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState(() => frameFor(pins));

  // Read without subscribing: the frame should follow the result set, not the
  // viewer's coordinates, and `pins` changes identity whenever either moves.
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  // Re-frame when the result set changes, not on every render: panning the map
  // must survive a re-render, but a new search should not leave the viewer
  // looking at the old neighbourhood.
  const pinKey = pins
    .map((pin) => pin.result._id)
    .sort()
    .join(',');
  useEffect(() => {
    setView(frameFor(pinsRef.current));
    setSelectedId(null);
  }, [pinKey]);

  const selected = pins.find((pin) => pin.result._id === selectedId) ?? null;

  const select = (id: string) => {
    setSelectedId(id);
    onPinSelect?.(id);
    const pin = pins.find((item) => item.result._id === id);
    if (pin) {
      // Centre on the choice rather than only highlighting it — a selection
      // off the edge of the viewport reads as a click that did nothing.
      setView((current) => ({
        center: [pin.coords.lat, pin.coords.lng],
        zoom: Math.max(current.zoom, 12),
      }));
    }
  };

  return (
    <div className="dirsearch-map">
      <Map
        center={view.center}
        zoom={view.zoom}
        onBoundsChanged={({ center, zoom }) => setView({ center, zoom })}
        provider={mapTiles}
        attribution={<MapAttribution />}
        attributionPrefix={false}
      >
        <ZoomControl />

        {viewerCoords && (
          <Marker
            anchor={[viewerCoords.lat, viewerCoords.lng]}
            width={26}
            color="#3b5bdb"
          />
        )}

        {pins.map(({ result, coords }) => (
          <Overlay
            key={result._id}
            anchor={[coords.lat, coords.lng]}
            offset={[19, 19]}
          >
            <button
              type="button"
              className="dirsearch-pin"
              data-on={result._id === selectedId || result._id === highlightId}
              onClick={() => select(result._id)}
              aria-label={`${result.name}, ${result.primary_address?.city ?? 'South Florida'}`}
            >
              <Image
                src={result.images?.primaryCDN || FALLBACK_LOGO}
                alt=""
                width={34}
                height={34}
                aria-hidden="true"
                unoptimized={isUnoptimizableImageSrc(result.images?.primaryCDN)}
              />
            </button>
          </Overlay>
        ))}
      </Map>

      {/* Online-only businesses match the search but cannot be plotted.
          Dropping them silently would make the map quietly lossy, so the count
          sits on the map itself — the only place left to say it now that the
          map has no list of its own. */}
      {offMapCount > 0 && (
        <p className="dirsearch-mapoffmap">
          <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
          {offMapCount === 1
            ? '1 result has no address to plot.'
            : `${offMapCount} results have no address to plot.`}
        </p>
      )}

      {selected && (
        <div className="dirsearch-map-card">
          <Image
            src={selected.result.images?.primaryCDN || FALLBACK_LOGO}
            alt=""
            width={44}
            height={44}
            aria-hidden="true"
            unoptimized={isUnoptimizableImageSrc(
              selected.result.images?.primaryCDN
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="dirsearch-map-card-name">{selected.result.name}</p>
            <p className="dirsearch-map-card-meta">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {selected.result.primary_address?.city}
              {selected.distance !== null &&
                ` · ${formatDistance(selected.distance)}`}
            </p>
          </div>
          <Link
            href={resultHref(selected.result)}
            className="dirsearch-map-card-go"
          >
            View
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}

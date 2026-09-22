'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Map, Marker, Overlay, ZoomControl } from 'pigeon-maps';
import { ArrowRight, BadgeCheck, Globe, MapPin } from 'lucide-react';
import type { SearchResultsInterface } from '@/lib/query/directory';
import { distanceInMiles, type Coords } from '@/app/p/[user]/_lib/profile-view';
import { formatDistance, resultCoords, resultHref } from '../_lib/format';

const FALLBACK_LOGO = '/img/bg_coconut_blue.jpg';

/** Centre of the three counties the directory covers, for an empty map. */
const DEFAULT_CENTER: [number, number] = [26.1, -80.2];

interface MapPanelProps {
  results: SearchResultsInterface[];
  viewerCoords: Coords | null;
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
 * is near me" when you do not yet know what you are looking for. So it keeps
 * the list alongside it — clicking either side selects on both — rather than
 * replacing the list with pins and making the visitor hunt.
 *
 * Pins carry the business logo instead of a generic dot. On a map of thirty
 * results, identity is the whole point; thirty identical pins force a click to
 * learn anything.
 */
export function MapPanel({ results, viewerCoords }: MapPanelProps) {
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
  const rowsRef = useRef<HTMLDivElement>(null);

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
    rowsRef.current?.scrollTo({ top: 0 });
  }, [pinKey]);

  const selected = pins.find((pin) => pin.result._id === selectedId) ?? null;

  const select = (id: string) => {
    setSelectedId(id);
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
    <div className="dirsearch-maplayout">
      <div className="dirsearch-maplist-col">
        <div className="dirsearch-maplist" ref={rowsRef}>
          {pins.map(({ result, distance }) => (
            <button
              key={result._id}
              type="button"
              className="dirsearch-maprow"
              data-on={result._id === selectedId}
              onClick={() => select(result._id)}
            >
              <Image
                src={result.images?.primaryCDN || FALLBACK_LOGO}
                alt=""
                width={40}
                height={40}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 text-left">
                <span className="dirsearch-maprow-name">
                  {result.name}
                  {result.certified && (
                    <BadgeCheck
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="dirsearch-maprow-meta">
                  {result.primary_address?.city}
                  {distance !== null && ` · ${formatDistance(distance)}`}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Online-only businesses match the search but cannot be plotted.
            Dropping them silently would make the map quietly lossy, so they
            are stated below the list — outside the scroll area, so the caveat
            is visible without scrolling past every pinned result. */}
        {offMapCount > 0 && (
          <p className="dirsearch-mapoffmap">
            <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
            {offMapCount === 1
              ? '1 matching business has no address to plot.'
              : `${offMapCount} matching businesses have no address to plot.`}
          </p>
        )}
      </div>

      <div className="dirsearch-map">
        <Map
          center={view.center}
          zoom={view.zoom}
          onBoundsChanged={({ center, zoom }) => setView({ center, zoom })}
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
                data-on={result._id === selectedId}
                onClick={() => select(result._id)}
                aria-label={`${result.name}, ${result.primary_address?.city ?? 'South Florida'}`}
              >
                <Image
                  src={result.images?.primaryCDN || FALLBACK_LOGO}
                  alt=""
                  width={34}
                  height={34}
                  aria-hidden="true"
                />
              </button>
            </Overlay>
          ))}
        </Map>

        {selected && (
          <div className="dirsearch-map-card">
            <Image
              src={selected.result.images?.primaryCDN || FALLBACK_LOGO}
              alt=""
              width={44}
              height={44}
              aria-hidden="true"
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
    </div>
  );
}

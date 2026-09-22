'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Globe, MapPin } from 'lucide-react';
import { formatDistance, type ScoredResult } from '../_data';

interface MapPanelProps {
  entries: ScoredResult[];
  locationShared: boolean;
  viewerPlace: string;
}

/**
 * Bounding box for the three counties the directory covers.
 *
 * Hard-coded because the mock has no tile provider — the real page would hand
 * these markers to a map library and delete all of this. What is being
 * reviewed here is the *layout*: a list that stays readable beside a map, and
 * markers that carry enough identity to be worth clicking.
 */
const BOUNDS = { minLat: 25.6, maxLat: 26.85, minLng: -80.5, maxLng: -80.0 };

function project({ lat, lng }: { lat: number; lng: number }) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  // Inset so a marker on the edge of the range is not clipped by the frame.
  return {
    left: `${6 + x * 0.88}%`,
    top: `${6 + y * 0.88}%`,
  };
}

export function MapPanel({
  entries,
  locationShared,
  viewerPlace,
}: MapPanelProps) {
  const mappable = entries.filter((entry) => entry.result.coords !== null);
  const onlineOnly = entries.filter((entry) => entry.result.coords === null);
  const [selectedId, setSelectedId] = useState<string | null>(
    mappable[0]?.result.id ?? null
  );

  const selected =
    mappable.find((entry) => entry.result.id === selectedId) ?? mappable[0];

  return (
    <div className="dirsearch-maplayout">
      <div className="dirsearch-maplist-col">
        <div className="dirsearch-maplist">
          {mappable.map((entry) => {
            const { result, distance } = entry;
            const on = result.id === selected?.result.id;
            return (
              <button
                key={result.id}
                type="button"
                className="dirsearch-maprow"
                data-on={on}
                onClick={() => setSelectedId(result.id)}
              >
                <Image
                  src={result.logo}
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
                    {result.city}
                    {distance !== null && ` · ${formatDistance(distance)}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Online-only businesses match the search but cannot be plotted.
            Dropping them silently would make the map quietly lossy, so they
            are stated below the list — outside the scroll area, so the
            caveat is visible without scrolling past every pinned result. */}
        {onlineOnly.length > 0 && (
          <p className="dirsearch-mapoffmap">
            <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
            {onlineOnly.length === 1
              ? '1 online-only business matched, but has no address to plot.'
              : `${onlineOnly.length} online-only businesses matched, but have no address to plot.`}
          </p>
        )}
      </div>

      <div className="dirsearch-map">
        <div className="dirsearch-map-grid" aria-hidden="true" />

        {locationShared && (
          <span
            className="dirsearch-map-you"
            style={project({ lat: 25.801, lng: -80.199 })}
            title={`You — ${viewerPlace}`}
          >
            <span className="dirsearch-map-youdot" />
            <span className="dirsearch-map-youlabel">You</span>
          </span>
        )}

        {mappable.map((entry) => {
          const { result } = entry;
          const on = result.id === selected?.result.id;
          return (
            <button
              key={result.id}
              type="button"
              className="dirsearch-map-pin"
              data-on={on}
              style={project(result.coords!)}
              onClick={() => setSelectedId(result.id)}
              aria-label={`${result.name}, ${result.city}`}
            >
              <Image
                src={result.logo}
                alt=""
                width={34}
                height={34}
                aria-hidden="true"
              />
            </button>
          );
        })}

        {selected && (
          <div className="dirsearch-map-card">
            <Image
              src={selected.result.logo}
              alt=""
              width={44}
              height={44}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="dirsearch-map-card-name">{selected.result.name}</p>
              <p className="dirsearch-map-card-meta">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {selected.result.city}
                {selected.distance !== null &&
                  ` · ${formatDistance(selected.distance)}`}
              </p>
            </div>
            <Link
              href={`/p/${selected.result.slug}`}
              className="dirsearch-map-card-go"
            >
              View
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        <p className="dirsearch-map-note">
          Illustrative map — the built page would plot these on real tiles.
        </p>
      </div>
    </div>
  );
}

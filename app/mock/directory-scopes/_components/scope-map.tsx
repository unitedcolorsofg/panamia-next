'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Globe, MapPin } from 'lucide-react';
import {
  distanceMiles,
  formatDistance,
  formatEventWhen,
  MOCK_VIEWER_COORDS,
  type BusinessResult,
  type Coords,
  type EventResult,
} from '../_data';

/**
 * Same bounding box and projection as /mock/directory, on purpose.
 *
 * The scoped event map is not a new map — it is the directory map plotting a
 * different table. Copying the projection keeps that claim honest: if the two
 * maps disagree about where Wynwood is, the mock is arguing for something the
 * build would not deliver.
 */
const BOUNDS = { minLat: 25.6, maxLat: 26.85, minLng: -80.5, maxLng: -80.0 };

function project({ lat, lng }: Coords) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return { left: `${6 + x * 0.88}%`, top: `${6 + y * 0.88}%` };
}

/**
 * The shape a map needs, which is much narrower than the shape a card needs.
 *
 * Businesses and events arrive at coordinates by different routes — a business
 * stores address_lat/address_lng on its own row, an event borrows venues.lat /
 * venues.lng through a join — but once projected they are the same pin. This
 * adapter is where that difference stops mattering.
 */
interface MapEntry {
  id: string;
  name: string;
  /** Second line: city for a business, venue + date for an event. */
  meta: string;
  image: string;
  coords: Coords | null;
  href: string;
}

export function businessEntries(results: BusinessResult[]): MapEntry[] {
  return results.map((result) => ({
    id: result.id,
    name: result.name,
    meta: result.city,
    image: result.logo,
    coords: result.coords,
    href: `/p/${result.slug}`,
  }));
}

export function eventEntries(results: EventResult[]): MapEntry[] {
  return results.map((result) => ({
    id: result.id,
    name: result.title,
    meta: result.venueName
      ? `${result.venueName} · ${formatEventWhen(result.inDays)}`
      : formatEventWhen(result.inDays),
    image: result.cover,
    coords: result.coords,
    href: `/events/${result.slug}`,
  }));
}

interface ScopeMapProps {
  entries: MapEntry[];
  locationShared: boolean;
  viewerPlace: string;
  /** Wording for the off-map caveat, which differs per kind. */
  offMapNoun: { one: string; many: string };
  /** Events get a calendar glyph in the pin list; businesses get a pin. */
  metaIcon: 'pin' | 'calendar';
}

export function ScopeMap({
  entries,
  locationShared,
  viewerPlace,
  offMapNoun,
  metaIcon,
}: ScopeMapProps) {
  const mappable = entries.filter((entry) => entry.coords !== null);
  const offMap = entries.filter((entry) => entry.coords === null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected =
    mappable.find((entry) => entry.id === selectedId) ?? mappable[0];

  const MetaIcon = metaIcon === 'calendar' ? CalendarDays : MapPin;

  const distanceFor = (coords: Coords | null) =>
    coords && locationShared ? distanceMiles(MOCK_VIEWER_COORDS, coords) : null;

  return (
    <div className="dirsearch-maplayout">
      <div className="dirsearch-maplist-col">
        <div className="dirsearch-maplist">
          {mappable.map((entry) => {
            const distance = distanceFor(entry.coords);
            return (
              <button
                key={entry.id}
                type="button"
                className="dirsearch-maprow"
                data-on={entry.id === selected?.id}
                onClick={() => setSelectedId(entry.id)}
              >
                <Image src={entry.image} alt="" width={40} height={40} aria-hidden="true" />
                <span className="min-w-0 flex-1 text-left">
                  <span className="dirsearch-maprow-name">{entry.name}</span>
                  <span className="dirsearch-maprow-meta">
                    {entry.meta}
                    {distance !== null && ` · ${formatDistance(distance)}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Results that matched but cannot be plotted. An online event is not
            a failed event, so it is named here rather than dropped — the same
            caveat the business map already makes. */}
        {offMap.length > 0 && (
          <p className="dirsearch-mapoffmap">
            <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
            {offMap.length === 1
              ? `1 ${offMapNoun.one} matched, but has no address to plot.`
              : `${offMap.length} ${offMapNoun.many} matched, but have no address to plot.`}
          </p>
        )}
      </div>

      <div className="dirsearch-map">
        <div className="dirsearch-map-grid" aria-hidden="true" />

        {locationShared && (
          <span
            className="dirsearch-map-you"
            style={project(MOCK_VIEWER_COORDS)}
            title={`You — ${viewerPlace}`}
          >
            <span className="dirsearch-map-youdot" />
            <span className="dirsearch-map-youlabel">You</span>
          </span>
        )}

        {mappable.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="dirsearch-map-pin"
            data-on={entry.id === selected?.id}
            style={project(entry.coords as Coords)}
            onClick={() => setSelectedId(entry.id)}
            aria-label={`${entry.name}, ${entry.meta}`}
          >
            <Image src={entry.image} alt="" width={34} height={34} aria-hidden="true" />
          </button>
        ))}

        {selected && (
          <div className="dirsearch-map-card">
            <Image src={selected.image} alt="" width={44} height={44} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="dirsearch-map-card-name">{selected.name}</p>
              <p className="dirsearch-map-card-meta">
                <MetaIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {selected.meta}
                {distanceFor(selected.coords) !== null &&
                  ` · ${formatDistance(distanceFor(selected.coords)!)}`}
              </p>
            </div>
            <Link href={selected.href} className="dirsearch-map-card-go">
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

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Coords } from './profile-view';

const STORAGE_KEY = 'pana_viewer_coords';

/**
 * How stale a cached location may be before we ask again.
 *
 * A day. People move around, but not usually far enough within one day to
 * change which businesses count as nearby — and re-prompting on every visit is
 * the fastest way to get permission denied permanently.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type LocationStatus = 'unknown' | 'asking' | 'granted' | 'denied';

interface StoredCoords extends Coords {
  at: number;
}

function readCached(): Coords | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredCoords;
    if (
      typeof parsed?.lat !== 'number' ||
      typeof parsed?.lng !== 'number' ||
      typeof parsed?.at !== 'number' ||
      Date.now() - parsed.at > MAX_AGE_MS
    ) {
      return null;
    }

    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    // Private mode, disabled storage, or a value written by an older build.
    return null;
  }
}

/**
 * The viewer's coordinates, for "x miles away".
 *
 * Kept on the client and never sent to the server. Distance is a fact about a
 * pair of points, and the only pair that matters here can be computed in the
 * browser — so there is no reason to collect a member's location server-side,
 * and a good reason not to.
 *
 * The permission prompt is only raised on an explicit click. A directory that
 * demands location access the moment it loads gets denied once and then never
 * gets to ask again.
 */
export function useViewerLocation(): {
  coords: Coords | null;
  status: LocationStatus;
  request: () => void;
} {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<LocationStatus>('unknown');

  // Read on mount rather than in the initial state so the server render and
  // the hydration render agree — localStorage does not exist on the server.
  useEffect(() => {
    const cached = readCached();
    if (cached) {
      setCoords(cached);
      setStatus('granted');
    }
  }, []);

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('denied');
      return;
    }

    setStatus('asking');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCoords(next);
        setStatus('granted');
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...next, at: Date.now() })
          );
        } catch {
          // Not being able to remember it is survivable; the distance still
          // shows for this visit.
        }
      },
      () => {
        // Denied, unavailable, or timed out. All three mean the same thing to
        // this page: show the location without a distance, and do not nag.
        setStatus('denied');
      },
      { maximumAge: MAX_AGE_MS, timeout: 10_000 }
    );
  }, []);

  return { coords, status, request };
}

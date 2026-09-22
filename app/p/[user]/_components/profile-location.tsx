'use client';

import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { Map, Marker, ZoomControl } from 'pigeon-maps';

interface ProfileLocationProps {
  address: {
    name?: string;
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    zipcode?: string;
    hours?: string;
  };
  geo?: {
    coordinates?: [number, number];
  };
}

function directionsFromAddress(address: ProfileLocationProps['address']) {
  const baseUrl = 'https://www.google.com/maps/search/';
  const parts = [
    address.street1,
    address.street2,
    address.city,
    address.state,
    address.zipcode,
  ].filter(Boolean);
  const query = parts.join('+').replace(/\s+/g, '+');
  return `${baseUrl}${query}`;
}

/**
 * Where to actually go.
 *
 * Carries the same eyebrow-and-heading furniture as every other section on the
 * page. It previously rendered as a bare shadcn card with a small sentence-case
 * title, which made the bottom of the page read as a different site than the
 * top.
 */
export function ProfileLocation({ address, geo }: ProfileLocationProps) {
  const { t } = useTranslation('profile');

  const coords = geo?.coordinates
    ? ([geo.coordinates[1], geo.coordinates[0]] as [number, number])
    : null;

  const handleMarkerClick = () => {
    window.open(directionsFromAddress(address));
  };

  return (
    <div>
      <div className="mb-8">
        <span className="section-eyebrow">{t('location.eyebrow')}</span>
        <h2 className="bizprofile-h2 mt-4">{t('location.heading')}</h2>
      </div>

      <div className="bizprofile-card p-6 md:p-8">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Hours */}
          {address.hours && (
            <div>
              <h3 className="text-xs font-extrabold tracking-wider uppercase opacity-60">
                {t('location.hours')}
              </h3>
              <p className="mt-2 font-semibold">{address.hours}</p>
            </div>
          )}

          {/* Address */}
          <div>
            <h3 className="text-xs font-extrabold tracking-wider uppercase opacity-60">
              {t('location.address')}
            </h3>
            <div className="mt-2 font-semibold">
              <div>
                {address.street1} {address.street2}
              </div>
              <div>
                {address.city} {address.state} {address.zipcode}
              </div>
            </div>
            <a
              href={directionsFromAddress(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="link-arrow mt-4 inline-flex text-sm"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {t('location.directions')}
            </a>
          </div>
        </div>

        {/* Map */}
        {coords && (
          <div className="mt-8 overflow-hidden rounded-2xl border-2 border-[rgb(17_13_13/0.08)]">
            <Map height={300} defaultCenter={coords} defaultZoom={12}>
              <ZoomControl />
              <Marker
                width={40}
                anchor={coords}
                color="#f28444"
                onClick={handleMarkerClick}
              />
            </Map>
          </div>
        )}
      </div>
    </div>
  );
}

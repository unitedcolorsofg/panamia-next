'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

export function ProfileLocation({ address, geo }: ProfileLocationProps) {
  const coords = geo?.coordinates
    ? ([geo.coordinates[1], geo.coordinates[0]] as [number, number])
    : null;

  const handleMarkerClick = () => {
    window.open(directionsFromAddress(address));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Hours */}
            {address.hours && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
                  Hours
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {address.hours}
                </p>
              </div>
            )}

            {/* Address */}
            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
                Address
              </h3>
              <div className="text-gray-700 dark:text-gray-300">
                <div>
                  {address.street1} {address.street2}
                </div>
                <div>
                  {address.city} {address.state} {address.zipcode}
                </div>
              </div>
              <Button variant="link" asChild className="mt-2 p-0">
                <a
                  href={directionsFromAddress(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  Get Directions
                </a>
              </Button>
            </div>
          </div>

          {/* Map */}
          {coords && (
            <div className="overflow-hidden rounded-lg border">
              <Map height={300} defaultCenter={coords} defaultZoom={12}>
                <ZoomControl />
                <Marker
                  width={40}
                  anchor={coords}
                  color="#ff8100"
                  onClick={handleMarkerClick}
                />
              </Map>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

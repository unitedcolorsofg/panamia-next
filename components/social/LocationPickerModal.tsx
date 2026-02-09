'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, MapPinned, Circle, Pencil, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface LocationData {
  type: 'Place';
  latitude?: number;
  longitude?: number;
  name?: string;
  precision?: 'precise' | 'general';
}

interface LocationPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelected: (location: LocationData) => void;
}

/**
 * Add random offset to coordinates within a radius
 * @param lat - Original latitude
 * @param lng - Original longitude
 * @param radiusMeters - Maximum offset radius in meters (default ~244m = 800ft)
 */
function fuzzyLocation(
  lat: number,
  lng: number,
  radiusMeters: number = 244
): { latitude: number; longitude: number } {
  // Earth's radius in meters
  const earthRadius = 6371000;

  // Random distance within radius
  const distance = Math.random() * radiusMeters;

  // Random angle
  const angle = Math.random() * 2 * Math.PI;

  // Calculate offsets
  const deltaLat = (distance * Math.cos(angle)) / earthRadius;
  const deltaLng =
    (distance * Math.sin(angle)) /
    (earthRadius * Math.cos((lat * Math.PI) / 180));

  return {
    latitude: lat + (deltaLat * 180) / Math.PI,
    longitude: lng + (deltaLng * 180) / Math.PI,
  };
}

export function LocationPickerModal({
  open,
  onOpenChange,
  onLocationSelected,
}: LocationPickerModalProps) {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [customName, setCustomName] = useState('');
  const { toast } = useToast();

  const requestGeolocation = (precision: 'precise' | 'general') => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation not supported',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
        duration: 4000,
      });
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        let latitude = position.coords.latitude;
        let longitude = position.coords.longitude;

        // Apply fuzzing for general location
        if (precision === 'general') {
          const fuzzed = fuzzyLocation(latitude, longitude);
          latitude = fuzzed.latitude;
          longitude = fuzzed.longitude;
        }

        onLocationSelected({
          type: 'Place',
          latitude,
          longitude,
          precision,
        });

        setIsGettingLocation(false);
        onOpenChange(false);

        toast({
          title: 'Location added',
          description:
            precision === 'precise'
              ? 'Your exact location has been attached.'
              : 'Your general area has been attached.',
          duration: 3000,
        });
      },
      (error) => {
        setIsGettingLocation(false);
        let message = 'Unable to get your location.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location access was denied.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Location unavailable.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out.';
        }
        toast({
          title: 'Location error',
          description: message,
          variant: 'destructive',
          duration: 4000,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleCustomLocation = () => {
    if (!customName.trim()) {
      toast({
        title: 'Enter a location',
        description: 'Please enter a place name.',
        variant: 'destructive',
        duration: 3000,
      });
      return;
    }

    onLocationSelected({
      type: 'Place',
      name: customName.trim(),
    });

    setCustomName('');
    onOpenChange(false);

    toast({
      title: 'Location added',
      description: `"${customName.trim()}" has been attached.`,
      duration: 3000,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Add Location
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Precise Location */}
          <button
            type="button"
            onClick={() => requestGeolocation('precise')}
            disabled={isGettingLocation}
            className="hover:bg-accent flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors disabled:opacity-50"
          >
            <MapPinned className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Precise Location</div>
              <div className="text-muted-foreground text-sm">
                Send pin-point current location
              </div>
            </div>
            {isGettingLocation && (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            )}
          </button>

          {/* General Area */}
          <button
            type="button"
            onClick={() => requestGeolocation('general')}
            disabled={isGettingLocation}
            className="hover:bg-accent flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors disabled:opacity-50"
          >
            <Circle className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">General Area</div>
              <div className="text-muted-foreground text-sm">
                Within ~800 feet of your location
              </div>
            </div>
            {isGettingLocation && (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            )}
          </button>

          {/* Custom Location */}
          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-start gap-3">
              <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">Custom Location</div>
                <div className="text-muted-foreground text-sm">
                  Enter a place name
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g., Central Park, NYC"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCustomLocation();
                  }
                }}
                className="flex-1"
                maxLength={100}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCustomLocation}
                disabled={!customName.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

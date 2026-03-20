'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';

export default function VenueEditor() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('US');
  const [postalCode, setPostalCode] = useState('');
  const [capacity, setCapacity] = useState('');
  const [parkingOptions, setParkingOptions] = useState('none');
  const [website, setWebsite] = useState('');
  const [accessibilityNotes, setAccessibilityNotes] = useState('');
  const [safetyContactName, setSafetyContactName] = useState('');
  const [safetyContactPhone, setSafetyContactPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Venue name is required');
      return;
    }
    if (!address.trim()) {
      setError('Address is required');
      return;
    }
    if (!city.trim()) {
      setError('City is required');
      return;
    }
    if (!state.trim()) {
      setError('State is required');
      return;
    }

    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        country: country.trim() || 'US',
      };
      if (postalCode.trim()) body.postalCode = postalCode.trim();
      if (capacity) body.capacity = parseInt(capacity) || undefined;
      body.parkingOptions = parkingOptions;
      if (website.trim()) body.website = website.trim();
      if (accessibilityNotes.trim())
        body.accessibilityNotes = accessibilityNotes.trim();
      if (safetyContactName.trim()) {
        body.safetyContact = {
          name: safetyContactName.trim(),
          phone: safetyContactPhone.trim(),
        };
      }

      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit venue');
      }
      router.push(`/venues/${result.data.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit venue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/venues"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to Venues
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Submit a Venue</h1>
        <p className="text-muted-foreground mt-2">
          Venues require admin approval before they can be used for events.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Card 1 — Venue Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Venue Details</span>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saving ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Venue name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="FL"
              maxLength={2}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal Code (optional)</Label>
            <Input
              id="postalCode"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="33101"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="US"
            />
          </div>
        </CardContent>
      </Card>

      {/* Card 2 — Facilities */}
      <Card>
        <CardHeader>
          <CardTitle>Facilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity (optional)</Label>
            <Input
              id="capacity"
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Leave blank if unknown"
              min={1}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parkingOptions">Parking</Label>
            <Select value={parkingOptions} onValueChange={setParkingOptions}>
              <SelectTrigger id="parkingOptions">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Parking</SelectItem>
                <SelectItem value="street">Street Parking</SelectItem>
                <SelectItem value="lot">Parking Lot</SelectItem>
                <SelectItem value="garage">Parking Garage</SelectItem>
                <SelectItem value="valet">Valet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website (optional)</Label>
            <Input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessibilityNotes">
              Accessibility Notes (optional)
            </Label>
            <Textarea
              id="accessibilityNotes"
              value={accessibilityNotes}
              onChange={(e) => setAccessibilityNotes(e.target.value)}
              placeholder="Wheelchair accessible, elevator available, etc."
            />
          </div>
        </CardContent>
      </Card>

      {/* Card 3 — Safety Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Safety Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Provide a safety contact for this venue (optional but recommended)
          </p>

          <div className="space-y-2">
            <Label htmlFor="safetyContactName">Safety Contact Name</Label>
            <Input
              id="safetyContactName"
              value={safetyContactName}
              onChange={(e) => setSafetyContactName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="safetyContactPhone">Safety Contact Phone</Label>
            <Input
              id="safetyContactPhone"
              type="tel"
              value={safetyContactPhone}
              onChange={(e) => setSafetyContactPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
            Your venue will be reviewed by Panamia admins before it appears in
            events.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

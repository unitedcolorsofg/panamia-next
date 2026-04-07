'use client';

import { useState, useEffect } from 'react';
// Phase 3 consent infrastructure — gate event creation behind module consent
// import { useModuleConsent } from '@/hooks/use-module-consent';
// import { ConsentModal } from '@/components/legal/ConsentModal';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save, Send } from 'lucide-react';

interface VenueOption {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface EventEditorProps {
  mode: 'create' | 'edit';
  initialData?: {
    slug?: string;
    title?: string;
    description?: string;
    venueId?: string;
    startsAt?: string;
    endsAt?: string;
    timezone?: string;
    visibility?: string;
    attendeeCap?: number | null;
    ageRestriction?: string;
    photoPolicy?: string;
    dresscode?: string;
    streamEligible?: boolean;
    status?: string;
  };
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MT, no DST)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
  { value: 'UTC', label: 'UTC' },
];

const INPUT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

function toDatetimeLocal(iso?: string): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

function fromDatetimeLocal(val: string): string | undefined {
  if (!val) return undefined;
  return new Date(val).toISOString();
}

export default function EventEditor({
  mode,
  initialData = {},
}: EventEditorProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData.title || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [venueId, setVenueId] = useState(initialData.venueId || '');
  const [startsAt, setStartsAt] = useState(
    toDatetimeLocal(initialData.startsAt)
  );
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(initialData.endsAt));
  const [timezone, setTimezone] = useState(
    initialData.timezone || 'America/New_York'
  );
  const [visibility, setVisibility] = useState(
    initialData.visibility || 'public'
  );
  const [attendeeCap, setAttendeeCap] = useState(
    initialData.attendeeCap != null ? String(initialData.attendeeCap) : ''
  );
  const [ageRestriction, setAgeRestriction] = useState(
    initialData.ageRestriction || 'all_ages'
  );
  const [photoPolicy, setPhotoPolicy] = useState(
    initialData.photoPolicy || 'allowed'
  );
  const [dresscode, setDresscode] = useState(initialData.dresscode || 'none');
  const [streamEligible, setStreamEligible] = useState(
    initialData.streamEligible ?? false
  );
  const [tosAccepted, setTosAccepted] = useState(false);

  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVenues() {
      try {
        const res = await fetch('/api/venues?status=active&limit=100');
        const data = await res.json();
        if (data.success) {
          setVenues(data.data || []);
        }
      } catch {
        // venues stay empty
      } finally {
        setLoadingVenues(false);
      }
    }
    fetchVenues();
  }, []);

  const handleSave = async () => {
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!venueId) {
      setError('Venue is required');
      return;
    }
    if (!startsAt) {
      setError('Start time is required');
      return;
    }
    if (mode === 'create' && !tosAccepted) {
      setError('You must agree to the Terms of Service');
      return;
    }
    // Phase 3 consent — archive threshold gate for events
    // Events become part of the community record after completion. The
    // existing tosAccepted checkbox above should be replaced by / wired
    // into the consent receipt system so acceptance is recorded with version,
    // IP, and GPC status.
    //
    // TODO: Uncomment when API routes are implemented:
    //
    // const { needsConsent, recordConsent: onEventConsent } =
    //   useModuleConsent({ document: 'terms', module: 'events', majorVersion: 0 });
    //
    // Render in JSX:
    // <ConsentModal
    //   open={needsConsent}
    //   type="gate"
    //   module="events"
    //   title="Events Terms"
    //   description="Event records become part of the community record after
    //     the event completes. Event photos enter the record 3 months after
    //     the event."
    //   policyUrl="/legal/terms/modules/events"
    //   onConsent={onEventConsent}
    // />

    setSaving(true);

    try {
      if (mode === 'create') {
        const body: Record<string, unknown> = {
          title: title.trim(),
          venueId,
          startsAt: fromDatetimeLocal(startsAt),
          timezone,
          visibility,
          ageRestriction,
          photoPolicy,
          dresscode,
          streamEligible,
          tos: true,
        };
        if (description.trim()) body.description = description.trim();
        if (endsAt) body.endsAt = fromDatetimeLocal(endsAt);
        if (attendeeCap) body.attendeeCap = Number(attendeeCap);

        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = await res.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to create event');
        }
        router.push(`/e/${result.data.slug}/edit`);
      } else {
        const body: Record<string, unknown> = {
          title: title.trim(),
          venueId,
          startsAt: fromDatetimeLocal(startsAt),
          timezone,
          visibility,
          ageRestriction,
          photoPolicy,
          dresscode,
          streamEligible,
        };
        if (description.trim()) body.description = description.trim();
        if (endsAt) body.endsAt = fromDatetimeLocal(endsAt);
        body.attendeeCap = attendeeCap ? Number(attendeeCap) : null;

        const res = await fetch(`/api/events/${initialData.slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = await res.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to save event');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!initialData.slug) return;
    setPublishing(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${initialData.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to publish event');
      }
      router.push(`/e/${initialData.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish event');
    } finally {
      setPublishing(false);
    }
  };

  const backHref = mode === 'create' ? '/e' : `/e/${initialData.slug}`;
  const backLabel = mode === 'create' ? '← Back to Events' : '← Back to Event';
  const heading = mode === 'create' ? 'Host an Event' : 'Edit Event';

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          {backLabel}
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{heading}</h1>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Card 1 — Event Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Event Details</span>
            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={saving} variant="outline">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              {mode === 'edit' && initialData.status !== 'published' && (
                <Button onClick={handlePublish} disabled={publishing}>
                  {publishing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {publishing ? 'Publishing...' : 'Publish'}
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event title..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="venueId">Venue</Label>
            <Select
              value={venueId}
              onValueChange={setVenueId}
              disabled={loadingVenues}
            >
              <SelectTrigger id="venueId">
                <SelectValue
                  placeholder={
                    loadingVenues ? 'Loading venues...' : 'Select a venue'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} — {v.city}, {v.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startsAt">Starts At</Label>
            <input
              id="startsAt"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={INPUT_CLASS}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endsAt">Ends At (optional)</Label>
            <input
              id="endsAt"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your event..."
              className="min-h-[120px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Card 2 — Event Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Event Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger id="visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="followers">Followers only</SelectItem>
                <SelectItem value="invite">Invite only</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ageRestriction">Age Restriction</Label>
            <Select value={ageRestriction} onValueChange={setAgeRestriction}>
              <SelectTrigger id="ageRestriction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_ages">All Ages</SelectItem>
                <SelectItem value="18_plus">18+</SelectItem>
                <SelectItem value="21_plus">21+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="photoPolicy">Photo Policy</Label>
            <Select value={photoPolicy} onValueChange={setPhotoPolicy}>
              <SelectTrigger id="photoPolicy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allowed">Photos Allowed</SelectItem>
                <SelectItem value="restricted">
                  Organizer Approval Required
                </SelectItem>
                <SelectItem value="prohibited">No Photos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dresscode">Dress Code</Label>
            <Select value={dresscode} onValueChange={setDresscode}>
              <SelectTrigger id="dresscode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Dress Code</SelectItem>
                <SelectItem value="smart_casual">Smart Casual</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendeeCap">Attendee Cap (optional)</Label>
            <Input
              id="attendeeCap"
              type="number"
              value={attendeeCap}
              onChange={(e) => setAttendeeCap(e.target.value)}
              placeholder="Unlimited"
              min={1}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="streamEligible"
                checked={streamEligible}
                onCheckedChange={(checked) =>
                  setStreamEligible(checked === true)
                }
              />
              <Label
                htmlFor="streamEligible"
                className="cursor-pointer font-normal"
              >
                I&apos;d like this event livestreamed by Panamia
              </Label>
            </div>
            <p className="text-muted-foreground pl-6 text-sm">
              Panamia will contact you to coordinate
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Card 3 — TOS (create mode only) */}
      {mode === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle>Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2">
              <Checkbox
                id="tosAccepted"
                checked={tosAccepted}
                onCheckedChange={(checked) => setTosAccepted(checked === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="tosAccepted"
                className="cursor-pointer leading-snug font-normal"
              >
                I agree that Panamia Club is a mandatory co-organizer on this
                event per the{' '}
                <Link href="/tos" className="text-primary underline">
                  Terms of Service
                </Link>
                .
              </Label>
            </div>
            <p className="text-muted-foreground text-sm">
              All events are free to attend.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

# Events Module Roadmap (`/e`)

## Overview

The Events module enables in-person community events for Panamia Club members. It covers the full lifecycle: venue management, event creation, RSVP/attendance tracking, co-organizer collaboration, event notes and photos, iCal export, ActivityPub federation, and optional Cloudflare Stream livestreaming.

All events are **free to attend**. Panamia Club is a mandatory co-organizer on every event (TOS agreement at creation) — tracked as `panamiaCoOrganizer: true` on the event record, not a system profile row.

---

## Venue Lifecycle

```
Submit → pending_review → active
                       ↘ suspended (cascade cancels future events)
```

1. A panaVerified user submits a venue via `POST /api/venues`
2. Status starts as `pending_review` — admin must approve before use
3. Admin approves via `POST /api/admin/venues/[slug]/approve` → status becomes `active`
4. Admin can suspend via `POST /api/admin/venues/[slug]/suspend`:
   - All future published events at the venue are **synchronously cancelled**
   - All going/maybe attendees receive a Delete notification (context: `event`)
   - Venue status becomes `suspended`

Venues require admin approval due to physical safety concerns (capacity, safety contact, accessibility).

---

## Event Lifecycle

```
draft → published → completed
      ↘ cancelled
```

- **draft**: Created but not visible to the public. Only the host organizer can see it.
- **published**: Publicly visible (if `visibility: public`). Attendees can RSVP.
- **completed**: Event has ended. Read-only.
- **cancelled**: Event was cancelled. iCal shows `STATUS:CANCELLED`.

Publishing requires the event to have an active venue. Only the host organizer (or admin) can publish or cancel.

---

## Attendance & RSVP Model

RSVP statuses: `invited | going | maybe | not_going`

- Only `going` RSVPs count toward `attendeeCount` (denormalized on the event)
- `attendeeCount` is updated transactionally on every RSVP change
- If `attendeeCap` is set and `attendeeCount >= attendeeCap`, new `going` RSVPs are rejected with 409 `SOLD_OUT`
- RSVP requires `panaVerified` (same gate as articles/mentoring)
- Withdrawing RSVP: `DELETE /api/events/[slug]/rsvp`

### RSVP List Visibility

| Caller                                        | Visible data                         |
| --------------------------------------------- | ------------------------------------ |
| Organizer with `canSeeRsvpList=true` or admin | Full list with profile details       |
| Attendee on public event                      | Names only                           |
| All others                                    | Count only: `{ going: N, maybe: N }` |

---

## Co-Organizer Invite Flow

1. Any organizer calls `POST /api/events/[slug]/organizers` with `{ username, role, message }`
2. Invited user receives an `Invite` notification (context: `event`)
3. Invited user calls `PATCH /api/events/[slug]/organizers/[profileId]` with `{ action: 'accept' | 'decline' }`
4. Host is notified of the response
5. Organizers can be removed via `DELETE` (cannot remove the host)

### Panamia Mandatory Co-Organizer

`panamiaCoOrganizer` is set to `true` at event creation and **cannot be changed**. Attempting to set it to `false` returns:

```json
{ "error": "We wanna crash this party!" }
```

with a 403 status.

---

## Platform-Defined Event Policies

Set at creation, editable by host organizer:

| Field            | Values                                          |
| ---------------- | ----------------------------------------------- |
| `ageRestriction` | `all_ages` (default), `18_plus`, `21_plus`      |
| `photoPolicy`    | `allowed` (default), `restricted`, `prohibited` |
| `dresscode`      | `none` (default), `smart_casual`, `formal`      |

These are displayed on the event detail page and enforced in the photo upload route.

---

## Photo Upload & Approval Workflow

1. Attendee (`going`/`maybe`) or organizer uploads photo via `POST /api/events/[slug]/photos` with `{ url, caption }`
   - The URL is a Vercel Blob URL (client-side upload, same pattern as social/media/upload)
   - Photos are immediately stored with `approved: false`
2. Organizer with `canSeeRsvpList=true` or admin approves via `PATCH /api/events/[slug]/photos/[photoId]` with `{ approved: true }`
3. Only approved photos appear in `GET /api/events/[slug]/photos` and `/e/[slug]/photos` for the public
4. Admins can see all photos (approved and unapproved)

---

## iCal Export

`GET /api/events/[slug]/calendar.ics` returns a hand-rolled RFC 5545 VCALENDAR with:

- `UID`: the stable `iCalUid` set at event creation (`{cuid}@panamia.club`)
- `DTSTART`/`DTEND`: local time with `TZID` parameter
- `DTSTAMP`: current UTC time
- `SUMMARY`: event title
- `DESCRIPTION`: description (HTML stripped, max 1000 chars)
- `LOCATION`: venue name and address
- `URL`: `https://panamia.club/e/{slug}`
- `STATUS`: `CONFIRMED` or `CANCELLED`

Lines are folded at 75 octets per RFC 5545. Special characters are escaped.

---

## ActivityPub Federation

Events integrate with the existing AP infrastructure in two ways:

### 1. Addressable AS2 Event Object (`/e/:slug`)

`proxy.ts` content-negotiates `/e/:slug` requests:

- If `Accept` header includes `application/activity+json` or `application/ld+json` → rewrites to `GET /api/federation/events/[slug]`
- Otherwise → serves the normal React page

`GET /api/federation/events/[slug]` returns:

```json
{
  "@context": ["https://www.w3.org/ns/activitystreams"],
  "type": "Event",
  "id": "https://panamia.club/e/{slug}",
  "name": "{title}",
  "content": "{description}",
  "url": "https://panamia.club/e/{slug}",
  "startTime": "{startsAt ISO8601}",
  "endTime": "{endsAt ISO8601}",
  "location": { "type": "Place", "name": "{venue.name}", "address": "..." },
  "attributedTo": "https://panamia.club/p/{hostScreenname}/",
  "published": "{createdAt ISO8601}",
  "updated": "{updatedAt ISO8601}"
}
```

Only published, public events are served. `Content-Type: application/activity+json`, `Cache-Control: max-age=180`.

### 2. Social Post on Publish (Phase 4)

When an event is published, the system auto-creates a `socialStatus` row with `eventId` set. This status is delivered to the host's followers via the existing AP outbox infrastructure — the same mechanism used for articles.

---

## Livestreaming: Cloudflare Stream

### Organizer Flow

1. Organizer sets `streamEligible: true` on event (any organizer role, via `PATCH /api/events/[slug]`)
2. Event appears in admin panel as requesting a stream
3. Admin coordinates with organizer and calls `POST /api/admin/events/[slug]/stream-setup`
4. System calls Cloudflare Stream API to create a live input with automatic recording
5. SRT URL + stream key are stored on the event and shown to organizers in `/e/[slug]/manage`
6. Organizer sets up GStreamer/OBS to stream via SRT to the provided URL + key
7. Live embed appears on event page when `streamStatus = 'live'`
8. Recording appears when `streamStatus = 'ended'` and `cfStreamRecordingUrl` is set

### Cloudflare Stream Webhook

`POST /api/events/[slug]/stream-webhook` (verified via `webhook-secret` header = `CF_STREAM_WEBHOOK_SECRET`):

| Event                      | Action                                          |
| -------------------------- | ----------------------------------------------- |
| `live.stream.connected`    | `streamStatus = 'live'`, `streamLiveAt = now`   |
| `live.stream.disconnected` | `streamStatus = 'ended'`, `streamEndedAt = now` |
| `recording.ready`          | `cfStreamRecordingUrl = url`                    |

### Required Env Vars

```
CF_ACCOUNT_ID=             # Cloudflare account ID
CF_STREAM_API_TOKEN=       # Stream API token with live input permissions
CF_STREAM_WEBHOOK_SECRET=  # Webhook validation secret
CF_STREAM_CUSTOMER_CODE=   # customer-{code}.cloudflarestream.com
```

---

## Venue Suspension Cascade

When an admin suspends a venue:

1. All future `published` events at the venue are **cancelled** (synchronous, in a loop)
2. All `going`/`maybe` attendees receive a `Delete` notification
3. The venue status is set to `suspended`

This is intentionally synchronous (not async/queued) because admin-initiated venue suspensions are infrequent and the notification count is bounded by the event attendee cap.

---

## Phased Rollout

### Phase 1 — Schema + Venues (complete)

- 10 new enums, 6 new tables (venues, events, eventOrganizers, eventAttendees, eventNotes, eventPhotos)
- `eventId` FK on `socialStatuses`
- Venue CRUD API + admin approve/suspend
- Migration files `0003_events_enums.sql` + `0004_events_tables.sql`

### Phase 2 — Events Core + RSVP (complete)

- Event CRUD API (create, read, update, delete, publish, cancel)
- RSVP API (upsert, withdraw, attendee count tracking, capacity gate)
- Organizer invite/accept/decline flow
- Notes API (audience-filtered)
- Photos API (upload, approve, delete)
- iCal export (`/api/events/[slug]/calendar.ics`)
- ActivityPub federation (`/api/federation/events/[slug]`)
- Cloudflare Stream admin setup + webhook handler
- Page routes: `/e`, `/e/new`, `/e/[slug]`, `/e/[slug]/manage`, `/venues`, `/venues/[slug]`
- MainHeader + AdminHeader navigation

### Phase 3 — Notes + Photos UI

- Full notes posting UI in `/e/[slug]/manage/notes`
- Photo upload UI in event detail page
- Photo approval queue in `/e/[slug]/manage/photos`

### Phase 4 — Social Post on Publish

- Auto-create `socialStatus` row when event is published
- Deliver to host's followers via AP outbox
- Replace CI playwright.yml Neon → Supabase test DB

### Phase 5 — Livestreaming UI

- Admin panel: list stream-eligible events, trigger stream setup
- Organizer manage page: show SRT credentials, stream status in real-time
- Event page: auto-refresh live embed when `streamStatus = 'live'`

---

## Access Control Summary

| Action                     | Required                                      |
| -------------------------- | --------------------------------------------- |
| Create venue               | `panaVerified`                                |
| Approve/suspend venue      | `isAdmin`                                     |
| Create event               | `panaVerified` + active venue                 |
| Edit/cancel event          | host organizer or admin                       |
| Mark `streamEligible`      | any organizer                                 |
| Setup CF Stream live input | `isAdmin`                                     |
| RSVP                       | `panaVerified`                                |
| Post event note            | any organizer                                 |
| Upload photo               | attendee (`going`/`maybe`) or organizer       |
| Approve photo              | organizer with `canSeeRsvpList=true` or admin |
| View full RSVP list        | organizer with `canSeeRsvpList=true` or admin |

---

## Schema Quick Reference

### New Enums

`event_status`, `event_visibility`, `venue_status`, `organizer_role`, `attendee_status`, `age_restriction`, `photo_policy`, `dresscode`, `parking_options`, `stream_status`

### New Tables

`venues`, `events`, `event_organizers`, `event_attendees`, `event_notes`, `event_photos`

### Modified Tables

`social_statuses` — added `event_id` FK (nullable, SET NULL on event delete)
`notification_context` enum — added `'event'`
`notification_object_type` enum — added `'event'`, `'venue'`

### Slug Generation

Both venues and events use `lib/events/slug.ts`:

```ts
generateSlug('My Event Title'); // => "my-event-title-abc123"
```

Slugs are URL-safe, lowercase, max 60 chars base + 6 char nanoid suffix.

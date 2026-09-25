'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Globe,
  Lock,
  MapPin,
  Store,
  User,
  Users,
} from 'lucide-react';
import {
  CATEGORY_LABEL,
  distanceMiles,
  formatCountdown,
  formatDistance,
  formatEventWhen,
  MOCK_VIEWER_COORDS,
  type BusinessResult,
  type Coords,
  type EventResult,
  type GroupResult,
  type PanaResult,
  type Scope,
} from '../_data';

/**
 * The same icon vocabulary the typeahead uses, so a row in the dropdown and
 * the card it leads to are marked the same way. Changing one without the other
 * is the bug this shared map exists to prevent.
 */
export const KIND_ICON = {
  business: Store,
  pana: User,
  group: Users,
  event: CalendarDays,
} as const;

/**
 * Kind badge.
 *
 * Only drawn in the Everything scope. Inside a single-kind scope every card is
 * the same kind, so a badge on each one is noise that says what the selector
 * already said.
 */
function KindPill({ kind }: { kind: Exclude<Scope, 'all'> }) {
  const Icon = KIND_ICON[kind];
  const label = { business: 'Business', pana: 'Pana', group: 'Group', event: 'Event' }[kind];
  return (
    <span className="dirsearch-chip inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function distanceTo(coords: Coords | null, locationShared: boolean) {
  if (!coords || !locationShared) return null;
  return distanceMiles(MOCK_VIEWER_COORDS, coords);
}

interface CardProps {
  showKind: boolean;
  locationShared: boolean;
}

/* --------------------------------------------------------------- business */

export function BusinessCard({
  result,
  showKind,
  locationShared,
}: CardProps & { result: BusinessResult }) {
  const href = `/p/${result.slug}`;
  const distance = distanceTo(result.coords, locationShared);

  return (
    <article className="dirsearch-card">
      <Link href={href} className="dirsearch-card-media" aria-label={result.name}>
        <Image
          src={result.cover}
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 260px"
          className="object-cover"
        />
        {result.certified && (
          <span className="dirsearch-card-cert">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Pana Certified
          </span>
        )}
      </Link>

      <div className="dirsearch-card-body min-w-0 flex-1">
        <div className="dirsearch-card-head">
          <span className="dirsearch-card-logo">
            <Image src={result.logo} alt="" width={52} height={52} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">
              <Link href={href}>{result.name}</Link>
            </h3>
            <p className="dirsearch-card-tagline">{result.tagline}</p>
          </div>
          {showKind && <KindPill kind="business" />}
        </div>

        <p className="dirsearch-card-where">
          {result.coords === null ? (
            <>
              <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Online only — serves all of South Florida</span>
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{result.city}</span>
              {distance !== null && (
                <span className="dirsearch-card-distance">
                  {formatDistance(distance)}
                </span>
              )}
            </>
          )}
        </p>

        <p className="dirsearch-card-blurb">{result.blurb}</p>

        <ul className="dirsearch-card-cats">
          {result.categories.map((category) => (
            <li key={category}>{CATEGORY_LABEL[category] ?? category}</li>
          ))}
        </ul>

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            <span className="dirsearch-card-counts">
              <strong>{result.recommendedCount}</strong> recommend
            </span>
          </div>
          <div className="dirsearch-card-actions">
            <Link href={href} className="dirsearch-view">
              View profile
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------- pana */

/**
 * A pana has no cover image, no address and no distance — and that is the
 * point. The card carries identity and the one thing that actually helps a
 * member decide whether to open it: how connected this person already is to
 * them. Giving it a media strip would mean inventing a photo of a place a
 * person does not have.
 */
export function PanaCard({
  result,
  showKind,
}: CardProps & { result: PanaResult }) {
  const href = `/u/${result.handle}`;

  return (
    <article className="dirsearch-card">
      {/* No media strip at all. At >=40rem `.dirsearch-card` becomes a flex
          row with a 15rem cover beside the body; a pana has no cover to put
          there, so the body is the whole row. (`min-w-0 flex-1` is on every
          card body here — `.dirsearch-card-body` carries no grow of its own,
          which leaves the foot bunched in the middle instead of spanning.) */}
      <div className="dirsearch-card-body min-w-0 flex-1">
        <div className="dirsearch-card-head">
          <span className="dirsearch-card-logo">
            <Image src={result.avatar} alt="" width={52} height={52} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">
              <Link href={href}>{result.name}</Link>
            </h3>
            <p className="dirsearch-card-tagline">@{result.handle}</p>
          </div>
          {showKind && <KindPill kind="pana" />}
        </div>

        <p className="dirsearch-card-blurb">{result.bio}</p>

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            <span className="dirsearch-card-counts">
              {result.sharedGroups > 0 ? (
                <>
                  <strong>{result.sharedGroups}</strong>
                  {result.sharedGroups === 1 ? ' group' : ' groups'} in common
                </>
              ) : (
                <>
                  <strong>{result.groupCount}</strong>
                  {result.groupCount === 1 ? ' group' : ' groups'}
                </>
              )}
            </span>
            <span className="dirsearch-card-active">
              Pana since {result.joinedYear}
            </span>
          </div>
          <div className="dirsearch-card-actions">
            <Link href={href} className="dirsearch-view">
              View pana
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ group */

export function GroupCard({
  result,
  showKind,
}: CardProps & { result: GroupResult }) {
  const href = `/r/groups/${result.id}`;

  return (
    <article className="dirsearch-card">
      {/* A cover strip rather than the square logo slot the business card
          uses. `.dirsearch-card-logo` is `object-fit: contain`, built for a
          square mark on transparent — a wide group banner shrinks to a
          sliver in it. relay_groups.picture is whatever the relay was given,
          so the card has to survive any aspect ratio. */}
      <Link href={href} className="dirsearch-card-media" aria-label={result.name}>
        <Image
          src={result.picture}
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 260px"
          className="object-cover"
        />
        {result.joinPolicy === 'invite_only' && (
          <span className="dirsearch-card-cert">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Invite only
          </span>
        )}
      </Link>

      <div className="dirsearch-card-body min-w-0 flex-1">
        <div className="dirsearch-card-head">
          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">
              <Link href={href}>{result.name}</Link>
            </h3>
            <p className="dirsearch-card-tagline">
              {result.memberCount.toLocaleString()} members
            </p>
          </div>
          {showKind && <KindPill kind="group" />}
        </div>

        <p className="dirsearch-card-blurb">{result.about}</p>

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            {/* An invite-only group that shows up in search still cannot be
                joined from here. Saying so on the card is the difference
                between a closed door and a broken button. */}
            <span className="dirsearch-card-counts">
              {result.joinPolicy === 'open'
                ? 'Open to any pana'
                : 'Ask a member for an invite'}
            </span>
          </div>
          <div className="dirsearch-card-actions">
            <Link href={href} className="dirsearch-view">
              View group
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ event */

export function EventCard({
  result,
  showKind,
  locationShared,
}: CardProps & { result: EventResult }) {
  const href = `/events/${result.slug}`;
  const distance = distanceTo(result.coords, locationShared);
  const nearlyFull =
    result.attendeeCap !== null &&
    result.attendeeCount / result.attendeeCap >= 0.85;

  return (
    <article className="dirsearch-card">
      <Link href={href} className="dirsearch-card-media" aria-label={result.title}>
        <Image
          src={result.cover}
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 260px"
          className="object-cover"
        />
        {/* When it happens is the first thing you need from an event, so it
            sits on the image rather than waiting its turn in the body. */}
        <span className="dirsearch-card-cert">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {formatEventWhen(result.inDays)}
        </span>
      </Link>

      <div className="dirsearch-card-body min-w-0 flex-1">
        <div className="dirsearch-card-head">
          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">
              <Link href={href}>{result.title}</Link>
            </h3>
            <p className="dirsearch-card-tagline">
              Hosted by {result.hostName}
            </p>
          </div>
          {showKind && <KindPill kind="event" />}
        </div>

        <p className="dirsearch-card-where">
          {result.mode === 'online' ? (
            <>
              <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Online — {formatCountdown(result.inDays)}</span>
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {result.venueName}, {result.city}
              </span>
              {distance !== null && (
                <span className="dirsearch-card-distance">
                  {formatDistance(distance)}
                </span>
              )}
            </>
          )}
        </p>

        <p className="dirsearch-card-blurb">{result.description}</p>

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            <span className="dirsearch-card-counts">
              <strong>{result.attendeeCount}</strong> going
              {result.attendeeCap !== null && (
                <>
                  <i aria-hidden="true">·</i>
                  {nearlyFull
                    ? `${result.attendeeCap - result.attendeeCount} spots left`
                    : `cap ${result.attendeeCap}`}
                </>
              )}
            </span>
            <span className="dirsearch-card-active">
              {formatCountdown(result.inDays)}
            </span>
          </div>
          <div className="dirsearch-card-actions">
            <Link href={href} className="dirsearch-view">
              View event
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

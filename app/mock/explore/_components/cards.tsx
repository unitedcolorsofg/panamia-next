'use client';

import Image from 'next/image';
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  CircleDot,
  Clock,
  Globe,
  Lock,
  MapPin,
  Repeat,
  SearchX,
  Store,
  Ticket,
  UserPlus,
  Users,
} from 'lucide-react';
import { KIND_ICON } from '@/components/kind-icon';
import {
  JOIN_LABEL,
  type ExploreScope,
  type MockListing,
  type MockEvent,
  type MockGroup,
  type MockPana,
} from '../_data';

/**
 * The four result cards, one per explore page.
 *
 * Deliberately four and not one. `/mock/directory-unified` argues the opposite
 * case — that a single card can carry every kind — and that argument is sound
 * *for a mixed list*, where results of different kinds sit beside each other
 * and a shared shape is the only thing making them comparable.
 *
 * This proposal removes mixed lists. Once Events is its own page, every card
 * on it is an event, nothing is being compared across kinds, and the shared
 * shape stops buying anything while still costing the fields it could not fit.
 * A list of events that all read "0 recommend · 0 saved" and bury the start
 * time in a footnote is worse than a list of events shaped like events.
 *
 * So: same chrome, same `.dirsearch-card` primitives, same vertical rhythm —
 * different fields in the slots, chosen per kind. The cards stay siblings
 * without pretending to be the same card.
 */

/* --- Directory listings --------------------------------------------------- */

/**
 * Unchanged from `app/directory/search/_components/result-card.tsx`, minus the
 * live data plumbing.
 *
 * Nothing in this proposal touches the listing card, and that is the point
 * worth seeing: the directory is not being rebuilt, it is being *relieved* of
 * three kinds it was serving badly. The one page that already worked keeps
 * working. The only change here is a row removed from the rail above it.
 */
export function ListingCard({ listing }: { listing: MockListing }) {
  return (
    <article className="dirsearch-card">
      <span className="dirsearch-card-media">
        {listing.cover ? (
          <Image
            src={listing.cover}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 260px"
            className="object-cover"
          />
        ) : (
          <CoverFallback kind="directory" />
        )}
        {listing.certified && (
          <span className="dirsearch-card-cert">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Pana Certified
          </span>
        )}
      </span>

      <div className="dirsearch-card-body">
        <div className="dirsearch-card-head">
          {listing.badge && (
            <span className="dirsearch-card-logo">
              <Image src={listing.badge} alt="" width={52} height={52} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">{listing.name}</h3>
            <p className="dirsearch-card-tagline">{listing.tagline}</p>
          </div>
        </div>

        <p className="dirsearch-card-where">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{listing.where}</span>
          {listing.distance ? (
            <span className="dirsearch-card-distance">{listing.distance}</span>
          ) : (
            <span className="dirsearch-card-distance-off">
              Share location for distance
            </span>
          )}
        </p>

        <p className="dirsearch-card-blurb">{listing.blurb}</p>

        <ul className="dirsearch-card-cats">
          {listing.categories.map((category) => (
            <li key={category}>{category}</li>
          ))}
        </ul>

        {/* The one place a listing still mentions an event, and it survives
            the split intact. This is not a search result for the event — it is
            a reason to visit *this place* this week. Which is exactly why
            one line of it here was never a substitute for an events page. */}
        {listing.nextEvent && (
          <span className="dirsearch-card-event">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            <strong>Next event</strong>
            <span>{listing.nextEvent}</span>
          </span>
        )}

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            {listing.faces.length > 0 && (
              <span className="dirsearch-card-avatars" aria-hidden="true">
                {listing.faces.map((face) => (
                  <Image key={face} src={face} alt="" width={26} height={26} />
                ))}
              </span>
            )}
            <span className="dirsearch-card-counts">
              <strong>{listing.signal}</strong>
            </span>
          </div>

          <div className="dirsearch-card-actions">
            <button type="button" className="dirsearch-save">
              <Bookmark className="h-4 w-4" fill="none" aria-hidden="true" />
              Save
            </button>
            <span className="dirsearch-view">
              View profile
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

/* --- Events -------------------------------------------------------------- */

/**
 * One event.
 *
 * Reordered against the listing card on purpose. A listing is chosen by
 * *what it is*, so the name and the tagline lead. An event is chosen by
 * whether you can be there, so the time leads and everything else is a
 * tiebreaker. Someone scanning Saturday is reading for "7pm, Little Haiti,
 * free" and will not read the blurb of anything failing that test.
 *
 * Capacity sits beside the RSVP because it is the thing that changes the
 * button. A full event still offering "RSVP" is a promise the page cannot
 * keep, and `cap: null` means uncapped rather than zero — a distinction the
 * card has to make or it will advertise "0 left" on an open event.
 */
export function EventCard({ event }: { event: MockEvent }) {
  const full = event.cap !== null && event.going >= event.cap;
  const pressure =
    event.cap === null
      ? null
      : Math.min(100, Math.round((event.going / event.cap) * 100));

  return (
    <article className="dirsearch-card">
      <span className="dirsearch-card-media">
        {event.cover ? (
          <Image
            src={event.cover}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 260px"
            className="object-cover"
          />
        ) : (
          <CoverFallback kind="event" />
        )}
        <span className="dirsearch-card-cert">
          <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
          {event.price}
        </span>
      </span>

      <div className="dirsearch-card-body">
        {/* Time above the name. The only inversion in the whole set, and the
            single clearest reason this card could not stay shared with the
            directory's. */}
        <span className="dirsearch-card-event">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <strong>{event.time}</strong>
          <span>{event.dayLabel}</span>
        </span>

        <div className="dirsearch-card-head">
          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">{event.name}</h3>
            <p className="dirsearch-card-tagline">Hosted by {event.host}</p>
          </div>
        </div>

        <p className="dirsearch-card-where">
          {event.mode === 'online' ? (
            <>
              <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Online — link sent on RSVP</span>
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{event.venue}</span>
              {event.where && (
                <span className="dirsearch-card-distance">{event.where}</span>
              )}
            </>
          )}
        </p>

        <p className="dirsearch-card-blurb">{event.blurb}</p>

        <ul className="dirsearch-card-cats">
          {event.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            {event.faces.length > 0 && (
              <span className="dirsearch-card-avatars" aria-hidden="true">
                {event.faces.map((face) => (
                  <Image key={face} src={face} alt="" width={26} height={26} />
                ))}
              </span>
            )}
            <span className="dirsearch-card-counts">
              <strong>{event.going}</strong> going
              {event.cap !== null && (
                <>
                  <i aria-hidden="true">·</i>
                  {full ? 'at capacity' : `${event.cap - event.going} left`}
                </>
              )}
            </span>
          </div>

          <div className="dirsearch-card-actions">
            <button type="button" className="dirsearch-save">
              <Bookmark className="h-4 w-4" fill="none" aria-hidden="true" />
              Save
            </button>
            <span className="dirsearch-view">
              {full ? 'Join waitlist' : 'RSVP'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
        </div>

        {/* A bar rather than a number alone. "38 going" means nothing without
            the denominator, and the denominator is what tells someone to act
            today instead of Thursday. Uncapped events get no bar — there is
            nothing to fill. */}
        {pressure !== null && (
          <span
            className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-black/10"
            aria-hidden="true"
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${pressure}%`,
                backgroundColor: full
                  ? 'var(--color-pana-burnt)'
                  : 'var(--surface-tone, var(--color-pana-indigo))',
              }}
            />
          </span>
        )}
      </div>
    </article>
  );
}

/* --- Groups -------------------------------------------------------------- */

/**
 * One group.
 *
 * A group is a commitment rather than an outing, so the question it answers is
 * "how often, with how many, and will they have me". Rhythm, member count and
 * join policy are promoted above the blurb for that reason; the description is
 * the last thing read, not the first.
 *
 * Join policy especially. Today a pana finds a group, clicks through, and only
 * then learns it is invite-only. That is a wasted click the card can spend one
 * word preventing.
 *
 * Who can see whom
 * ----------------
 * The group is public, and so is the fact that real people are in it. Faces
 * show either way: a wall of avatars is what tells a stranger this is a living
 * group rather than an empty listing, and a bare number never carries that.
 *
 * What never shows is anything that turns a face into a person you can look
 * up — no names, no profile links, nothing in the alt text. The roster reads
 * as a crowd instead of a list, which keeps the page persuasive without
 * publishing a walkable directory of members.
 *
 * This matches what the listing and event cards already did, so the rule is
 * now one rule everywhere rather than a per-card judgement call.
 *
 * "You're in" still waits for sign-in. That one is a fact about the viewer
 * rather than about the group, and a signed-out visitor is not in anything.
 */
export function GroupCard({
  group,
  signedIn,
}: {
  group: MockGroup;
  signedIn: boolean;
}) {
  return (
    <article className="dirsearch-card">
      <span className="dirsearch-card-media">
        {group.cover ? (
          <Image
            src={group.cover}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 260px"
            className="object-cover"
          />
        ) : (
          <CoverFallback kind="group" />
        )}
        <span className="dirsearch-card-cert">
          {group.joinPolicy === 'open' ? (
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {JOIN_LABEL[group.joinPolicy]}
        </span>
      </span>

      <div className="dirsearch-card-body">
        {/* Rhythm sits where the event card puts its clock. A group that meets
            is a different proposition from a group that merely exists, and
            "second Saturday, monthly" is the fact separating them. */}
        <span className="dirsearch-card-event">
          <Repeat className="h-4 w-4 shrink-0" aria-hidden="true" />
          <strong>{group.rhythm ?? 'No set schedule'}</strong>
          <span>{group.activity}</span>
        </span>

        <div className="dirsearch-card-head">
          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">{group.name}</h3>
            <p className="dirsearch-card-tagline">{group.purpose}</p>
          </div>
        </div>

        <p className="dirsearch-card-where">
          {group.where ? (
            <>
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{group.where}</span>
              <span className="dirsearch-card-distance">{group.mode}</span>
            </>
          ) : (
            <>
              <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Online — no fixed meeting place</span>
            </>
          )}
        </p>

        <p className="dirsearch-card-blurb">{group.blurb}</p>

        <ul className="dirsearch-card-cats">
          {group.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            {/* Faces, never names. The avatars are decorative by design — no
                alt text, no link, nothing to click through to — so the crowd
                reads as real without becoming a list of who to go find. */}
            {group.faces.length > 0 && (
              <span className="dirsearch-card-avatars" aria-hidden="true">
                {group.faces.map((face) => (
                  <Image key={face} src={face} alt="" width={26} height={26} />
                ))}
              </span>
            )}
            <span className="dirsearch-card-counts">
              <strong>{group.members}</strong> members
            </span>
          </div>

          <div className="dirsearch-card-actions">
            {/* "You're in" is a fact about the viewer, so a signed-out visitor
                never sees it — they are not in anything yet. */}
            {signedIn && group.joined ? (
              <span className="dirsearch-card-active">
                <CircleDot
                  className="mr-1 inline h-3.5 w-3.5"
                  aria-hidden="true"
                />
                You&rsquo;re in
              </span>
            ) : (
              group.joinPolicy !== 'invite' && (
                <button type="button" className="dirsearch-save">
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  {JOIN_LABEL[group.joinPolicy]}
                </button>
              )
            )}
            <span className="dirsearch-view">
              View group
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

/* --- Panas --------------------------------------------------------------- */

/**
 * One pana.
 *
 * The only card here that drops the cover image, because a person *is* a face
 * and a cropped banner above a face is two pictures competing for one glance.
 * That is also why panas get a two-up grid rather than the single column the
 * other three use: there is less to read per card, so a full-width column of
 * them would waste most of the screen.
 *
 * `.profile-card` rather than `.dirsearch-card` — that primitive exists for
 * exactly this, by its own comment ("posts, panas, businesses, and groups"),
 * and is the flat shape the rest of the member surfaces already use.
 */
export function PanaCard({ pana }: { pana: MockPana }) {
  return (
    <article className="profile-card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <Image
          src={pana.avatar}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <h3 className="dirsearch-card-name">{pana.name}</h3>
          <p className="dirsearch-card-tagline">{pana.handle}</p>
        </div>
      </div>

      <p className="dirsearch-card-blurb">{pana.headline}</p>

      {/* What they run is the most useful single fact about a pana on a
          discovery page, and today's compact row has nowhere to put it. It is
          the difference between a name and a reason to say hello. */}
      {pana.runs && (
        <span className="dirsearch-card-event">
          <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
          <strong>{pana.runs}</strong>
        </span>
      )}

      <p className="dirsearch-card-where">
        {pana.where ? (
          <>
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{pana.where}</span>
          </>
        ) : (
          <>
            <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>South Florida</span>
          </>
        )}
      </p>

      <ul className="dirsearch-card-cats">
        {pana.interests.map((interest) => (
          <li key={interest}>{interest}</li>
        ))}
      </ul>

      <div className="dirsearch-card-foot">
        <span className="dirsearch-card-counts">
          <strong>{pana.mutuals}</strong> in common
          <i aria-hidden="true">·</i>
          <strong>{pana.followers}</strong> followers
        </span>
        <div className="dirsearch-card-actions">
          <button type="button" className="dirsearch-save">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Follow
          </button>
        </div>
      </div>
    </article>
  );
}

/* --- Shared bits --------------------------------------------------------- */

/**
 * What a card shows when there is no cover.
 *
 * `.dirsearch-card-media` already fills with butter-2, so an empty cover only
 * needs something to look deliberate rather than broken. Every one of these
 * kinds has listings without a photo and always will — the fixtures carry one
 * of each so the layout gets reviewed in the state it most often ships in.
 */
function CoverFallback({ kind }: { kind: ExploreScope }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className="absolute inset-0 grid place-items-center">
      <Icon className="h-8 w-8 opacity-25" aria-hidden="true" />
    </span>
  );
}

/**
 * The empty state, parameterised by kind.
 *
 * Worth mocking because it is where the split pays off most visibly. "No
 * results" on today's unified directory can only offer to widen the scope,
 * which amounts to telling someone their question was the wrong shape. On a
 * page that knows it is about events, the fallback can be a *better event
 * question*: drop a filter, look further out, or host the thing yourself.
 */
export function ExploreEmpty({
  accent,
  title,
  lede,
  primary,
  secondary,
  suggestions,
}: {
  accent: string;
  title: string;
  lede: string;
  primary: string;
  secondary: string;
  suggestions: string[];
}) {
  return (
    <div className="dirsearch-empty">
      <SearchX aria-hidden="true" />
      <p className="dirsearch-empty-title">
        <em>{accent}</em> {title}
      </p>
      <p className="dirsearch-empty-lede">{lede}</p>
      <div className="dirsearch-empty-actions">
        <button type="button" className="dirsearch-empty-primary">
          {primary}
        </button>
        <span className="dirsearch-empty-or">or</span>
        <button type="button" className="dirsearch-empty-secondary">
          {secondary}
        </button>
      </div>
      <div className="dirsearch-empty-cats">
        {suggestions.map((suggestion) => (
          <button key={suggestion} type="button">
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

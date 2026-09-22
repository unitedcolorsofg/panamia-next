import Image from 'next/image';
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Store,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MOCK_DIRECTORY_SPOTLIGHT,
  MOCK_EVENTS,
  MOCK_SUGGESTIONS,
} from '../_data/mock-feed';

/* Modules injected between posts.
 *
 * The feed in production is a single column of statuses and nothing else,
 * which is why it collapses to a grey box the moment there is nothing to
 * show. These carry the surface on a slow day and, more importantly, give a
 * new account something to act on before it has followed anybody.
 *
 * All three are server components — nothing here has state. */

/** People to follow, each with the reason it is being suggested. */
export function SuggestionsModule() {
  return (
    <section className="feed-module" aria-labelledby="feed-module-panas">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="feed-module-panas" className="feed-module-title">
            Panas you might know
          </h2>
          <p className="text-pana-ink/60 mt-0.5 text-[13px] font-medium">
            A Pana is a mutual follow. Follow back and you both show up in each
            other&apos;s feed.
          </p>
        </div>
        <button
          type="button"
          className="text-pana-indigo hidden flex-none text-[12px] font-extrabold tracking-wider uppercase sm:block"
        >
          See all
        </button>
      </div>

      <div className="feed-strip">
        {MOCK_SUGGESTIONS.map((suggestion) => (
          <article
            key={suggestion.author.handle}
            className="profile-card flex flex-col p-4"
          >
            <div className="border-pana-ink/10 relative h-12 w-12 overflow-hidden rounded-full border-2">
              <Image
                src={suggestion.author.avatar}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>

            <h3 className="mt-2.5 text-[15px] leading-tight font-extrabold">
              {suggestion.author.name}
            </h3>
            <p className="text-pana-ink/45 text-[13px] font-bold">
              @{suggestion.author.handle}
            </p>
            <p className="text-pana-ink/70 mt-1.5 line-clamp-2 text-[13px] leading-snug font-medium">
              {suggestion.blurb}
            </p>

            <p className="card-flag mt-2.5 self-start">{suggestion.reason}</p>

            <Button
              size="sm"
              variant="outline"
              className="border-pana-indigo text-pana-indigo hover:bg-pana-indigo hover:text-pana-cream mt-3 rounded-full font-extrabold"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Follow
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

/** What is happening this week, with a real RSVP count on each card. */
export function EventsModule() {
  return (
    <section className="feed-module" aria-labelledby="feed-module-events">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="feed-module-events" className="feed-module-title">
            Happening this week
          </h2>
          <p className="text-pana-ink/60 mt-0.5 text-[13px] font-medium">
            Markets, workshops, and dinners near Little Haiti.
          </p>
        </div>
        <span className="coming-soon text-pana-indigo hidden flex-none sm:inline-flex">
          Coming soon
        </span>
      </div>

      <div className="feed-strip">
        {MOCK_EVENTS.map((event) => (
          <article key={event.id} className="profile-card overflow-hidden">
            <div className="media-frame aspect-[16/9] rounded-none">
              <Image
                src={event.image}
                alt={event.imageAlt}
                fill
                sizes="240px"
                className="object-cover"
              />
            </div>

            <div className="p-3.5">
              <p className="text-pana-burnt text-[11px] font-extrabold tracking-widest uppercase">
                {event.when}
              </p>
              <h3 className="mt-1 text-[15px] leading-tight font-extrabold">
                {event.title}
              </h3>
              <p className="text-pana-ink/60 mt-1 inline-flex items-center gap-1 text-[12px] font-bold">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {event.where} · {event.host}
              </p>
              <p className="text-pana-ink/45 mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {event.goingCount} Panas going
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* The one module that reaches across to the other half of the product. Pana
   Mia is a directory and a social network; a feed that never mentions a
   business is leaving the connection between them on the table. */
export function DirectoryModule() {
  const spotlight = MOCK_DIRECTORY_SPOTLIGHT;

  return (
    <section className="feed-module" aria-labelledby="feed-module-directory">
      <span className="section-eyebrow text-[11px]">From the directory</span>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="media-frame aspect-[4/3] w-full flex-none sm:w-44">
          <Image
            src={spotlight.image}
            alt={spotlight.imageAlt}
            fill
            sizes="(min-width: 640px) 11rem, 100vw"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h2 id="feed-module-directory" className="feed-module-title">
            {spotlight.name}
          </h2>
          <p className="text-pana-indigo mt-1 text-[12px] font-extrabold tracking-wide uppercase">
            {spotlight.fiveWords}
          </p>
          <p className="text-pana-ink/60 mt-1.5 inline-flex items-center gap-1 text-[13px] font-bold">
            <Store className="h-3.5 w-3.5" aria-hidden="true" />
            {spotlight.neighborhood}
          </p>

          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {spotlight.tags.map((tag) => (
              <li key={tag}>
                <span className="identity-pill text-pana-ink/65 text-[11px]">
                  #{tag}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="link-arrow text-pana-indigo mt-3.5 text-[13px]"
          >
            View listing
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Globe, Lock, Store, Users } from 'lucide-react';
import type { MockGroup } from '../../profile/_data/mock-profile';
import type { MockEvent, MockRecoList } from '../_data/mock-profile-next';

/* Cards for the content column.
 *
 * All three are one-per-row rather than a grid, which is the part of the feed
 * Jose pointed at. A grid asks you to scan; a column asks you to read. These
 * sections are short enough that reading them is the right ask, and it keeps
 * every section the same shape as the posts they sit beside.
 */

/* An event this person is hosting or attending.
 *
 * The date chip leads because the first question about an event is always
 * "when", and a left-edge chip is scannable down a column in a way a date
 * buried in a line of meta is not. */
export function EventCard({ event }: { event: MockEvent }) {
  return (
    <article
      className="profile-card p-4 data-[past=true]:opacity-65"
      data-past={event.past ? 'true' : undefined}
    >
      <div className="flex items-start gap-4">
        <div className="border-pana-ink/12 w-14 flex-none overflow-hidden rounded-xl border-2 text-center">
          <p className="bg-pana-indigo text-pana-cream py-0.5 text-[10px] font-black tracking-widest">
            {event.month}
          </p>
          <p className="pt-1 text-2xl leading-none font-black">{event.day}</p>
          <p className="text-pana-ink/55 pb-1.5 text-[10px] font-bold tracking-wider uppercase">
            {event.weekday}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="card-flag"
              data-tone={event.role === 'hosting' ? 'admin' : undefined}
            >
              {event.role === 'hosting' ? 'Hosting' : 'Going'}
            </span>
            {/* Shown to the owner and to mutuals only. The marker is on the
                card rather than in a settings screen because the person
                deciding what to make public is looking at this page. */}
            {event.visibility === 'panas' && (
              <span className="card-flag">
                <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                Panas only
              </span>
            )}
          </div>

          <h3 className="mt-1.5 text-[15px] leading-snug font-extrabold">
            <Link href={`/e/${event.slug}`} className="hover:underline">
              {event.title}
            </Link>
          </h3>

          <p className="text-pana-ink/70 mt-1 text-[13px] leading-snug font-medium">
            {event.time} · {event.venue}
          </p>

          <div className="text-pana-ink/50 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-bold">
            <span>{event.neighborhood}</span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {event.attending.toLocaleString('en-US')} going
            </span>
          </div>
        </div>

        <div className="border-pana-ink/10 relative hidden h-18 w-24 flex-none overflow-hidden rounded-xl border-2 sm:block">
          <Image
            src={event.image}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
          />
        </div>
      </div>
    </article>
  );
}

/* A group, laid out as a row instead of the old grid tile. The banner shrinks
   to a thumbnail because a group's picture identifies it but is not the
   reason you are reading the row — the blurb is. */
export function GroupRow({ group }: { group: MockGroup }) {
  return (
    <article className="profile-card p-4">
      <div className="flex items-start gap-4">
        <div className="border-pana-ink/10 relative h-18 w-18 flex-none overflow-hidden rounded-xl border-2">
          <Image
            src={group.image}
            alt=""
            fill
            sizes="72px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {group.role === 'admin' && (
              <span className="card-flag" data-tone="admin">
                Admin
              </span>
            )}
            <span className="card-flag">
              {group.privacy === 'open' ? (
                <Globe className="h-2.5 w-2.5" aria-hidden="true" />
              ) : (
                <Lock className="h-2.5 w-2.5" aria-hidden="true" />
              )}
              {group.privacy === 'open' ? 'Open' : 'Invite'}
            </span>
          </div>

          <h3 className="mt-1.5 text-[15px] leading-snug font-extrabold">
            {group.name}
          </h3>
          <p className="text-pana-ink/70 mt-1 text-[13px] leading-snug font-medium">
            {group.blurb}
          </p>
          <p className="text-pana-ink/50 mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {group.memberCount.toLocaleString('en-US')} members
          </p>
        </div>
      </div>
    </article>
  );
}

/* A named list of businesses this Pana vouches for.
 *
 * The card shows the list's own framing first and the places second, because
 * the framing is the part the directory cannot produce. Each entry carries the
 * Pana's note in their own voice, set against a rule so it never reads as
 * scraped copy from the listing.
 *
 * Every business links to /p/[handle]: a business listing IS a profile in this
 * schema, so a recommendation is a link between two profiles rather than a
 * bookmark pointing out of the product. */
export function RecoListCard({ list }: { list: MockRecoList }) {
  const remaining = list.total - list.businesses.length;

  return (
    <article className="profile-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[17px] leading-tight font-black tracking-tight">
            {list.title}
          </h3>
          <p className="text-pana-ink/70 mt-1 text-[13px] leading-snug font-medium">
            {list.blurb}
          </p>
        </div>
        <span className="card-flag flex-none">
          <Store className="h-2.5 w-2.5" aria-hidden="true" />
          {list.total}
        </span>
      </div>

      <ul className="border-pana-ink/10 mt-4 space-y-3.5 border-t pt-4">
        {list.businesses.map((business) => (
          <li key={business.id} className="flex items-start gap-3">
            <div className="border-pana-ink/10 relative h-14 w-14 flex-none overflow-hidden rounded-xl border-2">
              <Image
                src={business.image}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-tight font-extrabold">
                <Link
                  href={`/p/${business.handle}`}
                  className="hover:underline"
                >
                  {business.name}
                </Link>
              </p>
              <p className="text-pana-ink/50 mt-0.5 text-[12px] font-bold">
                {business.category} · {business.neighborhood}
              </p>
              <p className="border-pana-butter text-pana-ink/75 mt-1.5 border-l-2 pl-2.5 text-[13px] leading-snug font-medium">
                {business.note}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-pana-ink/10 mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span className="text-pana-ink/45 text-[12px] font-bold">
          {list.updated}
        </span>
        {remaining > 0 && (
          <Link
            href="/directory/search"
            className="link-arrow text-pana-indigo text-[13px] font-extrabold"
          >
            See all {list.total} places
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}

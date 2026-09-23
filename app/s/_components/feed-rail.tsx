'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePanas, useProfileGroups } from '@/lib/query/social';
import type { SocialActor } from '@/lib/schema';

/* Held-open space, same treatment as the mock: designed in now so the rail
   does not have to be re-laid-out when these land. Copy rather than data, so
   it lives here instead of being imported from the mock's fixtures — a
   production route should not depend on /mock. */
const RESERVED_MODULES: { title: string; description: string }[] = [
  {
    title: 'Events & RSVPs',
    description:
      'Markets, workshops, and dinners, with a real going and interested count.',
  },
  {
    title: 'Saved posts',
    description: 'Bookmarks that survive a scroll, grouped into named lists.',
  },
  {
    title: 'Jams',
    description: 'Live rooms a Pana can drop into straight from the timeline.',
  },
  {
    title: 'Trending & hashtags',
    description:
      'What your county is talking about right now, and a tag to follow it by.',
  },
];

/* The rail beside the timeline.
 *
 * Not navigation — SurfaceMemberHeader owns that on this surface. Everything
 * here is context for the column next to it, so it stacks underneath the feed
 * on narrow screens rather than collapsing into a drawer.
 *
 * Every number is fetched rather than asserted. The mock's third stat was
 * "Unread", which has no endpoint behind it; posts do, via the actor's own
 * statusCount, so that is the honest third column. The mock's "Trending in
 * Miami-Dade" module is not rendered as data for the same reason — there is
 * no hashtag or trending API, and a trending list is exactly the kind of
 * thing nobody would notice was invented. It is announced in "Coming to the
 * feed" instead, which promises it without fabricating counts.
 */
export function FeedRail({ actor }: { actor: SocialActor }) {
  /* Panas are mutual follows, which is its own endpoint rather than either
     follower count — following 400 people does not make 400 Panas. */
  const { data: panas } = usePanas(actor.username);
  const { data: groups } = useProfileGroups(actor.username);

  const displayName = actor.name || actor.username;
  const initials = actor.name
    ? actor.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : actor.username.slice(0, 2).toUpperCase();

  return (
    <aside className="feed-rail space-y-5">
      <section className="profile-card p-4">
        <Link href={`/p/${actor.username}`} className="flex items-center gap-3">
          <Avatar className="border-pana-ink/10 h-11 w-11 flex-none border-2">
            <AvatarImage src={actor.iconUrl || undefined} alt="" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[15px] leading-tight font-extrabold">
              {displayName}
            </p>
            <p className="text-pana-ink/45 truncate text-[13px] font-bold">
              @{actor.username}
            </p>
          </div>
        </Link>

        {/* Same stat rail the profile uses, so the two surfaces never disagree
            about how many Panas somebody has. */}
        <div className="stat-rail mt-3.5">
          <div className="stat-rail-item">
            <span className="stat-rail-value">
              {(panas?.count ?? 0).toLocaleString('en-US')}
            </span>
            <span className="stat-rail-label">Panas</span>
          </div>
          <div className="stat-rail-item">
            <span className="stat-rail-value">
              {groups?.groups.length ?? 0}
            </span>
            <span className="stat-rail-label">Groups</span>
          </div>
          <div className="stat-rail-item">
            <span className="stat-rail-value">
              {(actor.statusCount ?? 0).toLocaleString('en-US')}
            </span>
            <span className="stat-rail-label">Posts</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="rail-reserved">
        <h2 id="rail-reserved" className="rail-heading">
          Coming to the feed
        </h2>
        <div className="mt-2.5 space-y-2.5">
          {RESERVED_MODULES.map((module) => (
            <div key={module.title} className="reserved-slot p-3.5">
              <p className="reserved-slot-title inline-flex items-center gap-1.5 text-[14px]">
                <Sparkles
                  className="text-pana-indigo h-3.5 w-3.5"
                  aria-hidden="true"
                />
                {module.title}
              </p>
              <p className="text-pana-ink/65 text-[12px] leading-snug font-medium">
                {module.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-pana-ink/45 text-[12px] leading-snug font-bold">
        Pana Social is part of the Panaverse, sharing your Pana account with
        Pana Mia.{' '}
        <Link href="/directory/search" className="link-arrow text-pana-indigo">
          Browse the directory
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </p>
    </aside>
  );
}

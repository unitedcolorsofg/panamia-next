'use client';

import Image from 'next/image';
import { CalendarDays, Check, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MockGroupEvent, MockGroupMember } from '../_data/mock-group';

/* An event this group is hosting.
 *
 * Phase 4 of the roadmap, and the reason `events.host_profile_id` has to stop
 * being NOT NULL. Worth noticing what is *absent* from this card: there is no
 * host line. On a directory listing the host is the headline, because you are
 * deciding whether to trust a business. Here the host is the page you are
 * already on, so printing "Hosted by Miami Print & Zine Makers" on every card
 * would be noise. */
export function EventCard({ event }: { event: MockGroupEvent }) {
  return (
    <article className="profile-card overflow-hidden">
      <div className="relative aspect-[16/7]">
        <Image
          src={event.image}
          alt=""
          fill
          sizes="(min-width: 640px) 20rem, 100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent"
          aria-hidden="true"
        />
        {event.rsvped && (
          <span
            className="card-flag absolute right-3 bottom-3"
            data-tone="admin"
            data-on-media="true"
          >
            <Check className="h-3 w-3" aria-hidden="true" />
            Going
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-[15px] leading-snug font-extrabold">
          {event.title}
        </h3>

        <div className="text-pana-ink/60 mt-2 space-y-1 text-[13px] font-bold">
          <p className="flex items-center gap-1.5">
            <CalendarDays
              className="h-3.5 w-3.5 flex-none"
              aria-hidden="true"
            />
            {event.when}
          </p>
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
            {event.where}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-pana-ink/45 text-xs font-bold">
            {event.going} going · {event.interested} interested
          </p>
          <Button
            size="sm"
            variant={event.rsvped ? 'outline' : 'default'}
            className={
              event.rsvped
                ? 'border-pana-ink/20 rounded-full font-extrabold'
                : 'bg-pana-indigo text-pana-cream hover:bg-pana-indigo/90 rounded-full font-extrabold'
            }
          >
            {event.rsvped ? 'Going' : 'RSVP'}
          </Button>
        </div>
      </div>
    </article>
  );
}

/* One member in the roster.
 *
 * The role marker only appears for admins and moderators — plain membership
 * needs no badge, the same rule the profile's GroupCard already follows. */
export function MemberRow({ member }: { member: MockGroupMember }) {
  return (
    <article className="profile-card flex items-center gap-3 p-3.5">
      <span className="border-pana-ink/10 relative h-11 w-11 flex-none overflow-hidden rounded-full border-2">
        <Image
          src={member.avatar}
          alt=""
          fill
          sizes="44px"
          className="object-cover"
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-[14px] leading-tight font-extrabold">
            {member.name}
          </span>
          {member.role !== 'member' && (
            <span
              className="card-flag"
              data-tone={member.role === 'admin' ? 'admin' : undefined}
            >
              {member.role === 'admin' ? 'Admin' : 'Mod'}
            </span>
          )}
        </div>
        <p className="text-pana-ink/45 truncate text-[13px] font-bold">
          @{member.handle} · {member.joined}
        </p>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="border-pana-ink/20 flex-none rounded-full font-extrabold"
      >
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        Add Pana
      </Button>
    </article>
  );
}

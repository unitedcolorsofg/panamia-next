import Image from 'next/image';
import Link from 'next/link';
import { Users } from 'lucide-react';
import type { PanaSummary, ProfileGroupSummary } from '@/lib/query/social';

/* Someone this profile is Panas with. Everyone rendered through this card is
   a mutual follow by definition, so there is no per-card "Pana" badge: it
   would be on every card and would tell the viewer nothing. */
export function PanaCard({ pana }: { pana: PanaSummary }) {
  return (
    <Link
      href={`/p/${pana.username}`}
      className="profile-card flex items-start gap-3 p-4 transition-shadow hover:shadow-md"
    >
      <div className="border-pana-ink/10 bg-pana-butter relative h-14 w-14 flex-none overflow-hidden rounded-full border-2">
        {pana.iconUrl ? (
          <Image
            src={pana.iconUrl}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <span className="text-pana-ink flex h-full w-full items-center justify-center text-lg font-black">
            {(pana.name || pana.username).charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-extrabold">
          {pana.name || pana.username}
        </h3>
        <p className="profile-handle mt-0.5 text-[13px]">@{pana.username}</p>
        {pana.summary && (
          <p className="text-pana-ink/70 mt-1.5 line-clamp-2 text-[13px] leading-snug font-medium">
            {pana.summary}
          </p>
        )}
      </div>
    </Link>
  );
}

/* A group this person belongs to.
 *
 * There is no privacy flag on this card, unlike the design mock: only
 * discoverable groups ever reach it, so an "Open" marker would be on every
 * card and a "Private" one could never appear. */
export function GroupCard({ group }: { group: ProfileGroupSummary }) {
  return (
    <article className="profile-card overflow-hidden">
      <div className="bg-pana-indigo/10 relative aspect-[16/7]">
        {group.picture && (
          <>
            <Image
              src={group.picture}
              alt=""
              fill
              sizes="(min-width: 640px) 20rem, 100vw"
              className="object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent"
              aria-hidden="true"
            />
          </>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-[15px] font-extrabold">{group.name}</h3>
        {group.about && (
          <p className="text-pana-ink/70 mt-1 line-clamp-2 text-[13px] leading-snug font-medium">
            {group.about}
          </p>
        )}
        <p className="text-pana-ink/45 mt-2 inline-flex items-center gap-1.5 text-xs font-bold">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {group.memberCount.toLocaleString('en-US')} members
        </p>
      </div>
    </article>
  );
}

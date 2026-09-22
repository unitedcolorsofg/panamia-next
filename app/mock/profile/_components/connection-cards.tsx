import Image from 'next/image';
import { ArrowUpRight, Store } from 'lucide-react';
import type { MockBusiness, MockPana } from '../_data/mock-profile';

/* A person this profile follows back, or who follows them. "Pana" is the
   product word for both directions of a mutual follow, so the mutual flag is
   what the label hangs off — not the follow direction. */
export function PanaCard({ pana }: { pana: MockPana }) {
  return (
    <article className="profile-card flex items-start gap-3 p-4">
      <div className="border-pana-ink/10 relative h-14 w-14 flex-none overflow-hidden rounded-full border-2">
        <Image
          src={pana.avatar}
          alt=""
          fill
          sizes="56px"
          className="object-cover"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="truncate text-[15px] font-extrabold">{pana.name}</h3>
          {pana.mutual && <span className="card-flag">Pana</span>}
        </div>
        <p className="profile-handle mt-0.5 text-[13px]">@{pana.handle}</p>
        {pana.pronouns && (
          <p className="text-pana-ink/45 mt-0.5 text-xs font-bold">
            {pana.pronouns}
          </p>
        )}
        <p className="text-pana-ink/70 mt-1.5 text-[13px] leading-snug font-medium">
          {pana.blurb}
        </p>
      </div>
    </article>
  );
}

/* A directory listing this person follows. Visually distinct from a Pana card
   — square thumbnail, category line — because following a business is a
   different relationship than being someone's Pana. */
export function BusinessCard({ business }: { business: MockBusiness }) {
  return (
    <article className="profile-card flex items-center gap-3 p-4">
      <div className="border-pana-ink/10 relative h-14 w-14 flex-none overflow-hidden rounded-xl border-2 bg-white">
        <Image
          src={business.image}
          alt=""
          fill
          sizes="56px"
          className="p-1"
          /* vinext's Image hardcodes `object-fit: cover` inline when `fill` is
             set, which beats the utility class — so contain has to be passed
             as a style to keep these wide wordmarks from being cropped. */
          style={{ objectFit: 'contain' }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-extrabold">{business.name}</h3>
        <p className="text-pana-ink/55 mt-0.5 inline-flex items-center gap-1.5 text-xs font-bold">
          <Store className="h-3.5 w-3.5" aria-hidden="true" />
          {business.category}
        </p>
        <p className="text-pana-ink/45 mt-0.5 text-xs font-bold">
          {business.neighborhood}
        </p>
      </div>

      <ArrowUpRight
        className="text-pana-ink/30 h-5 w-5 flex-none"
        aria-hidden="true"
      />
    </article>
  );
}

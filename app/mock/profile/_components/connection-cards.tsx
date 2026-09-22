import Image from 'next/image';
import type { MockPana } from '../_data/mock-profile';

/* Someone this profile is Panas with. Everyone rendered through this card is
   a mutual follow by definition — see MOCK_PANAS — so there is no per-card
   "Pana" badge: it would be on every card and would tell the viewer nothing. */
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
        <h3 className="truncate text-[15px] font-extrabold">{pana.name}</h3>
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

import Image from 'next/image';
import { Globe, Lock, Users } from 'lucide-react';
import type { MockGroup, ReservedModule } from '../_data/mock-profile';

/* A group this person belongs to. The banner is the group's picture, and the
   role flag only appears for admins — plain membership needs no marker. */
export function GroupCard({ group }: { group: MockGroup }) {
  return (
    <article className="profile-card overflow-hidden">
      <div className="relative aspect-[16/7]">
        <Image
          src={group.image}
          alt=""
          fill
          sizes="(min-width: 640px) 20rem, 100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent"
          aria-hidden="true"
        />
        <div className="absolute right-3 bottom-3 left-3 flex flex-wrap items-center gap-2">
          {group.role === 'admin' && (
            <span className="card-flag" data-tone="admin" data-on-media="true">
              Admin
            </span>
          )}
          <span className="card-flag" data-on-media="true">
            {group.privacy === 'open' ? (
              <Globe className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Lock className="h-3 w-3" aria-hidden="true" />
            )}
            {group.privacy === 'open' ? 'Open' : 'Invite'}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-[15px] font-extrabold">{group.name}</h3>
        <p className="text-pana-ink/70 mt-1 text-[13px] leading-snug font-medium">
          {group.blurb}
        </p>
        <p className="text-pana-ink/45 mt-2 inline-flex items-center gap-1.5 text-xs font-bold">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {group.memberCount.toLocaleString('en-US')} members
        </p>
      </div>
    </article>
  );
}

/* Space held open for a module that has no backing feature yet. Sized like a
   real card so adding the feature later does not reflow the page. */
export function ReservedSlot({ module }: { module: ReservedModule }) {
  return (
    <div className="reserved-slot">
      <span className="coming-soon text-pana-indigo self-start">
        Coming soon
      </span>
      <h3 className="reserved-slot-title">{module.title}</h3>
      <p className="text-pana-ink/65 text-[13px] leading-snug font-medium">
        {module.description}
      </p>
    </div>
  );
}

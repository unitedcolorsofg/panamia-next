'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Shield } from 'lucide-react';
import type {
  MockGroup,
  MockGroupEvent,
  MockGroupMember,
  MockRelatedGroup,
  ViewerState,
} from '../_data/mock-group';
import { RESERVED_MODULES } from '../_data/mock-group';

interface GroupRailProps {
  group: MockGroup;
  members: MockGroupMember[];
  nextEvent?: MockGroupEvent;
  related: MockRelatedGroup[];
  viewer: ViewerState;
}

/* The right rail: who runs this, what the rules are, what is next, where else
 * to go.
 *
 * Mirrors app/s/_components/feed-rail.tsx so a pana moving between the feed
 * and a group does not have to relearn the page. The rail is the only part of
 * the layout a locked viewer still sees in full, which is intentional — the
 * whole argument for a private group is that you can tell what it is and who
 * runs it without being able to read it. Strip the rail too and the page
 * becomes a dead end that no one would ever ask to join. */
export function GroupRail({
  group,
  members,
  nextEvent,
  related,
  viewer,
}: GroupRailProps) {
  const admins = members.filter((member) => member.role !== 'member');

  return (
    <aside className="feed-rail space-y-6">
      <section>
        <h2 className="rail-heading">About</h2>
        <p className="text-pana-ink/75 mt-2.5 text-[14px] leading-relaxed font-medium">
          {group.summary}
        </p>
        <p className="text-pana-ink/45 mt-2 text-[13px] font-bold">
          {group.founded} ·{' '}
          {group.joinPolicy === 'open'
            ? 'Anyone can join'
            : group.joinPolicy === 'request'
              ? 'Admins approve requests'
              : 'Invite only'}
        </p>
      </section>

      {/* Rules have no column in the proposed schema yet. They are drawn here
          because leaving them out would have let the question go unasked, and
          a group with no stated rules is a moderation problem waiting to
          happen. See the note in _data/mock-group.ts. */}
      {group.rules.length > 0 && (
        <section>
          <h2 className="rail-heading">House rules</h2>
          <ol className="mt-2.5 space-y-2">
            {group.rules.map((rule, index) => (
              <li
                key={rule}
                className="text-pana-ink/75 flex gap-2.5 text-[13px] leading-snug font-medium"
              >
                <span className="text-pana-ink/35 flex-none font-extrabold">
                  {index + 1}.
                </span>
                {rule}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <h2 className="rail-heading inline-flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" aria-hidden="true" />
          Admins &amp; mods
        </h2>
        <ul className="mt-2.5 space-y-2.5">
          {admins.map((admin) => (
            <li key={admin.id} className="flex items-center gap-2.5">
              <span className="border-pana-ink/10 relative h-9 w-9 flex-none overflow-hidden rounded-full border-2">
                <Image
                  src={admin.avatar}
                  alt=""
                  fill
                  sizes="36px"
                  className="object-cover"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] leading-tight font-extrabold">
                  {admin.name}
                </span>
                <span className="text-pana-ink/45 block truncate text-[12px] font-bold">
                  {admin.role === 'admin' ? 'Admin' : 'Moderator'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* A locked viewer sees that something is happening and when, but not
          where. The address is the part that actually costs a tenant union
          something if it leaks. */}
      {nextEvent && (
        <section>
          <h2 className="rail-heading inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Next up
          </h2>
          <p className="mt-2.5 text-[14px] leading-snug font-extrabold">
            {nextEvent.title}
          </p>
          <p className="text-pana-ink/55 mt-1 text-[13px] font-bold">
            {nextEvent.when}
          </p>
          {viewer !== 'locked' && (
            <p className="text-pana-ink/45 text-[13px] font-bold">
              {nextEvent.where}
            </p>
          )}
        </section>
      )}

      {related.length > 0 && (
        <section>
          <h2 className="rail-heading">Related groups</h2>
          <ul className="mt-2.5 space-y-3">
            {related.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5">
                <span className="media-frame relative h-11 w-11 flex-none overflow-hidden">
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                </span>
                <span className="min-w-0">
                  <Link
                    href="/mock/group"
                    className="hover:text-pana-indigo block truncate text-[13px] leading-tight font-extrabold"
                  >
                    {item.name}
                  </Link>
                  <span className="text-pana-ink/45 block text-[12px] font-bold">
                    {item.memberCount.toLocaleString('en-US')} members ·{' '}
                    {item.reason}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        {RESERVED_MODULES.map((module) => (
          <div key={module.title} className="reserved-slot">
            <p className="reserved-slot-title">{module.title}</p>
            <p className="text-pana-ink/60 text-[13px] leading-snug font-medium">
              {module.description}
            </p>
          </div>
        ))}
      </section>

      <p className="text-pana-ink/45 text-[13px] font-bold">
        <Link href="/mock/feed" className="link-arrow">
          Back to the feed mock
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </p>
    </aside>
  );
}

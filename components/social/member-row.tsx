'use client';

/**
 * One member in a roster.
 *
 * Shared by the card on the group page and the full members page so the two
 * cannot drift -- they are the same row at two densities, and a member who
 * looked different depending on which list you found them in would read as
 * two different states rather than one person.
 *
 * Follows app/mock/group's MemberRow, including its restraint about badges:
 * the role marker appears only for admins and moderators. Plain membership
 * needs no badge, the same rule GroupCard already follows on the profile.
 *
 * `action` is a slot rather than a prop set because phase 9 hangs the
 * management controls here -- promote, remove, approve -- and those need to
 * vary per surface. The row should not grow a boolean for each one.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { GroupMemberSummary } from '@/lib/query/social';

/**
 * "Joined March 2025", or nothing at all.
 *
 * Active rows always carry a joinedAt, so null here means a row written
 * before the column was being set. Rendering "Joined Invalid Date" for those
 * is worse than rendering only the handle.
 */
function joinedLabel(joinedAt: string | null): string | null {
  if (!joinedAt) return null;
  const date = new Date(joinedAt);
  if (Number.isNaN(date.getTime())) return null;
  return `Joined ${date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })}`;
}

export function MemberRow({
  member,
  action,
}: {
  member: GroupMemberSummary;
  action?: ReactNode;
}) {
  const joined = joinedLabel(member.joinedAt);

  return (
    <article className="border-pana-ink/10 flex items-center gap-3 rounded-xl border p-3">
      {/* Plain img rather than next/image: avatars are remote CDN URLs and
          next.config.js declares no remotePatterns, so the optimizer would
          reject them at runtime. Same reason as the group cover. */}
      <span className="border-pana-ink/10 relative h-11 w-11 flex-none overflow-hidden rounded-full border-2">
        <img
          src={member.iconUrl || '/img/bg_coconut_blue.jpg'}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link
            href={`/p/${member.handle}`}
            className="text-pana-ink hover:text-pana-ink/70 truncate text-[14px] leading-tight font-extrabold"
          >
            {member.name}
          </Link>
          {member.role !== 'member' && (
            <span
              className="text-pana-ink/60 border-pana-ink/15 rounded-full border px-2 py-0.5 text-[11px] font-bold"
              data-tone={member.role === 'admin' ? 'admin' : undefined}
            >
              {member.role === 'admin' ? 'Admin' : 'Mod'}
            </span>
          )}
        </div>
        <p className="text-pana-ink/45 truncate text-[13px] font-bold">
          @{member.handle}
          {joined ? ` · ${joined}` : ''}
        </p>
      </div>

      {action && <div className="flex-none">{action}</div>}
    </article>
  );
}

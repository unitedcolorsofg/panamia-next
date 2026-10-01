'use client';

/**
 * The full roster for a group.
 *
 * Pages with an explicit "Load more" rather than an infinite scroll. A roster
 * is a list people arrive at looking for one particular person, and infinite
 * scroll takes the end of the list away from them -- there is no way to tell
 * whether you have seen everyone.
 *
 * The locked state here is the same decision the group page makes: a private
 * group shows a stranger its admins and nothing else, because the only thing
 * they can do is ask one of them to be let in.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MemberRow } from '@/components/social/member-row';
import {
  useGroup,
  useGroupMembers,
  ROSTER_PAGE_SIZE,
  type GroupMemberSummary,
} from '@/lib/query/social';

export function GroupMembersView({ handle }: { handle: string }) {
  /* Pages are accumulated here rather than refetched as one growing request,
     so "Load more" costs one page instead of re-reading everything above it. */
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState<GroupMemberSummary[]>([]);

  const { data: detail } = useGroup(handle);
  const { data, isLoading } = useGroupMembers(handle, {
    limit: ROSTER_PAGE_SIZE,
    offset,
  });

  const name = detail?.actor.name || `@${handle}`;

  /* The first page is whatever the query holds; later pages are what has been
     accumulated plus it. Keyed by id on render, so a page arriving twice
     cannot duplicate a row. */
  const members =
    offset === 0
      ? (data?.members ?? [])
      : [...loaded, ...(data?.members ?? [])];
  const seen = new Map(members.map((member) => [member.id, member]));
  const roster = [...seen.values()];

  const canRead = data?.canRead ?? true;
  const leaders = data?.leaders ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.nextOffset !== null && data?.nextOffset !== undefined;

  return (
    <main className="surface-cream min-h-screen pb-20">
      <div className="container mx-auto max-w-3xl px-4 pt-10">
        <Link
          href={`/g/${handle}`}
          className="text-pana-ink/60 hover:text-pana-ink inline-flex items-center gap-1.5 text-[13px] font-bold"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to {name}
        </Link>

        <h1 className="text-pana-ink mt-4 text-2xl font-black">Members</h1>
        <p className="text-pana-ink/60 mt-1 inline-flex items-center gap-1.5 text-[14px] font-bold">
          <Users className="h-4 w-4" aria-hidden="true" />
          {total.toLocaleString('en-US')}
          {total === 1 ? ' member' : ' members'}
        </p>

        {!canRead ? (
          <div className="mt-6 space-y-4">
            <div className="border-pana-ink/15 flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center">
              <Lock className="text-pana-ink/35 h-7 w-7" aria-hidden="true" />
              <h2 className="text-pana-ink mt-3 text-[17px] font-extrabold">
                This group is private
              </h2>
              <p className="text-pana-ink/65 mt-1.5 max-w-sm text-[14px] leading-snug font-medium">
                The member list is for members. You can still ask to join.
              </p>
            </div>

            {leaders.length > 0 && (
              <section className="border-pana-ink/10 rounded-2xl border bg-white p-5">
                <h2 className="text-pana-ink inline-flex items-center gap-1.5 text-[15px] font-extrabold">
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  Admins and mods
                </h2>
                <p className="text-pana-ink/55 mt-1 text-[13px] font-medium">
                  The people who can let you in.
                </p>
                <div className="mt-3 space-y-2">
                  {leaders.map((leader) => (
                    <MemberRow key={leader.id} member={leader} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {isLoading && roster.length === 0 ? (
              <RosterSkeleton />
            ) : roster.length === 0 ? (
              /* A group always has a founder, so this is drifted data or a
                 failed request rather than an empty group. Say so plainly
                 instead of leaving the page blank. */
              <p className="border-pana-ink/15 text-pana-ink/60 rounded-2xl border border-dashed px-6 py-12 text-center text-[14px] font-medium">
                We couldn&apos;t load this group&apos;s members.
              </p>
            ) : (
              roster.map((member) => (
                <MemberRow key={member.id} member={member} />
              ))
            )}

            {hasMore && (
              <div className="pt-3">
                <Button
                  variant="outline"
                  className="w-full font-extrabold"
                  disabled={isLoading}
                  onClick={() => {
                    setLoaded(roster);
                    setOffset(data?.nextOffset ?? 0);
                  }}
                >
                  {isLoading ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function RosterSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((row) => (
        <div
          key={row}
          className="border-pana-ink/10 flex items-center gap-3 rounded-xl border p-3"
        >
          <div className="bg-pana-ink/10 h-11 w-11 flex-none animate-pulse rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="bg-pana-ink/10 h-3.5 w-40 animate-pulse rounded" />
            <div className="bg-pana-ink/10 h-3 w-24 animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

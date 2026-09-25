'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, Plus, Search, Users } from 'lucide-react';
import SurfaceLink from '@/components/panaverse/SurfaceLink';
import { useSession } from '@/lib/auth-client';
import { useGroupSearch, useMyGroups } from '@/lib/query/social';
import type { MyGroupSummary } from '@/lib/query/social';
import { GroupResultCard } from '@/app/search/_components/group-result-card';

/**
 * The body of /groups.
 *
 * Two sections in a deliberate order: the member's own groups, then everything
 * else. Somebody opening this page is far more often going back somewhere than
 * looking for somewhere new, and their own list is the one thing no search box
 * can produce.
 */
export function GroupsContent() {
  const searchParams = useSearchParams();
  const term = (searchParams?.get('q') ?? '').trim();

  const { data: session, status } = useSession();
  const signedIn = status !== 'loading' && !!session;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-pana-ink text-2xl font-extrabold">Groups</h1>
          <p className="text-pana-ink/65 mt-0.5 text-[14px] font-medium">
            Find your people, or start something nobody has started yet.
          </p>
        </div>

        {/* Shown to signed-out visitors too, rather than hidden. The page it
            leads to explains what is needed; a button that simply is not
            there reads as the feature not existing. */}
        <Link
          href="/groups/new"
          className="bg-pana-ink inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-extrabold text-white"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Start a group
        </Link>
      </header>

      {/* Split so the hook never runs for a signed-out visitor, who would get
          a 401 and nothing to show for it. Same shape as PanaResultsList on
          the search page. */}
      {signedIn && <YourGroups />}

      <section className="space-y-4">
        <h2 className="text-pana-ink text-[17px] font-extrabold">
          {term ? `Groups matching "${term}"` : 'Browse groups'}
        </h2>

        <BrowseField term={term} />
        <BrowseResults term={term} />
      </section>
    </div>
  );
}

/**
 * The member's own groups, private ones included.
 *
 * Renders nothing at all when they are in none -- the browse section below is
 * already the answer to an empty shelf, and an empty-state card here would
 * push it down the page to say the same thing twice.
 */
function YourGroups() {
  const { data, isLoading } = useMyGroups();
  const groups = data?.groups ?? [];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3" aria-hidden="true">
        <div className="bg-pana-ink/10 h-6 w-32 rounded-lg" />
        <div className="bg-pana-ink/10 h-20 rounded-2xl" />
      </div>
    );
  }

  if (groups.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-pana-ink text-[17px] font-extrabold">
        Your groups
        <span className="text-pana-ink/45 ml-1.5 text-[14px] font-bold">
          {groups.length}
        </span>
      </h2>

      <div className="space-y-3">
        {groups.map((group) => (
          <MyGroupCard key={group.id} group={group} />
        ))}
      </div>
    </section>
  );
}

/**
 * One of the member's own groups.
 *
 * Separate from GroupResultCard because this list can say things search
 * results cannot: the reader's role, and that a private group is one they are
 * actually inside rather than one they might ask to join.
 */
function MyGroupCard({ group }: { group: MyGroupSummary }) {
  const isPrivate = group.visibility === 'private';
  const runsIt = group.role === 'admin' || group.role === 'moderator';

  return (
    <SurfaceLink
      href={`/g/${group.handle}`}
      className="border-pana-ink/10 hover:border-pana-ink/25 flex items-center gap-3 rounded-2xl border bg-white p-4 transition-colors"
    >
      {/* Plain img for the same reason every other card here uses one: these
          are remote CDN URLs and next.config.js declares no remotePatterns. */}
      <img
        src={group.iconUrl || '/img/bg_coconut_blue.jpg'}
        alt=""
        aria-hidden="true"
        className="h-12 w-12 shrink-0 rounded-xl object-cover"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-pana-ink truncate text-[15px] font-extrabold">
            {group.name}
          </span>
          {isPrivate && (
            <Lock
              className="text-pana-ink/45 h-3 w-3 shrink-0"
              aria-label="Private group"
            />
          )}
        </div>

        <div className="text-pana-ink/55 mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] font-bold">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {group.memberCount}
            {group.memberCount === 1 ? ' member' : ' members'}
          </span>
          {runsIt && (
            <span className="bg-pana-indigo/10 text-pana-indigo rounded-full px-2 py-0.5 capitalize">
              {group.role}
            </span>
          )}
        </div>
      </div>
    </SurfaceLink>
  );
}

/**
 * Browse field. A plain GET form for the same reason the search page's is --
 * it works before the bundle lands, and the result is a shareable URL.
 */
function BrowseField({ term }: { term: string }) {
  return (
    <form role="search" action="/groups" method="get" className="flex gap-2">
      <label htmlFor="group-browse-input" className="sr-only">
        Search groups
      </label>
      <div className="relative flex-1">
        <Search
          className="text-pana-ink/40 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          id="group-browse-input"
          type="search"
          name="q"
          defaultValue={term}
          placeholder="Search by name, topic or description"
          autoComplete="off"
          className="border-pana-ink/12 focus:border-pana-orange/55 focus:ring-pana-orange/18 w-full rounded-full border bg-white py-2 pr-4 pl-9 text-sm font-medium focus:ring-2 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="bg-pana-ink rounded-full px-5 text-sm font-extrabold text-white"
      >
        Search
      </button>
    </form>
  );
}

function BrowseResults({ term }: { term: string }) {
  const { data, isLoading, isError } = useGroupSearch(term);
  const groups = data?.groups ?? [];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3" aria-hidden="true">
        <div className="bg-pana-ink/10 h-20 rounded-2xl" />
        <div className="bg-pana-ink/10 h-20 rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <Note
        title="Group search is not answering"
        body="That is on us, not on your search. Try again in a moment."
      />
    );
  }

  if (groups.length === 0) {
    return term ? (
      <Note
        title={`No groups match "${term}"`}
        body="Group search covers names, topics and descriptions, and already tries near-misses before giving up. Nothing here yet means nobody has started this one."
      />
    ) : (
      <Note
        title="No groups yet"
        body="Nobody has started a group on Pana Social. The first one is yours to make."
      />
    );
  }

  return (
    <div className="space-y-3">
      {!term && (
        <p className="feed-context">Groups with the most members right now</p>
      )}
      {groups.map((group) => (
        <GroupResultCard key={group.id} group={group} />
      ))}
    </div>
  );
}

/* Solid rather than the dashed `.reserved-slot`, which means "content is
   coming here later" and would read as the feature being unfinished. */
function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-pana-ink/10 space-y-1.5 rounded-2xl border bg-white p-6">
      <p className="text-pana-ink text-[15px] font-extrabold">{title}</p>
      <p className="text-pana-ink/65 text-[13px] leading-snug font-medium">
        {body}
      </p>
    </div>
  );
}

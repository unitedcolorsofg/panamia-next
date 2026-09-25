import Link from 'next/link';
import { auth } from '@/auth';
import { DirectorySuggest } from '@/components/directory-suggest';
import { ScopeChips, ScopeMenu } from '@/components/directory-scope-bar';
import { KIND_ICON } from '@/components/kind-icon';
import {
  countFor,
  SCOPE_LABEL,
  SCOPE_REQUIRES_PANA,
  scopePath,
  totalCount,
  type Scope,
} from '@/lib/directory-scopes';
import {
  countAllScopes,
  searchBusinesses,
  searchEvents,
  searchGroups,
  searchPanas,
  SCOPE_PAGE_SIZE,
  type ScopeSearchResult,
} from '@/lib/server/search-kinds';
import type { SuggestionKind } from '@/lib/suggest';
import { ScopeResultCard } from './scope-result-card';

/** How many of each kind the Everything scope previews before "see all". */
const PREVIEW_LIMIT = 4;

/**
 * The results page for every scope except businesses.
 *
 * Businesses keep /directory/search and its own component tree — the map, the
 * county and category facets, distance sorting. None of that applies here, and
 * bending this page into a shape that could also serve businesses would mean
 * reimplementing all of it worse.
 *
 * Access is decided here rather than in the search functions. `searchPanas`
 * and `searchGroups` document that they are signed-in only and treat an
 * anonymous caller as a caller bug; this is the caller that establishes it,
 * and it redirects rather than degrading, because a members-only scope that
 * quietly returns nothing looks like a broken search instead of a closed door.
 */
export async function ScopePage({
  scope,
  term,
  page,
}: {
  scope: Scope;
  term: string;
  page: number;
}) {
  let signedIn = false;
  try {
    const session = await auth();
    signedIn = Boolean(session?.user?.id);
  } catch (error) {
    // Same stance as the suggest route: a failed session read falls to the
    // anonymous set. The public half of the answer is still correct.
    console.error('Directory scope session error:', error);
  }

  const counts = await countAllScopes(term, signedIn);

  if (SCOPE_REQUIRES_PANA[scope] && !signedIn) {
    return <GatedScope scope={scope} term={term} />;
  }

  return (
    <main className="dirscope">
      <SearchBand scope={scope} term={term} counts={counts} signedIn={signedIn} />
      <ScopeChips scope={scope} term={term} counts={counts} signedIn={signedIn} />

      <div className="container mx-auto px-4 py-8">
        {scope === 'all' ? (
          <EverythingResults term={term} signedIn={signedIn} counts={counts} />
        ) : (
          <SingleScopeResults scope={scope} term={term} page={page} />
        )}
      </div>
    </main>
  );
}

function SearchBand({
  scope,
  term,
  counts,
  signedIn,
}: {
  scope: Scope;
  term: string;
  counts: Awaited<ReturnType<typeof countAllScopes>>;
  signedIn: boolean;
}) {
  const total = totalCount(counts);
  const scoped = countFor(counts, scope);

  return (
    <section className="surface-indigo dirsearch-band">
      <div className="container mx-auto px-4">
        <span className="section-eyebrow">Directory</span>

        <h1 className="dirsearch-title">
          {term ? (
            <>
              <em>{term}</em>
              {scope === 'all' ? (
                <> in South Florida</>
              ) : (
                <> — {SCOPE_LABEL[scope].toLowerCase()}</>
              )}
            </>
          ) : (
            <>Find your people</>
          )}
        </h1>

        <p className="dirsearch-count">
          {!term ? (
            <>Search businesses, panas, groups and events</>
          ) : total === 0 ? (
            <>No matches yet — try a broader search</>
          ) : scope === 'all' ? (
            <>
              <strong>{total}</strong>
              {total === 1 ? ' result' : ' results'} across businesses, panas,
              groups and events
            </>
          ) : (
            <>
              <strong>{scoped}</strong>
              {' of '}
              {total} {total === 1 ? 'result' : 'results'} are{' '}
              {SCOPE_LABEL[scope].toLowerCase()}
            </>
          )}
        </p>

        {/* The scope control sits inside the pill rather than beside it,
            because scope is part of the question being asked — "panas named
            Maria" is one query, not a query plus a page setting. */}
        <div className="dirsearch-searchrow">
          <DirectorySuggest
            layout="pill"
            scope={scope}
            initialTerm={term}
            label="Search the Pana Mia directory"
            ariaLabel="Search the Pana Mia directory"
            placeholder="Try art, croqueta, zine, Maria…"
            buttonLabel="Search"
            leading={
              <ScopeMenu
                scope={scope}
                term={term}
                counts={counts}
                signedIn={signedIn}
              />
            }
          />
        </div>
      </div>
    </section>
  );
}

/**
 * The Everything scope: a few of each kind, each with a way deeper in.
 *
 * Four short lists rather than one merged and re-ranked list. Cross-kind
 * relevance is not a comparison anyone can make honestly — there is no answer
 * to whether a café matching "art" beats a group matching it — and a merged
 * list would have to invent one. Grouping states the truth instead: here is
 * what matched, by kind, and here is where to see the rest.
 */
async function EverythingResults({
  term,
  signedIn,
  counts,
}: {
  term: string;
  signedIn: boolean;
  counts: Awaited<ReturnType<typeof countAllScopes>>;
}) {
  if (!term) return <EmptyPrompt />;

  const [businesses, panas, groups, events] = await Promise.all([
    searchBusinesses(term, 1, PREVIEW_LIMIT),
    signedIn ? searchPanas(term, 1, PREVIEW_LIMIT) : null,
    signedIn ? searchGroups(term, 1, PREVIEW_LIMIT) : null,
    searchEvents(term, 1, PREVIEW_LIMIT),
  ]);

  if (totalCount(counts) === 0) return <NoMatches term={term} />;

  return (
    <div className="flex flex-col gap-10">
      <KindSection kind="business" term={term} data={businesses} />
      {panas && <KindSection kind="pana" term={term} data={panas} />}
      {groups && <KindSection kind="group" term={term} data={groups} />}
      <KindSection kind="event" term={term} data={events} />
    </div>
  );
}

function KindSection({
  kind,
  term,
  data,
}: {
  kind: SuggestionKind;
  term: string;
  data: ScopeSearchResult;
}) {
  if (data.total === 0) return null;

  const Icon = KIND_ICON[kind];
  const shown = data.results.length;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-tight">
          <Icon className="h-5 w-5 shrink-0 opacity-60" aria-hidden="true" />
          {SCOPE_LABEL[kind]}
        </h2>
        <span className="dirsearch-card-active">
          {shown === data.total ? `${data.total}` : `${shown} of ${data.total}`}
        </span>
        {shown < data.total && (
          <Link
            href={scopePath(kind, term)}
            className="ml-auto text-sm font-black underline underline-offset-4"
          >
            See all {data.total}
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.results.map((result) => (
          <ScopeResultCard key={result.id} result={result} kind={kind} />
        ))}
      </div>
    </section>
  );
}

async function SingleScopeResults({
  scope,
  term,
  page,
}: {
  scope: Exclude<Scope, 'all'>;
  term: string;
  page: number;
}) {
  if (!term) return <EmptyPrompt />;

  const data = await runScope(scope, term, page);
  if (data.total === 0) return <NoMatches term={term} />;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.results.map((result) => (
          <ScopeResultCard key={result.id} result={result} kind={scope} />
        ))}
      </div>

      {data.totalPages > 1 && (
        <nav
          className="mt-8 flex items-center justify-center gap-4"
          aria-label="Pagination"
        >
          {data.page > 1 && (
            <Link
              href={`${scopePath(scope, term)}?p=${data.page - 1}`}
              className="dirsearch-chip"
            >
              Previous
            </Link>
          )}
          <span className="text-sm font-bold">
            Page {data.page} of {data.totalPages}
          </span>
          {data.page < data.totalPages && (
            <Link
              href={`${scopePath(scope, term)}?p=${data.page + 1}`}
              className="dirsearch-chip"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

function runScope(
  scope: Exclude<Scope, 'all'>,
  term: string,
  page: number
): Promise<ScopeSearchResult> {
  switch (scope) {
    case 'business':
      return searchBusinesses(term, page, SCOPE_PAGE_SIZE);
    case 'pana':
      return searchPanas(term, page, SCOPE_PAGE_SIZE);
    case 'group':
      return searchGroups(term, page, SCOPE_PAGE_SIZE);
    case 'event':
      return searchEvents(term, page, SCOPE_PAGE_SIZE);
  }
}

function EmptyPrompt() {
  return (
    <p className="text-pana-ink/60 py-12 text-center text-lg font-bold">
      Type something to search.
    </p>
  );
}

function NoMatches({ term }: { term: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-lg font-black">Nothing matched “{term}”.</p>
      <p className="text-pana-ink/60 mt-2 font-bold">
        Try fewer words, or switch scope above.
      </p>
    </div>
  );
}

/**
 * What an anonymous visitor sees at /directory/panas.
 *
 * A sign-in prompt rather than a 404 or an empty list. The page exists and is
 * worth wanting; what is missing is standing to see it, and saying so is the
 * only version of this that reads as a door rather than a bug. It states no
 * counts — the count itself leaks how many members match a name, which is why
 * countAllScopes returns zero for these scopes to anonymous callers.
 */
function GatedScope({ scope, term }: { scope: Scope; term: string }) {
  return (
    <main className="dirscope">
      <section className="surface-indigo dirsearch-band">
        <div className="container mx-auto px-4">
          <span className="section-eyebrow">Directory</span>
          <h1 className="dirsearch-title">{SCOPE_LABEL[scope]} are for panas</h1>
          <p className="dirsearch-count">
            Members search each other, not the public. Sign in to look up{' '}
            {SCOPE_LABEL[scope].toLowerCase()}.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {/* Plain `/signin`, no return path: sign-in is shared by the whole
                panaverse and lands the member in their surface's root, taking no
                return-path parameter. A `?next=` here would be decoration. */}
            <Link href="/signin" className="dirsearch-chip">
              Sign in
            </Link>
            <Link href={scopePath('business', term)} className="dirsearch-chip">
              Search businesses instead
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

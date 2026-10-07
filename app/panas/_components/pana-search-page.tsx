import Link from 'next/link';
import { Suspense } from 'react';
import { auth } from '@/auth';
import { DirectorySuggest } from '@/components/directory-suggest';
import { ScopeMenuLive } from '@/components/scope-menu-live';
import { countFor, totalCount, scopePath } from '@/lib/directory-scopes';
import {
  countAllScopes,
  searchKindSafely,
  SCOPE_PAGE_SIZE,
} from '@/lib/server/search-kinds';
import { ScopeResultCard } from './scope-result-card';

/** Cards in the loading skeleton. Matches the first row of a filled grid. */
const SKELETON_CARDS = 8;

/**
 * Member search: the only one of the four scopes that is not public.
 *
 * This was `/directory/panas`, one of four spellings of a shared scope page,
 * back when the directory was the club's single index and "panas" was a filter
 * over it. The directory now means listings — shops, bands, co-ops,
 * non-profits — so a page listing people stopped belonging under that word,
 * and this is where it moved.
 *
 * What came with it is the shape: an indigo band with the term as a headline,
 * the scope menu inside the search pill, a grid of cards. That is deliberate.
 * The four kinds are four products now, but a member who searches "Maria" here
 * and "cumbia" in the directory should not feel they have changed websites,
 * and the band is the thing doing that work.
 *
 * Access is decided here rather than in the search functions. `searchPanas`
 * documents that it is signed-in only and treats an anonymous caller as a
 * caller bug; this is the caller that establishes it. The gate is checked
 * before any counting, so a signed-out visitor costs the database nothing and
 * no count of matching members is computed in a request that must not reveal
 * one.
 */
export async function PanaSearchPage({
  term,
  page,
}: {
  term: string;
  page: number;
}) {
  let signedIn = false;
  try {
    const session = await auth();
    signedIn = Boolean(session?.user?.id);
  } catch (error) {
    // Same stance as the suggest route: a failed session read falls to the
    // anonymous set. Here that means the door, which is the safe direction.
    console.error('Pana search session error:', error);
  }

  if (!signedIn) return <GatedPanas term={term} />;

  return (
    <main className="dirscope">
      <SearchBand term={term} />

      <div className="container mx-auto px-4 py-8">
        {/* The results are a second wave of database work. Without a boundary
            here, none of the page — not the title, not the search box — is
            flushed until the search finishes, because a suspending child holds
            up the whole payload. With one, the shell goes out immediately and
            the grid streams in behind it.

            Keyed so a new term swaps back to the skeleton instead of leaving
            the previous term's results under a heading that already changed. */}
        <Suspense key={`pana:${term}:${page}`} fallback={<ResultsSkeleton />}>
          <PanaResults term={term} page={page} />
        </Suspense>
      </div>
    </main>
  );
}

function SearchBand({ term }: { term: string }) {
  return (
    <section className="dirsearch-band">
      <div className="container mx-auto px-4">
        <span className="section-eyebrow">Panas</span>

        <h1 className="dirsearch-title">
          {term ? (
            <>
              <em>{term}</em> — panas
            </>
          ) : (
            <>Find your panas</>
          )}
        </h1>

        {/* Suspended rather than awaited by the page above, so the heading and
            the search box are on screen while the counting happens. */}
        <p className="dirsearch-count" role="status" aria-live="polite">
          {!term ? (
            <>Search members by name, craft or handle</>
          ) : (
            <Suspense key={`count:${term}`} fallback={<>Searching…</>}>
              <PanaMatchCount term={term} />
            </Suspense>
          )}
        </p>

        {/* The scope control sits inside the pill rather than beside it,
            because scope is part of the question being asked — "panas named
            Maria" is one query, not a query plus a page setting. In link mode:
            each row is a real route now, and carrying the typed term across to
            it is most of why the menu is worth having here. */}
        <div className="dirsearch-searchrow">
          <DirectorySuggest
            layout="pill"
            scope="pana"
            initialTerm={term}
            label="Search panas"
            ariaLabel="Search panas"
            placeholder="Name, craft or @handle…"
            buttonLabel="Search"
            leading={<ScopeMenuLive scope="pana" term={term} />}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * How many panas matched, and how much is waiting in the other three scopes.
 *
 * Four counts for a page that shows one kind, because the menu in the pill
 * carries a number per scope: someone searching "cumbia" and finding two panas
 * is told, in the same control, that there are eleven events.
 *
 * Only ever rendered past the gate above, so the signed-in argument is a fact
 * rather than a re-check — a signed-out request never reaches this component
 * and so never computes a count of matching members.
 */
async function PanaMatchCount({ term }: { term: string }) {
  let counts;
  try {
    counts = (await countAllScopes(term, true)).counts;
  } catch (error) {
    // The grid below runs its own query and says its own piece if that fails.
    // A count that cannot be computed is better left unsaid than guessed at.
    console.error('Pana search count error:', error);
    return null;
  }

  const total = totalCount(counts);
  const scoped = countFor(counts, 'pana');

  if (scoped === 0) return <>No panas matched yet — try fewer words</>;

  return (
    <>
      <strong>{scoped}</strong>
      {scoped === 1 ? ' pana' : ' panas'}
      {/* Only mention the rest of the club when there is a rest to mention.
          "2 panas, of 2 results club-wide" is noise. */}
      {total > scoped && <> · {total - scoped} more elsewhere</>}
    </>
  );
}

/**
 * What stands in for the results while the query runs.
 *
 * Shaped like the thing it is replacing — a grid of cards — rather than a
 * spinner, so the page does not change height and shove the search box up the
 * screen the moment the real rows land.
 */
function ResultsSkeleton() {
  return (
    <>
      {/* One live region for the whole block. The pulsing boxes are decoration
          and are hidden, because a screen reader announcing eight empty cards
          is worse than it announcing nothing. */}
      <p role="status" className="sr-only">
        Loading panas
      </p>

      <div className="dirsearch-grid" aria-hidden="true">
        {Array.from({ length: SKELETON_CARDS }).map((_, card) => (
          <div
            key={card}
            className="bg-pana-ink/[0.06] h-48 animate-pulse rounded-xl"
          />
        ))}
      </div>
    </>
  );
}

async function PanaResults({ term, page }: { term: string; page: number }) {
  if (!term) return <EmptyPrompt />;

  const data = await searchKindSafely('pana', term, page, SCOPE_PAGE_SIZE);

  // The one kind this page is about is the one that is down. There is no
  // partial answer to give, so say that rather than "nothing matched" — which
  // would read as a fact about the club instead of about our database.
  if (data === null) return <SearchUnavailable />;
  if (data.total === 0) return <NoMatches term={term} />;

  return (
    <>
      <div className="dirsearch-grid">
        {data.results.map((result) => (
          <ScopeResultCard key={result.id} result={result} kind="pana" />
        ))}
      </div>

      {data.totalPages > 1 && (
        <nav
          className="mt-8 flex items-center justify-center gap-4"
          aria-label="Pagination"
        >
          {data.page > 1 && (
            <Link
              href={`${scopePath('pana', term)}&p=${data.page - 1}`}
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
              href={`${scopePath('pana', term)}&p=${data.page + 1}`}
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

/**
 * Says the search could not run, and does not pretend silence is an answer.
 *
 * Phrased as a temporary outage rather than as an empty result, because those
 * are different facts and only one of them is true. A visitor told "no panas
 * matched" would stop looking; one told the search is down knows to come back.
 */
function SearchUnavailable() {
  return (
    <p
      role="status"
      className="border-pana-ink/15 bg-pana-ink/[0.03] rounded-xl border px-4 py-3 text-sm font-bold"
    >
      Pana search is temporarily unavailable. Please try again shortly.
    </p>
  );
}

function EmptyPrompt() {
  return (
    <p className="text-pana-ink/60 py-12 text-center text-lg font-bold">
      Type a name, a craft or a handle to search.
    </p>
  );
}

function NoMatches({ term }: { term: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-lg font-black">No panas matched “{term}”.</p>
      <p className="text-pana-ink/60 mt-2 font-bold">
        Try fewer words, or search the directory for their work instead.
      </p>
      <Link
        href={scopePath('directory', term)}
        className="dirsearch-chip mt-4 inline-flex"
      >
        Search the directory for “{term}”
      </Link>
    </div>
  );
}

/**
 * What an anonymous visitor sees at /panas.
 *
 * A sign-in prompt rather than a 404 or an empty list. The page exists and is
 * worth wanting; what is missing is standing to see it, and saying so is the
 * only version of this that reads as a door rather than a bug.
 *
 * It states no counts, and that is the point of gating before counting rather
 * than after: the count itself leaks how many members match a name, so this
 * request never computes one.
 *
 * Panas are the only scope still behind this door. Groups came out from behind
 * it in the same change that created this page — a group nobody outside it can
 * find cannot recruit anybody — so the offer below sends a visitor to groups
 * and the directory rather than leaving sign-in as the only way forward.
 */
function GatedPanas({ term }: { term: string }) {
  return (
    <main className="dirscope">
      <section className="dirsearch-band">
        <div className="container mx-auto px-4">
          <span className="section-eyebrow">Panas</span>
          <h1 className="dirsearch-title">Panas are for panas</h1>
          <p className="dirsearch-count">
            Members search each other, not the public. Sign in to look up panas
            by name, craft or handle.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {/* Plain `/signin`, no return path: sign-in is shared by the whole
                panaverse and lands the member in their surface's root, taking
                no return-path parameter. A `?next=` here would be decoration. */}
            <Link href="/signin" className="dirsearch-chip">
              Sign in
            </Link>
            <Link
              href={scopePath('directory', term)}
              className="dirsearch-chip"
            >
              Search the directory instead
            </Link>
            <Link href={scopePath('group', term)} className="dirsearch-chip">
              Browse groups
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

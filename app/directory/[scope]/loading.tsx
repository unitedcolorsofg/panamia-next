/**
 * What the scope routes show while the server is still answering.
 *
 * The page underneath is a server component that awaits a session, then four
 * counts, then four searches before it returns any markup, and the database
 * client is `max: 1`, so those run one after another rather than at once.
 * Until this file existed the App Router had nothing to put on screen for
 * that whole span: a visitor who searched from the home hero sat on the home
 * page, with the URL unchanged, watching nothing happen. The most common
 * reading of that is that the button is broken.
 *
 * Scoped to `[scope]` on purpose. `/directory/search` is a static sibling
 * segment with its own client-side query and its own in-place loading state,
 * and a boundary here would throw away results it deliberately keeps mounted
 * while the next ones load.
 *
 * This is chrome, not content: it claims nothing about what matched. The
 * title and the count are left as blank bars rather than guessed at, because
 * a skeleton that says "0 results" before anyone has looked is a lie that
 * lands in the half-second someone is deciding whether to wait.
 */
export default function Loading() {
  return (
    <main className="dirscope">
      <section className="surface-indigo dirsearch-band">
        <div className="container mx-auto px-4">
          {/* The one piece of real text. It is true on every scope and on
              every term, so there is nothing to wait for before saying it —
              and it is what confirms the click landed somewhere. */}
          <span className="section-eyebrow">Directory</span>

          <div aria-hidden="true" className="mt-2 flex flex-col gap-3">
            <div className="h-9 w-3/4 max-w-md animate-pulse rounded bg-current opacity-15" />
            <div className="h-5 w-1/2 max-w-xs animate-pulse rounded bg-current opacity-10" />
          </div>

          <div className="dirsearch-searchrow">
            <div
              aria-hidden="true"
              className="h-[60px] w-full animate-pulse rounded-full bg-current opacity-10"
            />
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        {/* Announced once, for the whole page. The bars above and below are
            decoration and stay hidden — a screen reader reading out a dozen
            empty boxes is noise, and the status line is the fact. */}
        <p role="status" className="sr-only">
          Loading the directory
        </p>

        <div aria-hidden="true" className="flex flex-col gap-10">
          {[0, 1].map((section) => (
            <section key={section}>
              <div className="mb-3 flex items-center gap-x-3">
                <div className="bg-pana-ink/10 h-6 w-40 animate-pulse rounded" />
                <div className="bg-pana-ink/10 h-5 w-10 animate-pulse rounded" />
              </div>

              <div className="dirsearch-grid">
                {Array.from({ length: 4 }).map((_, card) => (
                  <div
                    key={card}
                    className="bg-pana-ink/[0.06] h-48 animate-pulse rounded-xl"
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

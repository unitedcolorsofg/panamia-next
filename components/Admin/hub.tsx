import { AdminMockBar } from '@/components/Admin/mock-bar';
import { ViewTile } from '@/components/Admin/parts';
import { ADMIN_CHROME } from '@/lib/admin/theme';
import { ADMIN_VIEWS, UNBUILT_TOOLS } from '@/lib/admin/views';

/**
 * The admin hub — a set of doors, not a dashboard.
 *
 * Lives here rather than in `app/admin/page.tsx` because two routes need it:
 * that path, and `/` when the request arrives on `admin.pana.social`.
 *
 * The temptation with a page like this is to fill it with numbers, but a
 * number on a hub is a number you have to keep accurate in two places, and the
 * thing a staff member actually wants here is to leave as fast as possible for
 * the tool they came for.
 *
 * ## Why the routes are `/admin/...` and not `/listings`
 *
 * The route tree is flat and global: every path answers on every hostname. A
 * subdomain only decides which front door `/` renders and which chrome gets
 * worn. So `admin.pana.social/connectors` cannot mean the admin console —
 * `/connectors` is already the public Connectors landing page, on every host.
 * `admin.pana.social/admin/connectors` repeats itself, and that is the cost of
 * not having path rewriting. See the comment in `worker/index.ts` for why
 * rewriting is not available under vinext.
 *
 * ## The second list
 *
 * `UNBUILT_TOOLS` is on the page on purpose. Most admin capability in this
 * codebase exists as an endpoint with nothing in front of it, and a hub that
 * showed only the finished tiles would quietly claim that is all there is.
 */
export function AdminHub() {
  return (
    <>
      <AdminMockBar />

      <main className="bg-pana-cream pb-20 text-pana-ink">
        <header className="container mx-auto px-4 pb-8 pt-10">
          <p
            className={`text-xs font-extrabold uppercase tracking-[0.2em] ${ADMIN_CHROME.ACCENT}`}
          >
            Pana Admin
          </p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">
            Back office
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-pana-ink/70">
            Everything here changes what other panas see. Nothing here is
            yours.
          </p>
        </header>

        <div className="container mx-auto flex flex-col gap-10 px-4">
          <section>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-pana-ink/60">
              Tools
            </h2>
            <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {ADMIN_VIEWS.map((view) => (
                <ViewTile key={view.id} view={view} />
              ))}
            </div>
          </section>

          <section className="rounded-xl border-2 border-dashed border-pana-ink/40 p-6">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-pana-ink/60">
              Exists as an API, has no screen
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-pana-ink/70">
              Each of these is something staff can already technically do, by
              constructing a request by hand or by clicking a link out of an
              email. They are listed so the gap is visible rather than
              folklore.
            </p>

            <ul
              className={`mt-5 divide-y-2 ${ADMIN_CHROME.DIVIDE} border-t-2 ${ADMIN_CHROME.RULE}`}
            >
              {UNBUILT_TOOLS.map((tool) => (
                <li
                  key={tool.name}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <span className="min-w-[11rem] font-bold leading-snug">
                    {tool.name}
                  </span>
                  <span className="flex-1 text-sm leading-relaxed text-pana-ink/70">
                    {tool.note}
                  </span>
                  <code className="text-xs text-pana-ink/50">{tool.api}</code>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}

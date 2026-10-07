import Link from 'next/link';

import { ADMIN_CHROME } from '@/lib/admin/theme';
import { ADMIN_GROUPS, ADMIN_VIEWS, UNBUILT_TOOLS } from '@/lib/admin/views';

/**
 * The admin overview.
 *
 * The sidebar does the navigating, so this page does not repeat it as a grid
 * of cards. What the sidebar cannot carry is what each tool is *for* — a
 * column of nine names tells a new staff member nothing — so this is the same
 * list with a sentence attached, as rows.
 *
 * It deliberately shows no counts. Two of these tools are mocked and seven are
 * real; a "14 waiting" on this page would be a fixture sitting directly above
 * links to live queues, and there is no honest way to label that in passing.
 * Counts belong inside the tool that owns them.
 */
export function AdminOverview() {
  return (
    <>
      <header className="pb-8">
        <p
          className={`text-xs font-extrabold uppercase tracking-[0.2em] ${ADMIN_CHROME.ACCENT}`}
        >
          Pana Admin
        </p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">
          Back office
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-pana-ink/70">
          Everything here changes what other panas see. Nothing here is yours.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {ADMIN_GROUPS.map((group) => {
          const views = ADMIN_VIEWS.filter((v) => v.group === group.id);
          if (views.length === 0) return null;
          return (
            <section key={group.id}>
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-pana-ink/60">
                {group.name}
              </h2>
              <ul
                className={`mt-3 divide-y-2 ${ADMIN_CHROME.DIVIDE} border-t-2 ${ADMIN_CHROME.RULE}`}
              >
                {views.map((view) => (
                  <li key={view.id}>
                    <Link
                      href={view.href}
                      className="flex flex-col gap-1 py-3 transition-colors hover:bg-pana-ink/5 sm:flex-row sm:items-baseline sm:gap-6"
                    >
                      <span className="flex min-w-[11rem] items-center gap-2 font-bold leading-snug">
                        {view.name}
                        {view.status !== 'live' && (
                          <span className="rounded bg-pana-ink/10 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-pana-ink/60">
                            {view.status}
                          </span>
                        )}
                      </span>
                      <span className="flex-1 text-sm leading-relaxed text-pana-ink/70">
                        {view.blurb}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <section className="rounded-xl border-2 border-dashed border-pana-ink/40 p-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-pana-ink/60">
            Exists as an API, has no screen
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-pana-ink/70">
            Listed so the gap stays visible rather than becoming folklore. Of
            the thirteen endpoints under <code>app/api/admin/</code>, these are
            what the sidebar still cannot reach.
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
    </>
  );
}

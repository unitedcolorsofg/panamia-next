import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { AdminEyebrow } from '@/components/Admin/eyebrow';
import { StatusPill } from '@/components/Admin/status-pill';
import {
  ADMIN_GROUPS,
  UNBUILT_TOOLS,
  type AdminGroup,
  viewsInGroup,
} from '@/lib/admin/views';

/**
 * The admin overview.
 *
 * The sidebar does the navigating, so this page does not repeat it as a flat
 * list of links. What the sidebar cannot carry is what each tool is *for* — a
 * column of nine names tells a new staff member nothing — so this is the same
 * set, shelved by group, with a sentence on every row.
 *
 * ## Why it looks like the homepage now
 *
 * It was nine lines of text separated by hairlines, which is a table of
 * contents, not a place to work. The homepage already has a solved answer for
 * "several related things, each with a name and a line of explanation": a
 * bordered card with a coloured header band, holding rows that each carry an
 * icon, a name and a status. That is the pillars section, and this is the same
 * shape in the admin palette.
 *
 * What is deliberately *not* carried over from the homepage:
 *
 * - **The spacing.** The homepage breathes because it is read once by someone
 *   deciding whether to care. This is read every day by someone who already
 *   does, so the rhythm stays tight — no full-viewport sections, no `py-24`.
 * - **Scroll reveal.** `data-rv` animates sections in as you reach them, which
 *   is a nice first impression and an obstacle on the four hundredth visit.
 * - **The 56px display type.** `.section-display` is sized to be the first
 *   thing you see on a landing page. Here the heading is a label on a tool,
 *   so it takes the homepage's *character* — uppercase, black weight, tight
 *   tracking, one accent word — at a size that leaves room for the work.
 *
 * It deliberately shows no counts. Two of these tools are mocked and seven are
 * real; a "14 waiting" on this page would be a fixture sitting directly above
 * links to live queues, and there is no honest way to label that in passing.
 * Counts belong inside the tool that owns them.
 */
export function AdminOverview() {
  return (
    <>
      <header className="pb-9">
        <AdminEyebrow>Pana Admin</AdminEyebrow>

        {/* Uppercase display type here and sentence case on the nine tool
            pages, on purpose. This is the surface's front door and gets the
            homepage's display voice once; a workbench that shouts its own
            name at you every time you open it is just loud. */}
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          Back{' '}
          {/* Indigo, not the surface blue and not ADMIN_CHROME.ACCENT. The
              accent token is navy (#181c3d), which is four points off ink and
              reads as no accent at all at display size; the surface blue is
              2.21 on cream and fails outright. Indigo clears at 9.01 and is
              the only palette colour that is both obviously not-ink and safe
              here. A <span>, not an <em>: this is a colour change, and <em>
              would announce an emphasis to a screen reader that the sentence
              does not actually carry. */}
          <span className="text-pana-indigo">office</span>
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-relaxed text-pana-ink/70">
          Everything here changes what other panas see. Nothing here is yours.
        </p>
      </header>

      <div className="flex flex-col gap-7">
        {ADMIN_GROUPS.map((group, index) => (
          <GroupCard key={group.id} group={group} index={index} />
        ))}

        <UnbuiltSection />
      </div>
    </>
  );
}

/**
 * One shelf of tools.
 *
 * The band carries the group's own colour rather than the surface chrome,
 * which is the rule this surface already runs on: page *furniture* wears the
 * host's blue, *identity* keeps its own. Four shelves in four colours is what
 * makes "the thing in the yellow one" a usable way to remember where a tool
 * lives.
 */
function GroupCard({ group, index }: { group: AdminGroup; index: number }) {
  const views = viewsInGroup(group.id);
  if (views.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-pana-ink/55 bg-pana-cream shadow-[0_10px_28px_rgb(17_13_13_/_0.10)]">
      <header
        className={`flex items-baseline gap-3 px-5 py-3.5 ${group.fill} ${group.onFill}`}
      >
        {/* opacity-80, not 70. At 70 the numeral measures 4.45 on the flame
            fill — just under AA. It is aria-hidden and arguably decorative,
            but it is ordering a sighted reader uses, so leaning on the
            "incidental text" exemption to keep five percent of opacity would
            be a bad trade. 80 clears every fill and still reads as secondary
            to the group name. */}
        <span
          aria-hidden="true"
          className="text-xs font-black tabular-nums tracking-[0.16em] opacity-80"
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2 className="text-lg font-black uppercase leading-none tracking-tight">
          {group.name}
        </h2>
        {/* Hidden on narrow screens rather than wrapped: the band is a label,
            and a label that grows to three lines stops being one. */}
        <p className="hidden flex-1 text-right text-xs font-semibold opacity-80 sm:block">
          {group.blurb}
        </p>
      </header>

      <ul className="divide-y divide-pana-ink/10">
        {views.map((view) => {
          const Icon = view.icon;
          return (
            <li key={view.id}>
              <Link
                href={view.href}
                className="group/row flex items-start gap-4 px-5 py-4 transition-colors hover:bg-pana-ink/[0.04]"
              >
                {/* The icon sits on the group fill rather than on cream. Three
                    of the four group colours fail contrast as text on cream
                    (blue 2.21, flame 2.42, butter worse) — as a chip they are
                    a background instead, carrying the one foreground measured
                    safe against them. */}
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${group.fill} ${group.onFill}`}
                >
                  <Icon className="h-[1.125rem] w-[1.125rem]" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold leading-snug">{view.name}</span>
                    <StatusPill status={view.status} />
                  </span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-pana-ink/70">
                    {view.blurb}
                  </span>
                </span>

                <ArrowUpRight
                  aria-hidden="true"
                  className="mt-1 h-4 w-4 shrink-0 text-pana-ink/25 transition-colors group-hover/row:text-pana-ink/70"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The gap, written down.
 *
 * Dashed and unfilled on purpose — it is the one block on this page you cannot
 * click, and it should not look like the four above it that you can.
 */
function UnbuiltSection() {
  return (
    <section className="rounded-2xl border-2 border-dashed border-pana-ink/35 p-5 sm:p-6">
      <h2 className="text-sm font-black uppercase tracking-[0.12em] text-pana-ink/60">
        Exists as an API, has no screen
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-pana-ink/70">
        Listed so the gap stays visible rather than becoming folklore. Of the
        thirteen endpoints under <code>app/api/admin/</code>, these are what the
        sidebar still cannot reach.
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {UNBUILT_TOOLS.map((tool) => (
          <li
            key={tool.name}
            className="rounded-xl border border-pana-ink/15 bg-pana-ink/[0.03] px-4 py-3"
          >
            <p className="font-bold leading-snug">{tool.name}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-pana-ink/70">
              {tool.note}
            </p>
            <code className="mt-1.5 block break-all text-xs text-pana-ink/50">
              {tool.api}
            </code>
          </li>
        ))}
      </ul>
    </section>
  );
}

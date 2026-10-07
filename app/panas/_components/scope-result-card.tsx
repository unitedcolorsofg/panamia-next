import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, CalendarDays, MapPin } from 'lucide-react';
import { KIND_ICON } from '@/components/kind-icon';
import { CATEGORY_LABEL } from '@/app/directory/search/_lib/format';
import type { ScopeResult } from '@/lib/server/search-kinds';
import type { SuggestionKind } from '@/lib/suggest';

/**
 * One result, whatever kind it is.
 *
 * This used to be a 48px thumbnail row, and the business directory next door
 * used a 458px card for the same record — same query, same Taller Lucía, six
 * times the height depending on which URL you arrived through. That is the
 * difference this card exists to remove.
 *
 * The merge went toward the taller card rather than the shorter one. The old
 * comment here defended the row by saying the other three scopes have nothing
 * to put in certification, categories, recommendations or distance. Two of
 * those four are genuinely business-only. The other two are not: a group has
 * topics and a member count, an event has a start time and a venue, and both
 * were being dropped for want of a slot rather than for want of data.
 *
 * Every row below renders only when its slot is filled, so a kind that really
 * has nothing to say in one simply does not draw it — see the slot table on
 * `ScopeResult`. That is the same rule the business card already used to tell
 * a claimed listing from an unclaimed one.
 *
 * The kind chip on the media does the labelling the old card spent its whole
 * thumbnail on. In a single-kind scope the heading above already said it; in
 * Everything it is the only thing telling a cafe from the pana who runs it
 * when both are called Lucía.
 */
export function ScopeResultCard({
  result,
  kind,
}: {
  result: ScopeResult;
  kind: SuggestionKind;
}) {
  const Icon = KIND_ICON[kind];

  return (
    <article className="dirsearch-card">
      <Link
        href={result.href}
        className="dirsearch-card-media"
        aria-label={`${result.name} — view`}
        tabIndex={-1}
      >
        {result.imageUrl ? (
          <Image
            src={result.imageUrl}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 260px"
            className="object-cover"
          />
        ) : (
          // .dirsearch-card-media already fills with butter-2, so an empty
          // cover only needs something that looks intentional.
          <span className="absolute inset-0 grid place-items-center">
            <Icon className="h-8 w-8 opacity-25" aria-hidden="true" />
          </span>
        )}

        {result.certified && (
          <span className="dirsearch-card-cert">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Pana Certified
          </span>
        )}

        {/* Bottom-left in cream-on-ink so it reads as a label rather than an
            award, and never collides with certification, which is top-left. */}
        <span className="bg-pana-ink/85 text-pana-cream absolute bottom-[0.7rem] left-[0.7rem] inline-flex items-center gap-[0.3rem] rounded-full px-[0.7rem] py-[0.28rem] text-[0.6875rem] font-black tracking-[0.04em] uppercase backdrop-blur-sm">
          <Icon className="h-3 w-3" aria-hidden="true" />
          {kind}
        </span>
      </Link>

      <div className="dirsearch-card-body">
        <div className="dirsearch-card-head">
          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">
              <Link href={result.href}>{result.name}</Link>
            </h3>
            {result.subtitle && (
              <p className="dirsearch-card-tagline">{result.subtitle}</p>
            )}
            {/* Skipped when it is already the subtitle, which is what a pana
                with no five words written falls back to. */}
            {result.handle && result.handle !== result.subtitle && (
              <p className="text-pana-ink/55 mt-0.5 text-sm font-bold">
                {result.handle}
              </p>
            )}
          </div>
        </div>

        {result.where && (
          <p className="dirsearch-card-where">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{result.where}</span>
          </p>
        )}

        {result.blurb && <p className="dirsearch-card-blurb">{result.blurb}</p>}

        {result.pills.length > 0 && (
          <ul className="dirsearch-card-cats">
            {/* Four, matching the business card. A profile can carry a dozen
                categories and a wrapped pill row would outgrow the blurb. */}
            {result.pills.slice(0, 4).map((pill) => (
              <li key={pill}>{CATEGORY_LABEL[pill] ?? pill}</li>
            ))}
          </ul>
        )}

        {/* The slot the old row had no answer for at all. An event's start
            time is the reason someone acts this week instead of bookmarking
            and forgetting — the same job the business card's next-event strip
            already does. */}
        {result.when && (
          <p className="dirsearch-card-event">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            <strong>{result.when}</strong>
          </p>
        )}

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            {result.signal && (
              <span className="dirsearch-card-counts">{result.signal}</span>
            )}
          </div>

          <div className="dirsearch-card-actions">
            <Link href={result.href} className="dirsearch-view">
              View
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

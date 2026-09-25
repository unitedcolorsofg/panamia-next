'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { KIND_ICON } from '@/components/kind-icon';
import { ACTION_LABEL, type UnifiedResult } from '../_data';

/**
 * One result, whatever kind it is.
 *
 * This replaces both `directory/search/_components/result-card.tsx` (238
 * lines, businesses only) and `directory/_components/scope-result-card.tsx`
 * (81 lines, everything else). It is not a compromise between them: it is the
 * business card, with the kind-specific nouns pulled out into the fields
 * documented in `_data.ts`.
 *
 * That direction is deliberate. The compact row was never chosen because
 * panas and events deserve less — its own comment says the four scopes "ended
 * up sharing one" layout and that the business card keeps its own because the
 * others have nothing to put in certification, categories, recommendations or
 * distance. Two of those four are genuinely business-only. The other two are
 * not: a group has tags and members, an event has tags and attendees, and
 * both were being dropped for want of a slot rather than for want of data.
 *
 * The kind icon does the labelling the compact card used its whole thumbnail
 * for. It sits on the media as a small chip, so a mixed Everything list stays
 * readable without a badge repeating the section heading above it.
 */
export function UnifiedCard({ result }: { result: UnifiedResult }) {
  const Icon = KIND_ICON[result.kind];
  // Faces and storefronts are circles everywhere else in the product; a group
  // or event cover cropped to a circle loses most of itself. Same rule the
  // compact card already applied, kept because it was right.
  const roundBadge = result.kind === 'business' || result.kind === 'pana';

  return (
    <article className="dirsearch-card">
      <Link
        href={result.href}
        className="dirsearch-card-media"
        aria-label={`${result.name} — view`}
        tabIndex={-1}
      >
        {result.cover ? (
          <Image
            src={result.cover}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 260px"
            className="object-cover"
          />
        ) : (
          // .dirsearch-card-media already fills with butter-2, so an empty
          // cover just needs something to look intentional rather than broken.
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

        {/* What kind of thing this is, said once, on the image. Mirrors the
            cert chip's geometry but sits bottom-left in cream-on-ink, so it
            reads as a label rather than an award — and never collides with
            certification, which is top-left. In a single-scope list the
            section heading already said it; in Everything it is the only thing
            telling a cafe from the pana who runs it when both are Lucía. */}
        <span className="bg-pana-ink/85 text-pana-cream absolute bottom-[0.7rem] left-[0.7rem] inline-flex items-center gap-[0.3rem] rounded-full px-[0.7rem] py-[0.28rem] text-[0.6875rem] font-black tracking-[0.04em] uppercase backdrop-blur-sm">
          <Icon className="h-3 w-3" aria-hidden="true" />
          {result.kind}
        </span>
      </Link>

      <div className="dirsearch-card-body">
        <div className="dirsearch-card-head">
          {result.badge && (
            <span
              className="dirsearch-card-logo"
              style={roundBadge ? undefined : { borderRadius: '0.5rem' }}
            >
              <Image
                src={result.badge}
                alt=""
                width={52}
                height={52}
                aria-hidden="true"
              />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="dirsearch-card-name">
              <Link href={result.href}>{result.name}</Link>
            </h3>
            {result.tagline && (
              <p className="dirsearch-card-tagline">{result.tagline}</p>
            )}
          </div>
        </div>

        {result.where && (
          <p className="dirsearch-card-where">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{result.where}</span>
            {result.distance && (
              <span className="dirsearch-card-distance">{result.distance}</span>
            )}
          </p>
        )}

        {result.blurb && <p className="dirsearch-card-blurb">{result.blurb}</p>}

        {result.pills.length > 0 && (
          <ul className="dirsearch-card-cats">
            {result.pills.map((pill) => (
              <li key={pill}>{pill}</li>
            ))}
          </ul>
        )}

        {/* The one slot the compact card had no answer for at all. A group's
            next meetup and an event's start time are the reason someone acts
            this week instead of bookmarking and forgetting — the same job the
            business card's next-event strip already does. */}
        {result.when && (
          <p className="dirsearch-card-event">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            <strong>{result.when}</strong>
          </p>
        )}

        <div className="dirsearch-card-foot">
          <div className="dirsearch-card-signals">
            {result.faces.length > 0 && (
              <span className="dirsearch-card-avatars" aria-hidden="true">
                {result.faces.map((face) => (
                  <Image key={face} src={face} alt="" width={26} height={26} />
                ))}
              </span>
            )}
            {result.signal && (
              <span className="dirsearch-card-counts">{result.signal}</span>
            )}
          </div>

          <div className="dirsearch-card-actions">
            {result.action && (
              <button type="button" className="dirsearch-save" data-on={false}>
                <Bookmark className="h-4 w-4" aria-hidden="true" />
                {ACTION_LABEL[result.action]}
              </button>
            )}
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

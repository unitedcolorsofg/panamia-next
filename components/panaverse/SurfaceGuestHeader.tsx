import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import {
  DEFAULT_SURFACE,
  frontDoorPath,
  originForFrom,
  type PanaverseSurface,
} from '@/lib/panaverse/surfaces';
import { SURFACE_MARK, SURFACE_TONE } from '@/lib/panaverse/branding';

/**
 * The bar a surface wears over a page it is borrowing from another surface.
 *
 * One deploy serves the whole panaverse, so every route answers on every
 * hostname: social.pana.social/directory/search really does render the main
 * site's directory. That is a feature — a member who wants the directory
 * should not be bounced to a different hostname to read it — but until this
 * existed those pages rendered with no header, no footer and no way back to
 * the feed. The surface kept the member and then stranded them.
 *
 * So this is deliberately not a second masthead. It carries the two things a
 * borrowed page cannot supply for itself:
 *
 *   - the mark, linking home, so the member can always get back to the surface
 *     they were actually in;
 *   - an honest statement of whose page this is, with a link to it on its own
 *     surface, for anyone who wants the full site around it.
 *
 * It has no nav. A directory nav rendered under the Pana Social mark would
 * claim the surface owns pages it is only showing, which is the same
 * confusion in the opposite direction.
 */
export function SurfaceGuestHeader({
  surface,
  host,
  pathname,
  owner = DEFAULT_SURFACE,
}: {
  /** The surface being served — the one whose mark flies here. */
  surface: PanaverseSurface;
  /** Raw Host header, so cross-surface links keep the scheme and port in hand
   *  instead of sending a developer out to the live site. */
  host: string | null | undefined;
  /** Path being served, used to link to the same page on its own surface. */
  pathname: string;
  /** The surface this page belongs to. */
  owner?: PanaverseSurface;
}) {
  const mark = SURFACE_MARK[surface.id];
  const ownerOrigin = originForFrom(owner, host);

  return (
    <header
      className="panaverse-masthead panaverse-guest"
      data-tone={SURFACE_TONE[surface.id]}
      data-contained="true"
    >
      <div className="panaverse-masthead-inner container mx-auto max-w-6xl px-4">
        <Link
          href={frontDoorPath(surface, host)}
          className="panaverse-guest-home"
          aria-label={`${surface.name} home`}
        >
          {/* No `priority`: this bar is never the largest paint on the page,
              and preloading a 22px-tall mark above the borrowed page's own
              hero would be a preload warning for no gain. */}
          <Image
            src={mark.src}
            alt={mark.alt}
            width={mark.width}
            height={mark.height}
            sizes="160px"
            className="panaverse-logo"
          />
        </Link>

        {/* Hidden on narrow screens, where the mark and the link are the two
            things that have to survive. The sentence is context, not a
            control. */}
        <span className="panaverse-guest-note">
          <span aria-hidden="true">·</span> A {owner.name} page
        </span>

        <a href={`${ownerOrigin}${pathname}`} className="panaverse-guest-link">
          Open on {owner.name}
          <ExternalLink className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}

'use client';

import Image from 'next/image';
import {
  SURFACE_LOGO,
  SURFACE_NAV,
  SURFACE_TONE,
  MOCK_MEMBER,
  type MockSurface,
} from '../_data/panaverse';
import { SurfaceSwitcher } from './surface-switcher';

/* The masthead each surface carries.
 *
 * What is constant: the switcher, the avatar, and the lettering — every surface
 * flies a mark from the same hand-drawn family, in the same orange. What
 * changes: which mark, the nav, and the accent rule. That split is the whole
 * design — constant enough to read as one organisation, different enough that a
 * timeline does not carry a directory nav.
 *
 * It renders in two modes, and the difference matters more than it looks:
 *
 *   - Inside a drawn browser frame (/mock/panaverse), where it is the subject
 *     being compared across surfaces.
 *   - Full bleed and sticky (/mock/feed), where it is simply the header of
 *     Pana Social and the member is meant to forget it was ever designed.
 *
 * The second mode is the one that answers "does this feel like its own site",
 * because a masthead inside a bordered rectangle on a cream page is still
 * visibly a picture of a website rather than a website. */
export function SurfaceMasthead({
  surfaces,
  current,
  onSelect,
  sticky = false,
  contained = false,
}: {
  surfaces: MockSurface[];
  current: MockSurface;
  onSelect: (id: string) => void;
  /** Pin to the top of the viewport. Only meaningful full bleed — inside the
   *  browser frame there is nothing to stick to. */
  sticky?: boolean;
  /** Constrain the masthead's contents to the same column the page body uses.
   *  Required full bleed, where the logo would otherwise hug the viewport
   *  edge while the feed beneath it sits in a centred column. */
  contained?: boolean;
}) {
  const logo = SURFACE_LOGO[current.id] ?? SURFACE_LOGO.www;

  const contents = (
    <>
      {/* Each surface flies its own real lockup rather than a shared wordmark
          with the surface name bolted on. An earlier draft did the latter,
          arguing a standalone "Pana Social" mark would read as a second
          product — but the panas have already drawn one, and it does not,
          because it is the same hand-lettering in the same orange as the Pana
          Mia Club mark, right down to the star dotting the `i`. The
          letterforms carry the continuity the text separator stood in for. */}
      {/* No `priority`: the mark swaps when you change surfaces, so preloading
          it just warns about a preload that goes unused. */}
      <Image
        src={logo.src}
        alt={logo.alt}
        width={logo.width}
        height={logo.height}
        sizes="160px"
        className="panaverse-logo"
      />

      <nav className="panaverse-nav" aria-label={`${current.name} navigation`}>
        {SURFACE_NAV[current.id]?.map((item, index) => (
          <a key={item} href="#" data-active={index === 0}>
            {item}
          </a>
        ))}
      </nav>

      <div className="ml-auto flex flex-none items-center gap-2">
        <SurfaceSwitcher
          surfaces={surfaces}
          currentId={current.id}
          onSelect={onSelect}
        />
        <Image
          src={MOCK_MEMBER.avatar}
          alt={MOCK_MEMBER.name}
          width={32}
          height={32}
          className="chrome-avatar h-8 w-8 flex-none"
        />
      </div>
    </>
  );

  return (
    <div
      className="panaverse-masthead"
      data-tone={SURFACE_TONE[current.id]}
      data-sticky={sticky ? 'true' : undefined}
      data-contained={contained ? 'true' : undefined}
    >
      {contained ? (
        <div className="panaverse-masthead-inner container mx-auto max-w-6xl px-4">
          {contents}
        </div>
      ) : (
        contents
      )}
    </div>
  );
}

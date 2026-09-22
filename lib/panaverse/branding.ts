/**
 * Panaverse surface branding.
 *
 * The marks and copy each surface wears. Deliberately a sibling of
 * `surfaces.ts` rather than part of it: the registry is what routes a request,
 * and the Worker has no use for a logo. Keeping presentation here lets the
 * registry stay the smallest thing that can answer "which surface is this".
 *
 * This is the real source for surface branding — the mocks read it too, so a
 * mock cannot drift from what ships.
 */

import type { SurfaceId } from './surfaces';

/** A wordmark, with intrinsic dimensions so next/image reserves space and the
 *  page does not shift when it loads. */
export interface SurfaceMark {
  src: string;
  width: number;
  height: number;
  alt: string;
}

/**
 * The lockup each surface flies.
 *
 * Every mark is from the same hand-drawn family in the same orange, right down
 * to the star dotting the `i`. That is deliberate: the panas do not use colour
 * or letterform to tell their offerings apart, so the mark says "which room"
 * without ever saying "different organisation".
 */
export const SURFACE_MARK: Record<SurfaceId, SurfaceMark> = {
  www: {
    src: '/logos/pana_logo_long_orange.png',
    width: 800,
    height: 135,
    alt: 'Pana Mia Club',
  },
  social: {
    src: '/logos/pana_social_long_orange.png',
    width: 800,
    height: 120,
    alt: 'Pana Social',
  },
};

/** What each surface is for, in the second person — written for a member
 *  deciding where to click, not a developer reading the registry. */
export const SURFACE_BLURB: Record<SurfaceId, string> = {
  www: 'Find Panas, browse the directory, and see what the org is up to.',
  social: 'Post, reply, and read what your Panas are making this week.',
};

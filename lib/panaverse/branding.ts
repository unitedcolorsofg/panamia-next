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

/**
 * Default meta description per surface, used by the root layout for any page
 * that does not set its own.
 *
 * `www` is deliberately the exact string the root layout shipped before
 * surfaces existed: the main site's description is indexed, and this change is
 * meant to give Pana Social its own identity, not to quietly rewrite Pana
 * Mia's. Only the social entry is new.
 */
export const SURFACE_DESCRIPTION: Record<SurfaceId, string> = {
  www: 'Community platform for Pana Mia',
  social:
    'The Pana Mia community timeline — post, reply, and follow Panas across the fediverse.',
};

/** Which colour a surface carries through its chrome. Values are token names
 *  from app/globals.css, not raw hex, so a surface cannot introduce a colour
 *  that is not already in the palette. */
export type SurfaceTone = 'indigo' | 'burnt' | 'flame' | 'blue' | 'red';

/**
 * The accent each surface carries.
 *
 * Wayfinding, not branding. Both live marks are the same orange in the same
 * hand-lettered family — the panas deliberately do not use colour to tell
 * their offerings apart — so the logo never recolours, and the accent rule
 * (border, active nav, pill hover) is the only thing answering "which room am
 * I in".
 *
 * `social` is flame rather than burnt because that is the orange the real logo
 * is drawn in; burnt was a guess made before the live mark was in hand.
 */
export const SURFACE_TONE: Record<SurfaceId, SurfaceTone> = {
  www: 'indigo',
  social: 'flame',
};

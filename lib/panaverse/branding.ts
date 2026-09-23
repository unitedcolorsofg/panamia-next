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

/** One masthead nav link. `href` is a real route in `app/`, never a fixture —
 *  see SURFACE_NAV. */
export interface SurfaceNavItem {
  label: string;
  href: string;
}

/**
 * The masthead nav each surface carries.
 *
 * Deliberately per-surface: a shared nav listing every route in the panaverse
 * is how a timeline ends up with a directory link in it. What stays constant
 * across surfaces is the mark, the switcher and the avatar — enough to read as
 * one organisation without pretending the rooms have the same job.
 *
 * Every href here is a route that exists today. The design mock at
 * `app/mock/_data/panaverse.ts` carries an aspirational nav for Pana Social
 * (Explore, Groups, Notifications) because a mock is allowed to draw things
 * that are not built yet; shipping chrome is not, so social lists the one
 * own-surface destination it actually has. Add routes here as they land rather
 * than copying the mock's list across.
 *
 * `www` is empty because the main site renders MainHeader, which has its own
 * nav — this drives the surface masthead, and the surface masthead never flies
 * over www. An invented list of links here would rot unverified.
 */
export const SURFACE_NAV: Record<SurfaceId, SurfaceNavItem[]> = {
  www: [],
  social: [{ label: 'Home', href: '/s' }],
};

/**
 * A real, shipped part of Pana Mia served from the main site rather than from
 * a hostname of its own.
 *
 * Rooms are listed in the switcher below the surfaces and styled more quietly,
 * because giving them equal weight would promise a front door they do not
 * have. Each one is a candidate to be promoted to a surface later, which is a
 * registry entry plus a DNS record rather than a rewrite.
 */
export interface PanaverseRoom {
  name: string;
  /** The route it lives at today. Relative on purpose — see SHARED_ROOMS. */
  path: string;
  blurb: string;
  tone: SurfaceTone;
}

/**
 * The rooms the switcher offers.
 *
 * Paths are relative, so following one from Pana Social keeps the member on
 * social.pana.social and the page arrives wearing the guest chrome
 * (`SurfaceGuestHeader`). That is the same call `SurfaceGuestFooter` makes for
 * the legal links, and for the same reason: bouncing a member to another
 * hostname to look at Pana Mia content is exactly the "two separate products"
 * message the switcher exists to dispel.
 *
 * Blurbs are one truncating line in the panel and are written to fit. A room
 * that needs two lines to explain itself is arguing to be a surface.
 */
export const SHARED_ROOMS: readonly PanaverseRoom[] = [
  {
    name: 'Events',
    path: '/e',
    blurb: 'Markets, mixers, shows',
    tone: 'flame',
  },
  {
    name: 'Peer Mentoring',
    path: '/m',
    blurb: 'Book time with a Pana',
    tone: 'blue',
  },
  {
    name: 'Resilience Network',
    path: '/r',
    blurb: 'Mutual aid groups',
    tone: 'red',
  },
];

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

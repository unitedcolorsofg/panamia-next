/* Fixture data for the panaverse switcher mock at /mock/panaverse.
 *
 * Unlike the other mocks, the surfaces here are NOT invented. The live ones
 * come straight out of `lib/panaverse/surfaces.ts` — the same registry the
 * Worker routes hostnames on — so this mock cannot drift from what actually
 * ships. The page reads the registry on the server and hands it down; only the
 * presentation metadata below is a fixture.
 *
 * The "rooms" are the honest part of the picture. Events, peer mentoring, and
 * the resilience network are not roadmap items: they are real routes that
 * exist in `app/` today, served from the main site. Showing them as rooms
 * rather than surfaces is the argument that a panaverse offering does not need
 * its own hostname to be real — and that promoting one later is a registry
 * entry, not a rewrite.
 */

import { MOCK_VIEWER } from '../../feed/_data/mock-feed';

/** Which colour a surface carries through its chrome. Values are token names
 *  from app/globals.css, not raw hex, so a surface cannot introduce a colour
 *  that is not already in the palette. */
export type SurfaceTone = 'indigo' | 'burnt' | 'flame' | 'blue' | 'red';

/** A surface as the switcher needs to render it. Mirrors PanaverseSurface
 *  from lib/panaverse/surfaces.ts, flattened for the client. */
export interface MockSurface {
  /** PanaverseSurface.id */
  id: string;
  /** PanaverseSurface.name */
  name: string;
  /** hostnameFor(surface) — the host this surface is actually served from. */
  hostname: string;
  /** PanaverseSurface.rootPath — where its front door lives in the route tree. */
  rootPath: string;
}

/** Presentation metadata, keyed by PanaverseSurface.id. Kept out of the
 *  registry because the Worker has no use for a colour, and the registry
 *  should stay the smallest thing that can route a request. */
export const SURFACE_TONE: Record<string, SurfaceTone> = {
  www: 'indigo',
  social: 'burnt',
};

/** What each surface is for, in the second person. The registry taglines are
 *  written for a developer reading the file; these are written for a member
 *  deciding where to click. */
export const SURFACE_BLURB: Record<string, string> = {
  www: 'Find Panas, browse the directory, and see what the org is up to.',
  social: 'Post, reply, and read what your Panas are making this week.',
};

/** The masthead nav each surface carries. Different per surface on purpose:
 *  a shared nav listing every route in the panaverse is how you end up with a
 *  directory link in a timeline. What stays constant is the wordmark, the
 *  switcher, and the avatar — enough to read as one organisation without
 *  pretending the rooms have the same job. */
export const SURFACE_NAV: Record<string, string[]> = {
  www: ['Directory', 'Events', 'About', 'Get involved'],
  social: ['Home', 'Explore', 'Groups', 'Notifications'],
};

/** A real, shipped part of Pana Mia that is served from the main site rather
 *  than its own hostname. Each one is a candidate to become a surface. */
export interface MockRoom {
  name: string;
  /** The route it lives at today. */
  path: string;
  blurb: string;
  tone: SurfaceTone;
  /** The hostname it would take if it were promoted to a surface — shown to
   *  make the point that promoting it is a DNS record plus a registry entry. */
  couldBecome: string;
}

export const SHARED_ROOMS: MockRoom[] = [
  {
    name: 'Events',
    path: '/e',
    /* Room blurbs are one truncating line in the panel, so they are written to
       fit — a room that needs two lines to explain itself is arguing to be a
       surface. */
    blurb: 'Markets, mixers, shows',
    tone: 'flame',
    couldBecome: 'events.panamia.club',
  },
  {
    name: 'Peer Mentoring',
    path: '/m',
    blurb: 'Book time with a Pana',
    tone: 'blue',
    couldBecome: 'mentoring.panamia.club',
  },
  {
    name: 'Resilience Network',
    path: '/r',
    blurb: 'Mutual aid groups',
    tone: 'red',
    couldBecome: 'resilience.panamia.club',
  },
];

/** The signed-in member, imported rather than redeclared.
 *
 * This is the argument of the switcher expressed as an import: the feed mock
 * and this mock render the same person because there is one account. A second
 * copy of the viewer here could drift, and a drifting identity is exactly the
 * failure the panaverse is meant to prevent. */
export const MOCK_MEMBER = {
  ...MOCK_VIEWER,
  /** socialActors.preferredUsername + FEDERATION_DOMAIN. Pinned to the
   *  identity domain, NOT the UI host — see lib/federation/domain.ts. This is
   *  the string that proves the account is the same one everywhere. */
  fediverseHandle: `@${MOCK_VIEWER.handle}@pana.social`,
};

/**
 * What the admin surface contains.
 *
 * Kept as data rather than as markup so the hub, and anything else that wants
 * to enumerate staff tools later, read from one list. Adding a view should be
 * an entry here plus a route.
 */

export type ViewStatus = 'mock' | 'live';

export interface AdminView {
  id: string;
  name: string;
  href: string;
  /** One line. What this is. */
  blurb: string;
  /** The specific things an admin can do once they are in there. */
  does: readonly string[];
  status: ViewStatus;
  /** Shown on the tile as the reason to open it now. */
  signal?: string;
}

export const ADMIN_VIEWS: readonly AdminView[] = [
  {
    id: 'listings',
    name: 'Business listings',
    href: '/admin/listings',
    blurb: 'Applications from businesses waiting to be let into the directory.',
    does: [
      'See everything waiting, oldest first',
      'Read the application without leaving the queue',
      'Approve or decline',
    ],
    status: 'mock',
  },
  {
    id: 'connectors',
    name: 'Pana Connectors',
    href: '/admin/connectors',
    blurb: 'The volunteer programme: roster, houses, commitments and events.',
    does: [
      'Assign a connector to a house',
      'Set commitments and events',
      'Read the programme numbers',
    ],
    status: 'mock',
  },
  {
    id: 'download-profiles',
    name: 'Export profiles',
    href: '/admin/download-profiles',
    blurb: 'Pull the directory down as a spreadsheet.',
    does: ['Download every profile as CSV'],
    status: 'live',
  },
];

/**
 * Capability that exists as an API and has no screen.
 *
 * This list is uncomfortable on purpose. There are thirteen admin endpoints
 * under `app/api/admin/` and, before this surface, two admin pages — so most
 * of what staff are technically able to do is reachable only by constructing a
 * request by hand or clicking a link out of an email. Writing the gap down is
 * the first step to closing it, and a hub that quietly showed three tiles
 * would imply three tiles is the whole job.
 */
export interface UnbuiltTool {
  name: string;
  api: string;
  note: string;
}

export const UNBUILT_TOOLS: readonly UnbuiltTool[] = [
  {
    name: 'Venue approvals',
    api: '/api/admin/venues/[slug]/approve · /suspend',
    note: 'Same shape as the listings queue. Probably the next one to build.',
  },
  {
    name: 'Articles',
    api: '/api/admin/articles · [slug]/remove · /restore',
    note: 'Remove and restore exist as endpoints; nothing lists what is published.',
  },
  {
    name: 'Contact submissions',
    api: '/api/admin/contactSubmissions',
    note: 'Messages from the contact form land somewhere nobody looks.',
  },
  {
    name: 'Relay reports',
    api: '/api/admin/relayReports',
    note: 'Moderation reports from the Nostr relay. No queue, no triage.',
  },
  {
    name: 'Mentoring',
    api: '/api/admin/mentoring/dashboard',
    note: 'A dashboard endpoint with no dashboard in front of it.',
  },
];

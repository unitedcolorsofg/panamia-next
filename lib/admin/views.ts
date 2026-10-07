/**
 * What the admin surface contains.
 *
 * Kept as data rather than as markup so the sidebar, the overview and anything
 * else that wants to enumerate staff tools read from one list. Adding a view
 * should be an entry here plus a route.
 */

export type ViewStatus = 'mock' | 'live' | 'stub';

export type AdminGroupId = 'directory' | 'community' | 'content' | 'inbox';

export interface AdminGroup {
  id: AdminGroupId;
  name: string;
}

/** Sidebar order. */
export const ADMIN_GROUPS: readonly AdminGroup[] = [
  { id: 'directory', name: 'Directory' },
  { id: 'community', name: 'Community' },
  { id: 'content', name: 'Content' },
  { id: 'inbox', name: 'Inbox' },
];

export interface AdminView {
  id: string;
  name: string;
  href: string;
  group: AdminGroupId;
  /** One line. What this is. */
  blurb: string;
  /** The specific things an admin can do once they are in there. */
  does: readonly string[];
  status: ViewStatus;
}

export const ADMIN_VIEWS: readonly AdminView[] = [
  {
    id: 'listings',
    name: 'Business listings',
    href: '/admin/listings',
    group: 'directory',
    blurb: 'Applications from businesses waiting to be let into the directory.',
    does: [
      'See everything waiting, oldest first',
      'Read the application without leaving the queue',
      'Approve or decline',
    ],
    status: 'mock',
  },
  {
    id: 'download-profiles',
    name: 'Export profiles',
    href: '/admin/download-profiles',
    group: 'directory',
    blurb: 'Pull the directory down as a spreadsheet.',
    does: ['Download every profile as CSV'],
    status: 'live',
  },
  {
    id: 'connectors',
    name: 'Pana Connectors',
    href: '/admin/connectors',
    group: 'community',
    blurb: 'The volunteer programme: roster, houses, commitments and events.',
    does: [
      'Assign a connector to a house',
      'Set commitments and events',
      'Read the programme numbers',
    ],
    status: 'mock',
  },
  {
    id: 'mentoring',
    name: 'Mentoring',
    href: '/admin/mentoring',
    group: 'community',
    blurb: 'Metrics and analytics for the mentoring programme.',
    does: ['Read session and participation charts'],
    status: 'live',
  },
  {
    id: 'users',
    name: 'Users',
    href: '/admin/users',
    group: 'community',
    blurb: 'Accounts and permissions.',
    does: ['Look up a user', 'Review account state'],
    status: 'live',
  },
  {
    id: 'articles',
    name: 'Articles',
    href: '/admin/articles',
    group: 'content',
    blurb: 'Moderate community articles.',
    does: ['Review what is published', 'Remove and restore'],
    status: 'live',
  },
  {
    id: 'podcasts',
    name: 'Podcasts',
    href: '/admin/podcasts',
    group: 'content',
    blurb: 'Podcast submissions.',
    does: [],
    status: 'stub',
  },
  {
    id: 'contactus',
    name: 'Contact submissions',
    href: '/admin/contactus',
    group: 'inbox',
    blurb: 'Messages from the contact form.',
    does: ['Read the queue', 'Set status and category'],
    status: 'live',
  },
  {
    id: 'reports',
    name: 'Abuse reports',
    href: '/admin/reports',
    group: 'inbox',
    blurb: 'Moderation reports from the Nostr relay.',
    does: ['Triage a report', 'Act on the reported account'],
    status: 'live',
  },
];

export function viewsInGroup(group: AdminGroupId): readonly AdminView[] {
  return ADMIN_VIEWS.filter((v) => v.group === group);
}

/**
 * Capability that exists as an API and has no screen.
 *
 * Short, and worth keeping short. Of the thirteen endpoints under
 * `app/api/admin/`, all but the venue pair are now reachable from the sidebar.
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
    name: 'Events',
    api: 'none',
    note: 'The old admin menu linked to /account/admin/events, which has never had a page or an endpoint behind it. Dropped rather than carried over.',
  },
];

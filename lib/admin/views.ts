/**
 * What the admin surface contains.
 *
 * Kept as data rather than as markup so the sidebar, the overview and anything
 * else that wants to enumerate staff tools read from one list. Adding a view
 * should be an entry here plus a route.
 *
 * ## Why there are icons and colours in here
 *
 * Six tools rendered as six lines of text are six identical shapes, and staff
 * who use this daily navigate by shape long before they read. The icon and the
 * group colour are the shape. They live beside the name because they are part
 * of what a view *is*, not decoration a component adds later — and because the
 * sidebar and the overview both need them and must not disagree.
 *
 * ## What is deliberately not in here
 *
 * Mentoring, Articles and Podcasts were dropped from the sidebar so the
 * surface carries only the work being prioritised now. Their routes and their
 * endpoints are untouched and still answer — see `PARKED_TOOLS` at the bottom,
 * which keeps them written down rather than letting them become folklore.
 */

import {
  Download,
  Flag,
  HeartHandshake,
  type LucideIcon,
  Mail,
  Store,
  UsersRound,
} from 'lucide-react';

export type ViewStatus = 'mock' | 'live' | 'stub';

export type AdminGroupId = 'directory' | 'community' | 'inbox';

export interface AdminGroup {
  id: AdminGroupId;
  name: string;
  /** One line, on the group's header band. What this shelf of tools is for. */
  blurb: string;
  /**
   * The band fill, and the only text colour that is safe on it.
   *
   * Written as complete Tailwind class strings rather than a colour name the
   * caller interpolates. Tailwind v4 only emits a utility it can see spelled
   * out in a source file, so `bg-pana-${group.accent}` compiles to nothing —
   * the band renders transparent and the bug is invisible in review. This has
   * bitten this codebase twice; see the note on ADMIN_CHROME.RULE_LG.
   *
   * Measured against the CONTRAST RULE at the top of app/globals.css. Every
   * pairing below clears AA for body text:
   *
   *   ink   / blue    8.21      ink  / flame   7.50
   *   cream / indigo  9.01      ink  / butter 16.41
   *
   * Changing a fill means re-measuring its partner in the same edit. The warm
   * fills here carry ink and the one dark fill carries cream, which is the
   * rule the whole palette runs on.
   */
  fill: string;
  onFill: string;
}

/** Sidebar order, and the order the overview stacks them in. */
export const ADMIN_GROUPS: readonly AdminGroup[] = [
  {
    id: 'directory',
    name: 'Directory',
    blurb: 'Who is listed, and who is still waiting to get in.',
    fill: 'bg-pana-blue',
    onFill: 'text-pana-ink',
  },
  {
    id: 'community',
    name: 'Community',
    blurb: 'The panas themselves, and the programmes they belong to.',
    fill: 'bg-pana-indigo',
    onFill: 'text-pana-cream',
  },
  {
    id: 'inbox',
    name: 'Inbox',
    blurb: 'Things panas sent us that are waiting on an answer.',
    fill: 'bg-pana-butter',
    onFill: 'text-pana-ink',
  },
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
  /** Decorative. Every call site pairs it with aria-hidden. */
  icon: LucideIcon;
}

export const ADMIN_VIEWS: readonly AdminView[] = [
  {
    id: 'listings',
    name: 'Directory listings',
    href: '/admin/listings',
    group: 'directory',
    blurb: 'Applications from businesses waiting to be let into the directory.',
    does: [
      'See everything waiting, oldest first',
      'Read the application without leaving the queue',
      'Approve or decline',
    ],
    status: 'mock',
    icon: Store,
  },
  {
    id: 'download-profiles',
    name: 'Export profiles',
    href: '/admin/download-profiles',
    group: 'directory',
    blurb: 'Pull the directory down as a spreadsheet.',
    does: ['Download every profile as CSV'],
    status: 'live',
    icon: Download,
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
    icon: HeartHandshake,
  },
  {
    id: 'users',
    name: 'Users',
    href: '/admin/users',
    group: 'community',
    blurb: 'Every account on the site, and what staff can do about one.',
    does: [
      'Find an account by name, handle or email',
      'Lock an account the abuse queue has escalated',
      'See who holds admin, and why it cannot be granted here',
    ],
    status: 'mock',
    icon: UsersRound,
  },
  {
    id: 'contactus',
    name: 'Contact submissions',
    href: '/admin/contactus',
    group: 'inbox',
    blurb: 'Messages from the contact form.',
    does: ['Read the queue', 'Set status and category'],
    status: 'live',
    icon: Mail,
  },
  {
    id: 'reports',
    name: 'Abuse reports',
    href: '/admin/reports',
    group: 'inbox',
    blurb: 'Moderation reports from the Nostr relay.',
    does: ['Triage a report', 'Act on the reported account'],
    status: 'live',
    icon: Flag,
  },
];

/** Looks a group up by id. Throws rather than returning undefined: every view
 *  carries a group id from this same file, so a miss is a typo, not a state. */
export function adminGroup(id: AdminGroupId): AdminGroup {
  const group = ADMIN_GROUPS.find((g) => g.id === id);
  if (!group) throw new Error(`Unknown admin group: ${id}`);
  return group;
}

export function viewsInGroup(group: AdminGroupId): readonly AdminView[] {
  return ADMIN_VIEWS.filter((v) => v.group === group);
}

/**
 * Capability that exists as an API and has no screen.
 *
 * Distinct from `PARKED_TOOLS` below: these were never built, those were built
 * and set aside.
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

/**
 * Built, working, and deliberately off the sidebar.
 *
 * These three came across in the move from `/account/admin/*` and were then
 * taken out of the navigation to keep the surface on the work being done now.
 * Nothing was deleted: the routes still render, the endpoints still answer,
 * and the `/account/admin/*` redirects still land on them — which matters,
 * because staff notification mail contains those old URLs.
 *
 * Written down rather than dropped silently so that "where did Articles go"
 * has an answer in the codebase. Putting one back is this entry becoming an
 * `ADMIN_VIEWS` row again.
 */
export interface ParkedTool {
  name: string;
  href: string;
  note: string;
}

export const PARKED_TOOLS: readonly ParkedTool[] = [
  {
    name: 'Mentoring',
    href: '/admin/mentoring',
    note: 'Session and participation charts, reading /api/admin/mentoring/dashboard.',
  },
  {
    name: 'Articles',
    href: '/admin/articles',
    note: 'Remove and restore community articles. Three endpoints behind it, all live.',
  },
  {
    name: 'Podcasts',
    href: '/admin/podcasts',
    note: 'Was a placeholder before the move and still is — no endpoint was ever written.',
  },
];

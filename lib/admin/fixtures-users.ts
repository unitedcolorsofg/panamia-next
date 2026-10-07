/**
 * Fixture data for the users view.
 *
 * Separate from `fixtures.ts` only because that file is already the listings
 * queue at five hundred lines; same rules apply. Every field below is a real
 * column on `users` in `lib/schema/index.ts`, with one deliberate exception
 * noted on `isAdmin`, so swapping this module for a query is mechanical.
 *
 * Dates are relative to `now()` so the data never rots into "joined in 2023".
 */

import type { accountType } from '@/lib/schema';

/**
 * `account_type` pgEnum, derived rather than retyped.
 *
 * This was originally hand-written as a literal union including
 * `small_business`. Migration 0054 renamed that value to `directory` and this
 * file kept compiling for the rest of the branch, because a standalone union
 * has no source of truth to disagree with -- it just quietly described an
 * enum value that no longer existed.
 *
 * Reading it off the schema instead means the next rename fails the typecheck
 * here. `import type` is erased at build time, so this pulls no Drizzle code
 * into the bundle. `ACCOUNT_TYPE_LABEL` below is a `Record` over this union,
 * so a renamed or added value breaks there too.
 */
export type AccountType = (typeof accountType.enumValues)[number];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  personal: 'Personal',
  directory: 'Directory listing',
  hybrid: 'Hybrid',
  other: 'Other',
};

/**
 * Why an account is in front of a human.
 *
 * Same principle as the listing queue's flags: a flag says "look at this", not
 * "this person is bad". Every one has an innocent explanation and three of
 * them are usually nothing. They exist so the twelve accounts that need no
 * thought can be skipped.
 */
export type UserFlag =
  | 'reported'
  | 'unverified'
  | 'name-churn'
  | 'shared-email'
  | 'dormant';

export const USER_FLAG_LABEL: Record<UserFlag, string> = {
  reported: 'In the abuse queue',
  unverified: 'Email never confirmed',
  'name-churn': 'Handle changed repeatedly',
  'shared-email': 'Email used elsewhere',
  dormant: 'Never came back',
};

export const USER_FLAG_NOTE: Record<UserFlag, string> = {
  reported:
    'Has an open report against them on the relay. Triage it in Abuse reports — this is only the pointer.',
  unverified:
    'Signed up and never clicked the confirmation. They can still read, so this is not a lock.',
  'name-churn':
    'Changed screenname more than twice. Usually someone deciding who they are; occasionally someone shedding a reputation.',
  'shared-email':
    'The address also sits on a directory listing. Normal for an owner, worth a glance if the listing is unclaimed.',
  dormant:
    'Account created, profile never filled in, no activity since. Candidate for a nudge, not a deletion.',
};

/**
 * One account.
 *
 * `administers` stands in for the `profile_owners` join — the listings this
 * person can edit. It is the single most useful thing to know before touching
 * an account, because locking someone who runs three listings takes three
 * listings down with them.
 */
export interface AccountUser {
  id: string;
  /** `users.name`. */
  name: string;
  /** `users.screenname`. Null until they pick one. */
  screenname: string | null;
  /** `users.email`. */
  email: string;
  /** `users.email_verified`. */
  emailVerified: boolean;
  /** `users.account_type`. Decides whether they appear in the directory. */
  accountType: AccountType;
  /** `users.locked_at`. Set on nobody today — see the page. */
  lockedAt: Date | null;
  /** `users.created_at`. */
  createdAt: Date;
  /** `users.last_screenname_change`, which rate-limits the next one. */
  lastScreennameChange: Date | null;
  /** `users.alternate_emails`. */
  alternateEmails: string[];
  /** Listing names from `profile_owners`. Empty for most members. */
  administers: string[];
  /**
   * Derived from the `ADMIN_EMAILS` environment variable at session time by
   * `enrichUserFields()` in auth.ts. **Not a column**, which is the whole
   * point of the panel at the bottom of the page: this is the one permission
   * in the product that no screen can grant or revoke.
   */
  isAdmin: boolean;
  /** Member of the Connectors programme. Lives in the programme, not on users. */
  connector: boolean;
  flags: UserFlag[];
}

function daysAgo(days: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * One page of accounts.
 *
 * Sixteen rows, mixed on purpose: a screen that renders sixteen tidy verified
 * personal accounts proves nothing about whether it is usable. The awkward
 * ones — the shared email, the handle that moved four times, the dormant
 * signups — are the rows the screen exists to surface.
 *
 * ## Every address here is on a reserved domain, deliberately
 *
 * `example.com`, `.org` and `.net` are reserved by RFC 2606 and can never
 * belong to anyone. That matters more here than on the other mocks, because
 * `/admin/users` renders for signed-out visitors the way the other two mocked
 * views do, and this is the one whose *shape* is sensitive: it puts a name
 * next to an address next to "in the abuse queue".
 *
 * An invented name is inert. An invented name attached to a working mailbox
 * is a real person's inbox receiving the consequences of a flag we made up,
 * and `gmail.com` addresses assembled from plausible names collide with real
 * ones easily. The admin list is worse again — `ADMIN_HOLDERS` on the live
 * company domain would have published, to anyone, exactly which addresses to
 * attack to obtain admin, including one captioned as granting admin to
 * whoever registers it next.
 *
 * So: do not "improve" these into realistic-looking addresses. The small loss
 * of texture is the entire point.
 */
export const ACCOUNTS: AccountUser[] = [
  {
    id: 'usr-claribel',
    name: 'Claribel Avila',
    screenname: 'claribel',
    email: 'claribel.avila@example.com',
    emailVerified: true,
    accountType: 'personal',
    lockedAt: null,
    createdAt: daysAgo(612),
    lastScreennameChange: daysAgo(598),
    alternateEmails: [],
    administers: [],
    isAdmin: true,
    connector: true,
    flags: [],
  },
  {
    id: 'usr-isa',
    name: 'Isa Marrero',
    screenname: 'isa',
    email: 'isa@example.org',
    emailVerified: true,
    accountType: 'personal',
    lockedAt: null,
    createdAt: daysAgo(640),
    lastScreennameChange: null,
    alternateEmails: ['isamarrero@example.com'],
    administers: [],
    isAdmin: true,
    connector: false,
    flags: [],
  },
  {
    id: 'usr-dulce',
    name: 'Rosa Elena Figueroa',
    screenname: 'dulcevida',
    email: 'hola@example.com',
    emailVerified: true,
    accountType: 'directory',
    lockedAt: null,
    createdAt: daysAgo(34),
    lastScreennameChange: daysAgo(30),
    alternateEmails: [],
    administers: ['Dulce Vida Panadería'],
    isAdmin: false,
    connector: false,
    flags: ['shared-email'],
  },
  {
    id: 'usr-nando',
    name: 'Nando Cruz',
    screenname: 'nandocruz',
    email: 'nando.cruz@example.com',
    emailVerified: true,
    accountType: 'hybrid',
    lockedAt: null,
    createdAt: daysAgo(287),
    lastScreennameChange: daysAgo(12),
    alternateEmails: [],
    administers: ['Cruz Sound Repair'],
    isAdmin: false,
    connector: false,
    flags: [],
  },
  {
    id: 'usr-yaz',
    name: 'Yaz Villalobos',
    screenname: 'yazzz',
    email: 'yaz.villalobos@example.com',
    emailVerified: true,
    accountType: 'personal',
    lockedAt: null,
    createdAt: daysAgo(201),
    lastScreennameChange: daysAgo(4),
    alternateEmails: [],
    administers: [],
    isAdmin: false,
    connector: true,
    flags: ['name-churn'],
  },
  {
    id: 'usr-theo',
    name: 'Theo Nascimento',
    screenname: null,
    email: 'theo.nascimento@example.com',
    emailVerified: false,
    accountType: 'personal',
    lockedAt: null,
    createdAt: daysAgo(418),
    lastScreennameChange: null,
    alternateEmails: [],
    administers: [],
    isAdmin: false,
    connector: false,
    flags: ['unverified', 'dormant'],
  },
  {
    id: 'usr-marisol',
    name: 'Marisol Peña',
    screenname: 'marisolp',
    email: 'marisol@example.com',
    emailVerified: true,
    accountType: 'hybrid',
    lockedAt: null,
    createdAt: daysAgo(156),
    lastScreennameChange: daysAgo(150),
    alternateEmails: ['marisol.pena.mia@example.com'],
    administers: ['Peña Ceramics', 'Little River Clay Collective'],
    isAdmin: false,
    connector: false,
    flags: [],
  },
  {
    id: 'usr-deleted-handle',
    name: 'K. Laurent',
    screenname: 'kiki',
    email: 'kiki.laurent@example.com',
    emailVerified: true,
    accountType: 'personal',
    lockedAt: null,
    createdAt: daysAgo(93),
    lastScreennameChange: daysAgo(2),
    alternateEmails: [],
    administers: [],
    isAdmin: false,
    connector: false,
    flags: ['name-churn'],
  },
  {
    id: 'usr-omar',
    name: 'Omar Benitez',
    screenname: 'omarb',
    email: 'obenitez@example.com',
    emailVerified: true,
    accountType: 'personal',
    lockedAt: null,
    createdAt: daysAgo(377),
    lastScreennameChange: daysAgo(370),
    alternateEmails: [],
    administers: [],
    isAdmin: false,
    connector: false,
    flags: ['reported'],
  },
  {
    id: 'usr-spam-1',
    name: 'Best Deals Miami',
    screenname: null,
    email: 'promo4821@example.net',
    emailVerified: false,
    accountType: 'other',
    lockedAt: daysAgo(6),
    createdAt: daysAgo(7),
    lastScreennameChange: null,
    alternateEmails: [],
    administers: [],
    isAdmin: false,
    connector: false,
    flags: ['reported', 'unverified'],
  },
  {
    id: 'usr-sol',
    name: 'Sol Arismendi',
    screenname: 'solarismendi',
    email: 'sol@example.com',
    emailVerified: true,
    accountType: 'directory',
    lockedAt: null,
    createdAt: daysAgo(64),
    lastScreennameChange: daysAgo(64),
    alternateEmails: [],
    administers: ['Arismendi Studio'],
    isAdmin: false,
    connector: true,
    flags: [],
  },
  {
    id: 'usr-wren',
    name: 'Wren Delacroix',
    screenname: 'wren',
    email: 'wren.delacroix@example.com',
    emailVerified: true,
    accountType: 'personal',
    lockedAt: null,
    createdAt: daysAgo(122),
    lastScreennameChange: null,
    alternateEmails: [],
    administers: [],
    isAdmin: false,
    connector: false,
    flags: [],
  },
  {
    id: 'usr-dormant-1',
    name: 'J. Alvarez',
    screenname: null,
    email: 'jalvarez2019@example.com',
    emailVerified: false,
    accountType: 'personal',
    lockedAt: null,
    createdAt: daysAgo(503),
    lastScreennameChange: null,
    alternateEmails: [],
    administers: [],
    isAdmin: false,
    connector: false,
    flags: ['unverified', 'dormant'],
  },
  {
    id: 'usr-bianca',
    name: 'Bianca Restrepo',
    screenname: 'bianca',
    email: 'bianca.restrepo@example.com',
    emailVerified: true,
    accountType: 'personal',
    lockedAt: null,
    createdAt: daysAgo(248),
    lastScreennameChange: daysAgo(240),
    alternateEmails: [],
    administers: [],
    isAdmin: false,
    connector: true,
    flags: [],
  },
  {
    id: 'usr-vegan',
    name: 'Darnell Pierre',
    screenname: 'cafecito',
    email: 'orders@example.com',
    emailVerified: true,
    accountType: 'directory',
    lockedAt: null,
    createdAt: daysAgo(19),
    lastScreennameChange: daysAgo(19),
    alternateEmails: [],
    administers: ['Cafecito Corner'],
    isAdmin: false,
    connector: false,
    flags: ['shared-email'],
  },
  {
    id: 'usr-luz',
    name: 'Luz Caraballo',
    screenname: 'luzc',
    email: 'luz@example.org',
    emailVerified: true,
    accountType: 'personal',
    lockedAt: null,
    createdAt: daysAgo(590),
    lastScreennameChange: daysAgo(588),
    alternateEmails: [],
    administers: [],
    isAdmin: true,
    connector: false,
    flags: [],
  },
];

/**
 * Site-wide counts.
 *
 * Deliberately *not* computed from `ACCOUNTS` the way `listingStats()` is
 * computed from the queue. The listings queue is the whole queue, so counting
 * its rows is honest. This table is one page of a few thousand, and a band
 * reading "16 accounts" above a paginated table would be describing the page
 * rather than the site. A real implementation is five `count(*)` queries.
 */
export const USER_TOTALS = {
  accounts: 1284,
  inDirectory: 212,
  unverified: 97,
  unverifiedOverAYear: 31,
  locked: 3,
  admins: 4,
} as const;

/**
 * Everyone `ADMIN_EMAILS` grants admin to.
 *
 * A separate list rather than a filter over `ACCOUNTS`, because the two are
 * not the same set and the difference is the interesting part. `ADMIN_EMAILS`
 * is a comma-separated environment variable; `enrichUserFields()` compares the
 * signed-in address against it. So an entry can sit in that variable with no
 * user row behind it at all — and the day somebody signs up with that address
 * they are an admin, immediately, with nothing in the product having changed.
 *
 * Length matches `USER_TOTALS.admins` on purpose. If you add a holder here,
 * move that number too.
 */
export interface AdminHolder {
  email: string;
  /** The matching account, or null when the address has never signed up. */
  name: string | null;
  note?: string;
}

export const ADMIN_HOLDERS: readonly AdminHolder[] = [
  { email: 'claribel.avila@example.com', name: 'Claribel Avila' },
  { email: 'isa@example.org', name: 'Isa Marrero' },
  { email: 'luz@example.org', name: 'Luz Caraballo' },
  {
    email: 'team@example.org',
    name: null,
    note: 'No account uses this address. It still grants admin to whoever signs up with it next.',
  },
];

export interface UserStat {
  label: string;
  value: string;
  note: string;
}

export function userStats(): UserStat[] {
  const t = USER_TOTALS;
  return [
    {
      label: 'Accounts',
      value: t.accounts.toLocaleString(),
      note: 'Every row in users.',
    },
    {
      label: 'In the directory',
      value: t.inDirectory.toLocaleString(),
      note: 'Directory or hybrid. The rest read it.',
    },
    {
      label: 'Email unconfirmed',
      value: t.unverified.toLocaleString(),
      note: `${t.unverifiedOverAYear} of them over a year old.`,
    },
    {
      label: 'Locked',
      value: String(t.locked),
      note: 'Nothing in the product sets this yet.',
    },
    {
      label: 'Hold admin',
      value: String(t.admins),
      note: 'From ADMIN_EMAILS, not from a column.',
    },
  ];
}

/** Flagged first, then newest. The rows that need a human come to the top. */
export function attentionOrder(rows: readonly AccountUser[]): AccountUser[] {
  return [...rows].sort((a, b) => {
    if (a.flags.length !== b.flags.length) return b.flags.length - a.flags.length;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export function joinedLabel(createdAt: Date): string {
  const days = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
  if (days < 31) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  const years = (days / 365).toFixed(1).replace(/\.0$/, '');
  return `${years}y ago`;
}

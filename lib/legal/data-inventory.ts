// Binds the privacy framework to the database schema.
//
// policy.json describes what we collect; this file asserts that description
// against the actual Drizzle tables. Historically nothing connected the two, so
// design drift went unnoticed in both directions — categories documenting
// dropped tables (event_photos, srt_keys) and tables holding personal data with
// no category at all (the relay tables). See docs/PRIVACY-ROADMAP.md.
//
// Two guarantees, at two layers:
//
//  - Compile time: `inventory` is Record<TableExport, Classification>, where
//    TableExport is every table exported from lib/schema. Adding a table to the
//    schema without an entry here is a compile error — the decision lands when
//    the table is written, which is when the author knows the answer.
//
//  - Run time: category NAMES cannot be checked at compile time — they widen to
//    `string` coming through the policy.json import — so validateInventory()
//    checks that every referenced category exists and that every category is
//    either table-backed or declared storage-free. scripts/check-data-inventory.ts
//    runs it in pre-commit.
//
// Granularity is table-level, not column-level: `profiles` backs six categories,
// so this catches "table undocumented" but not "new personal column added to an
// already-classified table". Column-level is a heavier v2.

import * as schema from '@/lib/schema';
import { PgTable } from 'drizzle-orm/pg-core';
import { allCategories } from './privacy-policy';

// A table that stores no personal data (group config, join tables of opaque
// ids, etc.). A positive assertion a reviewer can challenge — there is no
// "classify later" escape hatch, so an unclassified new table simply does not
// compile. Either name its categories or assert it holds none.
export const NOT_PERSONAL_DATA = Symbol('not-personal-data');

type CategoryName = (typeof allCategories)[number]['name'];

type Classification = CategoryName[] | typeof NOT_PERSONAL_DATA;

// Every key of the schema module whose value is a Drizzle table. Enums,
// relations, and type aliases are excluded by the `extends PgTable` test.
type TableExport = {
  [K in keyof typeof schema]: (typeof schema)[K] extends PgTable ? K : never;
}[keyof typeof schema];

// The map. Exhaustive over TableExport — a missing table will not compile.
//
// Categories that are NOT backed by any of our tables — because the data lives
// on a third party (analytics -> Cloudflare, oauth via provider), on servers we
// do not operate (nostr_published_events -> relay D1), or nowhere durable
// (mentoring realtime, in-person, peer-observed) — are declared in
// STORAGE_FREE_CATEGORIES below rather than pinned to a row here.
export const inventory: Record<TableExport, Classification> = {
  // --- Auth / account ---
  users: ['account'],
  accounts: ['account', 'oauth_identity', 'oauth_tokens'],
  sessions: ['account'],
  verification: ['verification_tokens'],
  oAuthVerifications: ['verification_tokens'],

  // --- Profile (one wide table backing several categories) ---
  profiles: [
    'profile',
    'mentoring_profile',
    'nostr_identity',
    'payments', // stripe_customer_id
    'crm', // ghl_contact_id
    'visible_profile_info',
  ],

  // --- Notifications / preferences ---
  notifications: ['notifications'],

  // --- Onboarding ---
  intakeForms: ['intake'],

  // --- Mentoring (realtime session data is temporary/peer, not stored here) ---
  mentorSessions: ['session_notes'],

  // --- Articles ---
  articles: ['articles', 'article_reviews', 'co_author_content'],

  // --- Social / ActivityPub ---
  socialActors: ['activitypub_federated_content', 'visible_profile_info'],
  socialStatuses: ['social_posts', 'activitypub_federated_content'],
  socialFollows: ['social_graph'],
  socialLikes: ['social_graph'],
  socialAttachments: ['uploads', 'social_posts'],
  socialTags: ['social_posts'],
  articleAnnouncements: ['activitypub_federated_content'],

  // --- Events ---
  venues: ['events'],
  events: ['events'],
  eventAttendees: ['rsvps', 'event_attendance_info'],

  // --- Relay / Nostr ---
  relayGroups: NOT_PERSONAL_DATA, // group metadata only; no member PII
  relayGroupMembers: ['relay_group_membership'],
  relayGroupJoinPending: ['relay_pending_requests'],
  relayGroupLeavePending: ['relay_pending_requests'],
  relayReports: ['relay_abuse_reports'],

  // --- Compliance records (retained after account deletion by design) ---
  consentReceipts: ['consent_receipts'],
  deletionLogs: ['deletion_audit'],
  screennameHistory: ['screenname_redirects'],

  // --- Other deletable member data ---
  emailMigrations: ['verification_tokens'], // tokenized email-change, temporary
  contactSubmissions: ['other_member_data'],
  newsletterSignups: ['other_member_data'],
  interactions: ['other_member_data'],
};

// Categories with no backing row in `inventory`, by design. Kept explicit so
// the reverse check (every category is either table-backed or declared here)
// can tell "storage-free" apart from "forgotten".
export const STORAGE_FREE_CATEGORIES: CategoryName[] = [
  // Temporary — Durable Object / in-memory, never Postgres
  'signaling',
  'whiteboard',
  'session_chat',
  'session_streams',
  // Peer — seen by participants, not retained by us
  'webrtc_streams',
  'whiteboard_content',
  'seen_chat_messages',
  'in_person_exchanges',
  // External — a third party or an open network holds it, not our DB
  'analytics', // Cloudflare
  'nostr_published_events', // relay D1 + open Nostr network, out of scope here
  'transactional_email', // Cloudflare Email Sending, stateless
];

// ---------------------------------------------------------------------------
// Runtime validation
// ---------------------------------------------------------------------------

export interface InventoryIssue {
  kind:
    | 'unknown_category' // a table references a category name that does not exist
    | 'uncovered_category'; // a category is neither table-backed nor storage-free
  detail: string;
}

const CATEGORY_NAMES = new Set(allCategories.map((c) => c.name));

/**
 * Cross-checks the inventory against policy.json. Returns every issue found;
 * an empty array means the framework and the schema agree. Intended to run in a
 * test / pre-commit check, not at request time.
 */
export function validateInventory(): InventoryIssue[] {
  const issues: InventoryIssue[] = [];
  const covered = new Set<string>(STORAGE_FREE_CATEGORIES);

  for (const [table, classification] of Object.entries(inventory)) {
    if (classification === NOT_PERSONAL_DATA) continue;
    for (const cat of classification) {
      if (!CATEGORY_NAMES.has(cat)) {
        issues.push({
          kind: 'unknown_category',
          detail: `${table} -> "${cat}" is not a category in policy.json`,
        });
      }
      covered.add(cat);
    }
  }

  for (const cat of CATEGORY_NAMES) {
    if (!covered.has(cat)) {
      issues.push({
        kind: 'uncovered_category',
        detail: `category "${cat}" is neither backed by a table nor declared storage-free`,
      });
    }
  }

  return issues;
}

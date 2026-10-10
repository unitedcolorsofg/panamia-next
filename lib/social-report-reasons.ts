import type { socialReportReason } from '@/lib/schema';

// The reasons offered in ReportDialog and used to triage the admin queue at
// /account/admin/social-reports.
//
// The list is spelled out here rather than read from the Drizzle enum at
// runtime, for the same reason lib/query/social.ts hand-declares
// SocialBlockKind: this module is imported by client components, and importing
// @/lib/schema for its value would pull drizzle-orm into the browser bundle to
// obtain nine strings.
//
// The `import type` above is erased at build time and costs nothing, but it
// lets the assertion at the bottom of this file fail the build if this list
// and the database enum ever drift apart. So adding a reason still means
// adding an enum member plus a migration — the compiler enforces it.
export const SOCIAL_REPORT_REASONS = [
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'self_harm',
  'sexual_content',
  'csam',
  'impersonation',
  'other',
] as const;

export type SocialReportReason = (typeof SOCIAL_REPORT_REASONS)[number];

export const VALID_SOCIAL_REPORT_REASONS = new Set<string>(
  SOCIAL_REPORT_REASONS
);

export function isSocialReportReason(
  value: unknown
): value is SocialReportReason {
  return typeof value === 'string' && VALID_SOCIAL_REPORT_REASONS.has(value);
}

// Shown to the reporter in the picker, and to moderators in the queue. Plain
// language rather than policy language: somebody reporting harassment is upset
// and should not have to decode "violative conduct".
//
// Hardcoded English, like the rest of the safety UI (BlockMenu is too). The
// public contact form translates its categories; these do not yet.
export const SOCIAL_REPORT_REASON_LABELS: Record<SocialReportReason, string> = {
  spam: 'Spam or scam',
  harassment: 'Harassment or bullying',
  hate_speech: 'Hate speech',
  violence: 'Violence or threats',
  self_harm: 'Self-harm or suicide',
  sexual_content: 'Unwanted sexual content',
  csam: 'Sexual content involving a minor',
  impersonation: 'Impersonation',
  other: 'Something else',
};

// The second line under each option. Helps somebody pick the right reason,
// which is what makes the queue triageable later.
export const SOCIAL_REPORT_REASON_HINTS: Record<SocialReportReason, string> = {
  spam: 'Repetitive posts, fake offers, or links trying to take money.',
  harassment: 'Targeted insults, pile-ons, or repeated unwanted contact.',
  hate_speech: 'Attacks based on race, religion, origin, gender, or identity.',
  violence: 'Threatening to hurt someone, or encouraging others to.',
  self_harm: 'Someone may be in danger. We treat these first.',
  sexual_content: 'Explicit content posted where it was not invited.',
  csam: 'Reported to NCMEC as required by law. Please do not share the content.',
  impersonation: 'Pretending to be a person or business they are not.',
  other: 'Tell us what happened and we will take a look.',
};

// Compile-time drift guard between this list and the `social_report_reason`
// Postgres enum. If either side gains or loses a member, the assignment below
// stops type-checking and the build fails here — rather than at runtime, with
// an invalid-input-value-for-enum error from Postgres on a report somebody was
// trying to file.
type SchemaReason = (typeof socialReportReason)['enumValues'][number];
type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : never
  : never;
const _assertReasonsMatch: MutuallyAssignable<
  SocialReportReason,
  SchemaReason
> = true;
void _assertReasonsMatch;

/**
 * The GHL structure the inquiry routing design expects to find.
 *
 * Phase 3 of docs/CONTACT-ROADMAP.md is dashboard work — pipelines, stages, and
 * roles are created by hand in GHL, not by this app. This module is the single
 * place that says what "created correctly" means, so the dashboard config and
 * the code that depends on it cannot drift apart silently.
 *
 * Nothing here hardcodes a GHL ID. Pipelines and stages are resolved by name at
 * runtime, because a stage ID pinned in a deploy breaks the moment someone
 * renames or reorders a stage, and the failure would be a silent write to the
 * wrong stage rather than an error.
 *
 * Verify the live account matches with: npx tsx scripts/ghl-check-structure.ts
 */

import type { GhlClient, GhlPipeline } from '@/lib/ghl';
import type { ContactCategory } from '@/lib/contact-categories';

/**
 * Name of the pipeline inquiries are tracked in.
 *
 * Hardcoded rather than configurable: renaming the pipeline in GHL should be a
 * deliberate act that also changes this constant, not something that silently
 * redirects writes to whatever else happens to match.
 */
export const INQUIRIES_PIPELINE_NAME = 'Inquiries';

/**
 * Stages the Inquiries pipeline must have, in order.
 *
 * Terminal states map to opportunity status rather than a stage: Resolved to
 * `won`, dismissed to `abandoned`. See "GHL structure" in CONTACT-ROADMAP.
 */
export const INQUIRY_STAGES = [
  'New',
  'Assigned',
  'Awaiting Reply',
  'Resolved',
] as const;

export type InquiryStage = (typeof INQUIRY_STAGES)[number];

// --- Tags -------------------------------------------------------------------

/** Applied to every contact this path creates or updates. */
export const TAG_SOURCE_CONTACT_US = 'source:contact-us';

/** Applied to contacts built from an address nobody confirmed. */
export const TAG_UNVERIFIED = 'unverified';

/** Mirrors the submission category, e.g. `inquiry:press`. */
export function inquiryTag(category: ContactCategory): string {
  return `inquiry:${category}`;
}

/**
 * The full tag set for a contact created by this path.
 *
 * Applied with the add-tag endpoint, never through upsert: upsert's `tags`
 * field replaces the contact's entire tag set and would strip membership tags
 * written by the Stripe relay.
 */
export function contactUsTags(
  category: ContactCategory,
  authenticated: boolean
): string[] {
  const tags = [TAG_SOURCE_CONTACT_US, inquiryTag(category)];
  if (!authenticated) tags.push(TAG_UNVERIFIED);
  return tags;
}

// --- Ownership --------------------------------------------------------------

/**
 * Ownership is assigned in GHL, not here.
 *
 * The app writes `inquiry:{category}` and a Workflow keyed on that tag assigns
 * the record to whoever currently owns that kind of inquiry. Nothing in this
 * repo names a person or holds a GHL user ID, so a staffing change is a
 * dashboard edit with no deploy — which is what the roadmap asked for and what
 * a role-to-user map in configuration could not actually deliver, since a
 * Workers `vars` change still needs a redeploy.
 *
 * The consequence is that the tags above are load-bearing for ownership, not
 * just for reporting. Changing `inquiryTag()` silently orphans every inquiry
 * whose Workflow still filters on the old string.
 *
 * UNVERIFIED: GHL's "Assign to user" workflow action is understood to set the
 * *contact's* owner. Whether that reaches a Task's own `assignedTo` has not
 * been tested, and if it does not, tasks may sit unassigned in the task list
 * even though the contact is owned. That is the failure mode Goal 4 names, so
 * confirm it before relying on this path. See CONTACT-ROADMAP Phase 3.
 */
export const OWNERSHIP_IS_ASSIGNED_IN_GHL = true;

// --- Pipeline resolution ----------------------------------------------------

export interface ResolvedPipeline {
  id: string;
  name: string;
  /** Stage name to stage ID, for the stages that exist. */
  stages: Partial<Record<InquiryStage, string>>;
  /** Stages named in INQUIRY_STAGES that the pipeline does not have. */
  missingStages: InquiryStage[];
}

/**
 * Find the Inquiries pipeline and map its stage names to IDs.
 *
 * Returns null when no pipeline matches the expected name — Phase 3 has not
 * been done, or the pipeline was renamed. Callers must treat that as "cannot
 * route to an Opportunity" rather than falling back to another pipeline: the
 * only other pipeline on the account tracks member leads, and putting an
 * inquiry there is precisely what the design forbids.
 *
 * Matching is case-insensitive and trims whitespace, since the name is typed by
 * hand in a dashboard.
 */
export function findInquiriesPipeline(
  pipelines: GhlPipeline[]
): ResolvedPipeline | null {
  const wanted = INQUIRIES_PIPELINE_NAME.trim().toLowerCase();
  const pipeline = pipelines.find(
    (p) => p.name?.trim().toLowerCase() === wanted
  );
  if (!pipeline) return null;

  const stages: Partial<Record<InquiryStage, string>> = {};
  const missingStages: InquiryStage[] = [];
  for (const stageName of INQUIRY_STAGES) {
    const match = pipeline.stages?.find(
      (s) => s.name?.trim().toLowerCase() === stageName.toLowerCase()
    );
    if (match?.id) stages[stageName] = match.id;
    else missingStages.push(stageName);
  }

  return { id: pipeline.id, name: pipeline.name, stages, missingStages };
}

/** Convenience wrapper that fetches pipelines and resolves in one call. */
export async function resolveInquiriesPipeline(
  ghl: GhlClient
): Promise<ResolvedPipeline | null> {
  return findInquiriesPipeline(await ghl.getPipelines());
}

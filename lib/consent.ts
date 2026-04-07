import { db } from '@/lib/db';
import { consentReceipts } from '@/lib/schema';
import { and, eq, lt, isNull } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// =============================================================================
// Consent receipt helpers — Phase 3 consent infrastructure
//
// Usage:
//   const consented = await hasConsent(userId, 'terms', 'articles', 1);
//   if (!consented) { /* show gate or notice per policy.json consent.type */ }
//
//   await recordConsent({ userId, document: 'terms', module: 'articles',
//     version: '0.1', majorVersion: 0, ip, gpcDetected });
//
// Annual re-consent: hasConsent lazily purges receipts older than 1 year
// for the specific document+module being checked. This also expunges stored
// IP addresses without requiring a cron job.
// =============================================================================

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Check whether the user has a current consent receipt for a given
 * document + module + major version. Lazily purges expired receipts
 * (older than 1 year) for the same document + module before checking.
 *
 * @param module - Module ID (e.g. 'articles') or null for top-level terms
 */
export async function hasConsent(
  userId: string,
  document: string,
  module: string | null,
  majorVersion: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - ONE_YEAR_MS);

  // Purge expired receipts for this user + document + module
  const moduleCondition =
    module === null
      ? isNull(consentReceipts.module)
      : eq(consentReceipts.module, module);

  await db
    .delete(consentReceipts)
    .where(
      and(
        eq(consentReceipts.userId, userId),
        eq(consentReceipts.document, document),
        moduleCondition,
        lt(consentReceipts.createdAt, cutoff)
      )
    );

  // Check for a current receipt matching the major version
  const receipt = await db.query.consentReceipts.findFirst({
    where: and(
      eq(consentReceipts.userId, userId),
      eq(consentReceipts.document, document),
      moduleCondition,
      eq(consentReceipts.majorVersion, majorVersion)
    ),
  });

  return !!receipt;
}

/**
 * Record a consent receipt. Called when the user accepts a gate or
 * acknowledges a notice.
 */
export async function recordConsent(params: {
  userId: string;
  document: string;
  module: string | null;
  version: string;
  majorVersion: number;
  ip: string | null;
  gpcDetected: boolean;
}): Promise<void> {
  await db.insert(consentReceipts).values({
    id: createId(),
    userId: params.userId,
    document: params.document,
    module: params.module,
    version: params.version,
    majorVersion: params.majorVersion,
    ip: params.ip,
    gpcDetected: params.gpcDetected,
    createdAt: new Date(),
  });
}

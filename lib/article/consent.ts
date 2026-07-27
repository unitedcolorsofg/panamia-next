/**
 * Server-side Articles-module consent gate.
 *
 * Parity with the client's hard consent gate (useModuleConsent +
 * ConsentModal type="gate"), which blocks the editor / collaboration UI on
 * entry until the user accepts the Articles terms. Enforced on the module's
 * write endpoints so the terms can't be bypassed by a scripted client —
 * consent is required *before a user interacts with the module* (reading
 * published articles is public and stays ungated).
 *
 * The required version comes from policy.json (via getModuleMajorVersion), not
 * a hardcoded constant, so it tracks the terms as they're revised.
 */

import { NextResponse } from 'next/server';
import { requireModuleConsent } from '@/lib/consent';
import { getModuleMajorVersion } from '@/lib/legal/policy-version';

/**
 * Returns a ready-to-return 403 NextResponse when the user has not consented to
 * the current Articles module terms, or null when they have (caller proceeds).
 * The 403 body carries `code: 'CONSENT_REQUIRED'` and `module: 'articles'` so
 * the client can route to the right consent gate.
 */
export async function articlesConsentGate(
  userId: string
): Promise<NextResponse | null> {
  const majorVersion = getModuleMajorVersion('articles');
  if (majorVersion === null) {
    // Misconfiguration (articles missing from policy.json). The pre-commit hook
    // guards against this; fail open to match the client's fail-open behavior
    // rather than lock every author out over a config typo.
    console.error("policy.json is missing the 'articles' module version");
    return null;
  }

  const gate = await requireModuleConsent(
    userId,
    'terms',
    'articles',
    majorVersion
  );
  if (gate.ok) return null;
  return NextResponse.json(
    {
      success: false,
      error: gate.error,
      code: gate.code,
      module: gate.module,
    },
    { status: 403 }
  );
}

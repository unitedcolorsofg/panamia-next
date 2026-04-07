'use client';

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// useModuleConsent — client-side hook for Phase 3 consent infrastructure
//
// Checks whether the current user has consented to a specific module's terms
// at the current major version. If not, exposes state to trigger the
// ConsentModal and a handler to record consent via API.
//
// Usage:
//   const { needsConsent, recordConsent, isLoading } = useModuleConsent({
//     document: 'terms',
//     module: 'articles',
//     majorVersion: 0,
//   });
//
//   <ConsentModal open={needsConsent} onConsent={recordConsent} ... />
//
// The hook calls GET /api/consent/check and POST /api/consent/record.
// These API routes are not yet implemented — see code comments in each for
// the expected request/response shape.
// =============================================================================

interface UseModuleConsentOptions {
  document: string;
  module: string | null;
  majorVersion: number;
  /** Skip the consent check entirely (e.g., for admin users) */
  skip?: boolean;
}

interface UseModuleConsentResult {
  /** True if the user has NOT yet consented and the modal should be shown */
  needsConsent: boolean;
  /** Call this from ConsentModal's onConsent to record the receipt */
  recordConsent: () => Promise<void>;
  /** True while the initial check is in flight */
  isLoading: boolean;
}

export function useModuleConsent({
  document,
  module,
  majorVersion,
  skip = false,
}: UseModuleConsentOptions): UseModuleConsentResult {
  const [needsConsent, setNeedsConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(!skip);

  // Check consent status on mount
  useEffect(() => {
    if (skip) return;

    const checkConsent = async () => {
      try {
        const params = new URLSearchParams({
          document,
          majorVersion: String(majorVersion),
        });
        if (module) params.set('module', module);

        // TODO: Implement GET /api/consent/check
        // Expected response: { consented: boolean }
        // Internally calls hasConsent() from lib/consent.ts which also
        // lazily purges expired receipts (>1 year) for this user+doc+module.
        const res = await fetch(`/api/consent/check?${params}`);
        if (res.ok) {
          const data = await res.json();
          setNeedsConsent(!data.consented);
        }
      } catch {
        // On error, don't block the user — fail open
        setNeedsConsent(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkConsent();
  }, [document, module, majorVersion, skip]);

  const recordConsent = useCallback(async () => {
    try {
      // TODO: Implement POST /api/consent/record
      // Expected body: { document, module, version, majorVersion }
      // Internally calls recordConsent() from lib/consent.ts.
      // IP and GPC detection are handled server-side from the request headers.
      await fetch('/api/consent/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document, module, majorVersion }),
      });
      setNeedsConsent(false);
    } catch {
      // Still dismiss — don't trap the user on a network error
      setNeedsConsent(false);
    }
  }, [document, module, majorVersion]);

  return { needsConsent, recordConsent, isLoading };
}
